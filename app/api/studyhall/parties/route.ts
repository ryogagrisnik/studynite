import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  PARTY_RETENTION_DAYS,
  PARTY_MAX_PLAYERS,
  QUESTION_SECONDS,
} from "@/lib/studyhall/constants";
import { resolveAvatarId } from "@/lib/studyhall/avatars";
import { markPartyEvent } from "@/lib/studyhall/partyEvents";
import { generateJoinCode, generateShareId } from "@/lib/studyhall/utils";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let payload: {
    deckId?: string;
    hostName?: string;
    avatarId?: string;
    mode?: "QUIZ" | "FLASHCARDS";
  } = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  if (!payload.deckId) {
    return NextResponse.json({ ok: false, error: "Missing deckId" }, { status: 400 });
  }

  const deck = await prisma.studyDeck.findUnique({
    where: { id: payload.deckId },
    select: {
      id: true,
      userId: true,
      _count: { select: { questions: true, flashcards: true } },
    },
  });

  if (!deck || deck.userId !== userId) {
    return NextResponse.json({ ok: false, error: "Deck not found" }, { status: 404 });
  }

  const mode = "QUIZ";

  if (deck._count.questions === 0) {
    return NextResponse.json({ ok: false, error: "Deck has no quiz questions" }, { status: 400 });
  }

  const joinCode = await createUniqueJoinCode();
  const playerToken = generateShareId(18);
  const hostName = (payload.hostName || (session?.user as any)?.name || (session?.user as any)?.email || "Host")
    .trim()
    .slice(0, 24);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { avatarId: true } });
  const avatarId = resolveAvatarId(payload.avatarId ?? user?.avatarId ?? null);
  const expiresAt = new Date(Date.now() + PARTY_RETENTION_DAYS * 86_400_000);

  const result = await prisma.$transaction(async (tx) => {
    const party = await tx.party.create({
      data: {
        deckId: deck.id,
        joinCode,
        hostUserId: userId,
        expiresAt,
        mode,
        isPublic: false,
        questionDurationSec: QUESTION_SECONDS,
      },
    });

    const hostPlayer = await tx.partyPlayer.create({
      data: {
        partyId: party.id,
        name: hostName,
        playerToken,
        avatarId,
        userId,
      },
    });

    const updatedParty = await tx.party.update({
      where: { id: party.id },
      data: { hostPlayerId: hostPlayer.id },
    });

    return { party: updatedParty, hostPlayer };
  });
  await markPartyEvent(result.party.id);

  return NextResponse.json({
    ok: true,
    partyId: result.party.id,
    joinCode: result.party.joinCode,
    playerToken: result.hostPlayer.playerToken,
    playerId: result.hostPlayer.id,
    maxPlayers: PARTY_MAX_PLAYERS,
  });
}

async function createUniqueJoinCode() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generateJoinCode();
    const existing = await prisma.party.findUnique({ where: { joinCode: code } });
    if (!existing) return code;
  }
  throw new Error("Unable to generate unique join code.");
}
