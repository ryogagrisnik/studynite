import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { computeTimerState } from "@/lib/studyhall/timer";
import { markPartyEvent } from "@/lib/studyhall/partyEvents";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { partyId: string } }) {
  let payload: {
    playerToken?: string;
    questionId?: string;
    answerIndex?: number;
    flashcardId?: string;
    knewIt?: boolean;
  } = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  if (!payload.playerToken) {
    return NextResponse.json({ ok: false, error: "Missing data" }, { status: 400 });
  }

  const player = await prisma.partyPlayer.findUnique({
    where: { playerToken: payload.playerToken },
  });

  if (!player || player.partyId !== params.partyId) {
    return NextResponse.json({ ok: false, error: "Player not found" }, { status: 404 });
  }
  if (player.kickedAt) {
    return NextResponse.json({ ok: false, error: "Removed from party" }, { status: 403 });
  }

  const party = await prisma.party.findUnique({
    where: { id: params.partyId },
    select: {
      status: true,
      deckId: true,
      mode: true,
      questionStartedAt: true,
      answerRevealedAt: true,
      pauseStartedAt: true,
      pausedMs: true,
      questionDurationSec: true,
      currentQuestionIndex: true,
    },
  });

  if (!party || party.status !== "ACTIVE") {
    return NextResponse.json({ ok: false, error: "Party not active" }, { status: 400 });
  }

  const timerState = computeTimerState({
    questionStartedAt: party.questionStartedAt,
    pauseStartedAt: party.pauseStartedAt,
    pausedMs: party.pausedMs,
    questionDurationSec: party.questionDurationSec,
  }, new Date());

  if (party.mode === "QUIZ") {
    if (timerState.isPaused) {
      return NextResponse.json({ ok: false, error: "Timer paused" }, { status: 400 });
    }
    if (timerState.timeRemainingMs <= 0) {
      return NextResponse.json({ ok: false, error: "Time expired" }, { status: 400 });
    }
  }

  if (party.mode === "QUIZ") {
    if (party.answerRevealedAt) {
      return NextResponse.json({ ok: false, error: "Answer revealed" }, { status: 400 });
    }
    if (!payload.questionId) {
      return NextResponse.json({ ok: false, error: "Missing question" }, { status: 400 });
    }

    const existing = await prisma.partySubmission.findUnique({
      where: {
        partyPlayerId_questionId: {
          partyPlayerId: player.id,
          questionId: payload.questionId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ ok: true, locked: true });
    }

    const currentQuestion = await prisma.studyQuestion.findFirst({
      where: { deckId: party.deckId, order: party.currentQuestionIndex + 1 },
      select: { id: true, correctIndex: true, choices: true },
    });

    if (!currentQuestion || currentQuestion.id !== payload.questionId) {
      return NextResponse.json({ ok: false, error: "Not the active question" }, { status: 400 });
    }

    const maxIndex = Math.max(0, currentQuestion.choices.length - 1);
    const answerIndex = Number.isFinite(payload.answerIndex)
      ? Math.max(0, Math.min(maxIndex, payload.answerIndex as number))
      : 0;
    const isCorrect = answerIndex === currentQuestion.correctIndex;
    const timeMs = party.questionStartedAt ? timerState.elapsedMs : null;

    await prisma.$transaction([
      prisma.partySubmission.create({
        data: {
          partyId: params.partyId,
          partyPlayerId: player.id,
          questionId: payload.questionId,
          answerIndex,
          isCorrect,
          timeMs,
        },
      }),
      prisma.partyPlayer.update({
        where: { id: player.id },
        data: { score: { increment: isCorrect ? 1 : 0 } },
      }),
    ]);
    if (!party.answerRevealedAt) {
      const playerCount = await prisma.partyPlayer.count({
        where: { partyId: params.partyId, leftAt: null, kickedAt: null },
      });
      if (playerCount > 0) {
        const submissionCount = await prisma.partySubmission.count({
          where: { partyId: params.partyId, questionId: payload.questionId },
        });
        if (submissionCount >= playerCount) {
          await prisma.party.updateMany({
            where: { id: params.partyId, answerRevealedAt: null },
            data: { answerRevealedAt: new Date() },
          });
        }
      }
    }
    await markPartyEvent(params.partyId);

    return NextResponse.json({ ok: true, locked: true });
  }

  if (!payload.flashcardId) {
    return NextResponse.json({ ok: false, error: "Missing flashcard" }, { status: 400 });
  }

  if (!party.answerRevealedAt) {
    return NextResponse.json({ ok: false, error: "Answer not revealed yet" }, { status: 400 });
  }

  const existingFlashcard = await prisma.partyFlashcardSubmission.findUnique({
    where: {
      partyPlayerId_flashcardId: {
        partyPlayerId: player.id,
        flashcardId: payload.flashcardId,
      },
    },
  });

  if (existingFlashcard) {
    return NextResponse.json({ ok: true, locked: true });
  }

  const currentFlashcard = await prisma.studyFlashcard.findFirst({
    where: { deckId: party.deckId, order: party.currentQuestionIndex + 1 },
    select: { id: true },
  });

  if (!currentFlashcard || currentFlashcard.id !== payload.flashcardId) {
    return NextResponse.json({ ok: false, error: "Not the active flashcard" }, { status: 400 });
  }

  const knewIt = Boolean(payload.knewIt);
  const timeMs = party.answerRevealedAt
    ? Math.max(0, Date.now() - new Date(party.answerRevealedAt).getTime())
    : null;

  await prisma.$transaction([
    prisma.partyFlashcardSubmission.create({
      data: {
        partyId: params.partyId,
        partyPlayerId: player.id,
        flashcardId: payload.flashcardId,
        knewIt,
        timeMs,
      },
    }),
    prisma.partyPlayer.update({
      where: { id: player.id },
      data: { score: { increment: knewIt ? 1 : 0 } },
    }),
  ]);
  await markPartyEvent(params.partyId);

  return NextResponse.json({ ok: true, locked: true });
}
