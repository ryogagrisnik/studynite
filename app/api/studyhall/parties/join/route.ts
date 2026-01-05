import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";

import { withApi } from "@/lib/api";
import { authOptions } from "@/lib/auth";
import { env } from "@/lib/env";
import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { getRequestIp } from "@/lib/request";
import { PARTY_MAX_PLAYERS } from "@/lib/studyhall/constants";
import { resolveAvatarId } from "@/lib/studyhall/avatars";
import { markPartyEvent } from "@/lib/studyhall/partyEvents";
import { generateShareId } from "@/lib/studyhall/utils";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  partyId: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).max(24).optional(),
  playerToken: z.string().trim().min(1).optional(),
  avatarId: z.string().trim().min(1).optional(),
});

export const POST = withApi(async (req: Request) => {
  await prisma.party.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  let payload: unknown = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const code = (parsed.data.code || "").toUpperCase().trim();
  const partyId = parsed.data.partyId?.trim();

  const maxJoins = Math.max(1, Number(env.RATE_LIMIT_PARTY_JOIN_MAX ?? "20"));
  const ip = getRequestIp(req);
  const rate = await rateLimit(`party:join:${ip}:${code || partyId || "unknown"}`, {
    max: maxJoins,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    const retryAfter = Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000));
    const res = NextResponse.json({ ok: false, error: "RATE_LIMITED", retryAfter }, { status: 429 });
    res.headers.set("Retry-After", String(retryAfter));
    return res;
  }

  if (!code && !partyId) {
    return NextResponse.json({ ok: false, error: "Missing party code" }, { status: 400 });
  }

  const party = await prisma.party.findFirst({
    where: code ? { joinCode: code } : { id: partyId },
    include: { players: true },
  });

  if (!party) {
    return NextResponse.json({ ok: false, error: "Party not found" }, { status: 404 });
  }

  if (party.status === "COMPLETE") {
    return NextResponse.json({ ok: false, error: "Party already completed" }, { status: 400 });
  }

  if (parsed.data.playerToken) {
    const existingPlayer = await prisma.partyPlayer.findUnique({
      where: { playerToken: parsed.data.playerToken },
    });

    if (existingPlayer && existingPlayer.partyId === party.id) {
      if (existingPlayer.kickedAt) {
        return NextResponse.json({ ok: false, error: "You were removed from this party." }, { status: 403 });
      }
      await prisma.partyPlayer.update({
        where: { id: existingPlayer.id },
        data: {
          lastSeenAt: new Date(),
          ...(userId && !existingPlayer.userId ? { userId } : {}),
        },
      });
      await markPartyEvent(party.id);

      return NextResponse.json({
        ok: true,
        partyId: party.id,
        joinCode: party.joinCode,
        player: {
          id: existingPlayer.id,
          name: existingPlayer.name,
          score: existingPlayer.score,
          playerToken: existingPlayer.playerToken,
          avatarId: existingPlayer.avatarId,
        },
      });
    }
  }

  if (party.joinLocked) {
    return NextResponse.json({ ok: false, error: "This party is locked." }, { status: 403 });
  }

  const name = (parsed.data.name || "").trim().slice(0, 24);
  if (!name) {
    return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
  }

  const activePlayers = party.players.filter((p) => !p.leftAt && !p.kickedAt);
  if (activePlayers.length >= PARTY_MAX_PLAYERS) {
    return NextResponse.json({ ok: false, error: "Party is full" }, { status: 400 });
  }

  const playerToken = generateShareId(18);
  const avatarId = resolveAvatarId(parsed.data.avatarId ?? null);

  const player = await prisma.partyPlayer.create({
    data: {
      partyId: party.id,
      name,
      playerToken,
      avatarId,
      ...(userId ? { userId } : {}),
    },
  });
  await markPartyEvent(party.id);

  return NextResponse.json({
    ok: true,
    partyId: party.id,
    joinCode: party.joinCode,
    player: {
      id: player.id,
      name: player.name,
      score: player.score,
      playerToken: player.playerToken,
      avatarId: player.avatarId,
    },
  });
});
