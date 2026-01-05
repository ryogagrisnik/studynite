import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { markPartyEvent } from "@/lib/studyhall/partyEvents";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { partyId: string } }) {
  let payload: { playerToken?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  if (!payload.playerToken) {
    return NextResponse.json({ ok: false, error: "Missing player token" }, { status: 400 });
  }

  const player = await prisma.partyPlayer.findUnique({
    where: { playerToken: payload.playerToken },
  });

  if (!player || player.partyId !== params.partyId) {
    return NextResponse.json({ ok: false, error: "Player not found" }, { status: 404 });
  }

  const party = await prisma.party.findUnique({
    where: { id: params.partyId },
    select: { hostPlayerId: true, status: true, pauseStartedAt: true, pausedMs: true },
  });

  if (!party || party.hostPlayerId !== player.id) {
    return NextResponse.json({ ok: false, error: "Host only" }, { status: 403 });
  }

  if (party.status !== "ACTIVE") {
    return NextResponse.json({ ok: false, error: "Party not active" }, { status: 400 });
  }

  if (!party.pauseStartedAt) {
    return NextResponse.json({ ok: true });
  }

  const pauseMs = Date.now() - new Date(party.pauseStartedAt).getTime();
  const nextPausedMs = Math.max(0, (party.pausedMs ?? 0) + pauseMs);

  await prisma.party.update({
    where: { id: params.partyId },
    data: { pauseStartedAt: null, pausedMs: nextPausedMs },
  });
  await markPartyEvent(params.partyId);

  return NextResponse.json({ ok: true });
}
