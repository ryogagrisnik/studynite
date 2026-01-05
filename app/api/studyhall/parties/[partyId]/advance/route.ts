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

  if (party.status !== "ACTIVE") {
    return NextResponse.json({ ok: false, error: "Party not active" }, { status: 400 });
  }

  const items = party.mode === "FLASHCARDS" ? party.deck.flashcards : party.deck.questions;
  const totalItems = items.length;
  const nextIndex = party.currentQuestionIndex + 1;

  if (party.mode === "FLASHCARDS" && totalItems === 0) {
    return NextResponse.json({ ok: false, error: "No flashcards in this quiz" }, { status: 400 });
  }

  if (party.mode === "QUIZ" && totalItems === 0) {
    return NextResponse.json({ ok: false, error: "No quiz questions in this quiz" }, { status: 400 });
  }

  if (party.mode === "QUIZ") {
    const currentQuestion = party.deck.questions.find(
      (question) => question.order === party.currentQuestionIndex + 1
    );
    if (currentQuestion) {
      const fastest = await prisma.partySubmission.findFirst({
        where: {
          partyId: party.id,
          questionId: currentQuestion.id,
          isCorrect: true,
          timeMs: { not: null },
        },
        orderBy: { timeMs: "asc" },
      });
      if (fastest) {
        await prisma.partyPlayer.update({
          where: { id: fastest.partyPlayerId },
          data: { bonusScore: { increment: 1 } },
        });
      }
    }
  }

  if (nextIndex >= totalItems) {
    await prisma.party.update({
      where: { id: party.id },
      data: {
        status: "COMPLETE",
        endedAt: new Date(),
        questionStartedAt: null,
        answerRevealedAt: null,
        pauseStartedAt: null,
        pausedMs: 0,
      },
    });
    await markPartyEvent(party.id);
    return NextResponse.json({ ok: true, completed: true });
  }

  await prisma.party.update({
    where: { id: party.id },
    data: {
      currentQuestionIndex: nextIndex,
      questionStartedAt: new Date(),
      answerRevealedAt: null,
      pauseStartedAt: null,
      pausedMs: 0,
    },
  });
  await markPartyEvent(party.id);

  return NextResponse.json({ ok: true });
}
