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
    include: { deck: { select: { questions: true, flashcards: true } } },
  });

  if (!party || party.hostPlayerId !== player.id) {
    return NextResponse.json({ ok: false, error: "Host only" }, { status: 403 });
  }

  if (party.status !== "LOBBY") {
    return NextResponse.json({ ok: true });
  }

  const items = party.mode === "FLASHCARDS" ? party.deck.flashcards : party.deck.questions;
  if (items.length === 0) {
    return NextResponse.json({ ok: false, error: "Party has no items to run" }, { status: 400 });
  }

  await prisma.party.update({
    where: { id: params.partyId },
    data: {
      status: "ACTIVE",
      currentQuestionIndex: 0,
      questionStartedAt: new Date(),
      answerRevealedAt: null,
      pauseStartedAt: null,
      pausedMs: 0,
    },
  });
  await markPartyEvent(params.partyId);

  return NextResponse.json({ ok: true });
}
