import { PartyMode } from "@prisma/client";

import prisma from "@/lib/prisma";
import { HOST_INACTIVE_MS } from "@/lib/studyhall/constants";
import { getPartyEventStamp, markPartyEvent } from "@/lib/studyhall/partyEvents";
import { computeTimerState } from "@/lib/studyhall/timer";

type PartyStateResult =
  | { ok: true; data: PartyStatePayload }
  | { ok: false; status: number; error: string };

type PartyStatePayload = {
  ok: true;
  party: {
    id: string;
    status: "LOBBY" | "ACTIVE" | "COMPLETE";
    mode: PartyMode;
    joinCode: string;
    hostPlayerId: string | null;
    currentQuestionIndex: number;
    questionStartedAt: string | null;
    answerRevealedAt: string | null;
    timeRemainingMs: number;
    questionDurationSec: number;
    joinLocked: boolean;
    isPaused: boolean;
  };
  deck: {
    title: string;
    totalQuestions: number;
    totalFlashcards: number;
    deckId?: string;
  };
  question: { id: string; prompt: string; choices: string[]; order: number } | null;
  flashcard: { id: string; front: string; back: string; order: number } | null;
  player: {
    id: string;
    name: string;
    score: number;
    bonusScore: number;
    totalScore: number;
    avatarId: string | null;
    isHost: boolean;
    hasSubmitted: boolean;
    submission: {
      isCorrect?: boolean;
      answerIndex?: number;
      knewIt?: boolean;
      timeMs?: number | null;
    } | null;
  } | null;
  players: Array<{
    id: string;
    name: string;
    score: number;
    bonusScore: number;
    totalScore: number;
    avatarId: string | null;
    isHost: boolean;
    isActive: boolean;
  }>;
  distribution: number[] | null;
  flashcardStats: { knewIt: number; missed: number } | null;
  correctIndex: number | null;
  revealedCorrectIndex: number | null;
  results: PartyResults | null;
};

type PartyResults = {
  mode: PartyMode;
  totalItems: number;
  bonusPointValue: number;
  players: Array<{
    id: string;
    name: string;
    avatarId: string | null;
    score: number;
    bonusScore: number;
    totalScore: number;
    accuracy: number;
    correctCount: number;
    totalAnswered: number;
    avgTimeMs: number | null;
    fastestCount: number;
    knewItCount?: number;
  }>;
  questions: Array<{
    id: string;
    order: number;
    prompt: string;
    correctIndex: number;
    distribution: number[];
    correctCount: number;
    totalCount: number;
    fastestPlayerId: string | null;
    fastestTimeMs: number | null;
  }>;
  flashcards: Array<{
    id: string;
    order: number;
    front: string;
    back: string;
    knewItCount: number;
    missedCount: number;
    totalCount: number;
  }>;
};

const BONUS_POINT_VALUE = 1;
const STATE_CACHE_TTL_MS = 10_000;
const PLAYER_TOUCH_INTERVAL_MS = 15_000;
const stateCache = new Map<string, { expiresAt: number; stamp: number; data: PartyStateResult }>();

function stateCacheKey(partyId: string, playerToken?: string | null) {
  return `${partyId}:${playerToken || "anon"}`;
}

export async function buildPartyState(partyId: string, playerToken?: string | null): Promise<PartyStateResult> {
  const now = new Date();
  const cacheKey = stateCacheKey(partyId, playerToken);
  let eventStamp = await getPartyEventStamp(partyId);
  const cached = stateCache.get(cacheKey);
  if (cached && cached.expiresAt > now.getTime() && cached.stamp === eventStamp) {
    return cached.data;
  }

  const party = await prisma.party.findUnique({
    where: { id: partyId },
    include: {
      deck: { include: { questions: true, flashcards: true } },
      players: true,
    },
  });

  if (!party) {
    return { ok: false, status: 404, error: "Party not found" };
  }

  let player = null as null | (typeof party.players)[number];

  if (playerToken) {
    const found = await prisma.partyPlayer.findUnique({
      where: { playerToken },
    });
    if (found && found.partyId === party.id) {
      if (found.kickedAt) {
        return { ok: false, status: 403, error: "You were removed from this party." };
      }
      player = found;
      const lastSeenAtMs = found.lastSeenAt?.getTime() ?? 0;
      if (!lastSeenAtMs || now.getTime() - lastSeenAtMs > PLAYER_TOUCH_INTERVAL_MS) {
        await prisma.partyPlayer.update({
          where: { id: found.id },
          data: { lastSeenAt: now },
        });
      }
    }
  }

  let hostPlayerId = party.hostPlayerId;
  const visiblePlayers = party.players
    .filter((p) => !p.leftAt && !p.kickedAt)
    .map((p) => (player && p.id === player.id ? { ...p, lastSeenAt: now } : p));
  const activePlayers = visiblePlayers.filter(
    (p) => now.getTime() - p.lastSeenAt.getTime() < HOST_INACTIVE_MS
  );

  const currentHost = hostPlayerId
    ? visiblePlayers.find((p) => p.id === hostPlayerId)
    : null;

  if (!currentHost || now.getTime() - currentHost.lastSeenAt.getTime() > HOST_INACTIVE_MS) {
    const nextHost = [...activePlayers].sort(
      (a, b) => a.joinedAt.getTime() - b.joinedAt.getTime()
    )[0];
    if (nextHost && nextHost.id !== hostPlayerId) {
      hostPlayerId = nextHost.id;
      await prisma.party.update({
        where: { id: party.id },
        data: { hostPlayerId },
      });
    }
  }

  const questions = [...party.deck.questions].sort((a, b) => a.order - b.order);
  const flashcards = [...party.deck.flashcards].sort((a, b) => a.order - b.order);
  const mode = party.mode as PartyMode;

  const currentQuestion = mode === PartyMode.QUIZ ? questions[party.currentQuestionIndex] || null : null;
  const currentFlashcard = mode === PartyMode.FLASHCARDS ? flashcards[party.currentQuestionIndex] || null : null;
  let answerRevealedAt = party.answerRevealedAt;
  let revealedCorrectIndex = null as number | null;

  let distribution: number[] | null = null;
  let flashcardStats: { knewIt: number; missed: number } | null = null;
  let playerSubmission = null as null | {
    isCorrect?: boolean;
    answerIndex?: number;
    knewIt?: boolean;
    timeMs?: number | null;
  };

  if (currentQuestion) {
    if (player) {
      const submission = await prisma.partySubmission.findUnique({
        where: {
          partyPlayerId_questionId: {
            partyPlayerId: player.id,
            questionId: currentQuestion.id,
          },
        },
      });
      if (submission) {
        playerSubmission = {
          isCorrect: submission.isCorrect,
          answerIndex: submission.answerIndex,
          timeMs: submission.timeMs,
        };
      }
    }

    if (hostPlayerId && player && player.id === hostPlayerId) {
      const submissions = await prisma.partySubmission.findMany({
        where: { partyId: party.id, questionId: currentQuestion.id },
        select: { answerIndex: true },
      });
      distribution = Array.from({ length: currentQuestion.choices.length }, () => 0);
      for (const sub of submissions) {
        if (sub.answerIndex >= 0 && sub.answerIndex < distribution.length) {
          distribution[sub.answerIndex] += 1;
        }
      }
    }
  }

  if (currentFlashcard) {
    if (player) {
      const submission = await prisma.partyFlashcardSubmission.findUnique({
        where: {
          partyPlayerId_flashcardId: {
            partyPlayerId: player.id,
            flashcardId: currentFlashcard.id,
          },
        },
      });
      if (submission) {
        playerSubmission = {
          knewIt: submission.knewIt,
          timeMs: submission.timeMs,
        };
      }
    }

    if (hostPlayerId && player && player.id === hostPlayerId) {
      const submissions = await prisma.partyFlashcardSubmission.findMany({
        where: { partyId: party.id, flashcardId: currentFlashcard.id },
        select: { knewIt: true },
      });
      let knewIt = 0;
      let missed = 0;
      for (const sub of submissions) {
        if (sub.knewIt) {
          knewIt += 1;
        } else {
          missed += 1;
        }
      }
      flashcardStats = { knewIt, missed };
    }
  }

  const timerState = computeTimerState({
    questionStartedAt: party.questionStartedAt,
    pauseStartedAt: party.pauseStartedAt,
    pausedMs: party.pausedMs,
    questionDurationSec: party.questionDurationSec,
  }, now);

  if (party.status === "ACTIVE" && mode === PartyMode.QUIZ && currentQuestion && !answerRevealedAt) {
    const timeExpired = timerState.timeRemainingMs <= 0;
    let allAnswered = false;
    if (!timeExpired) {
      const eligiblePlayerIds = activePlayers.map((p) => p.id);
      if (eligiblePlayerIds.length > 0) {
        const submissionCount = await prisma.partySubmission.count({
          where: {
            partyId: party.id,
            questionId: currentQuestion.id,
            partyPlayerId: { in: eligiblePlayerIds },
          },
        });
        allAnswered = submissionCount >= eligiblePlayerIds.length;
      }
    }
    if (timeExpired || allAnswered) {
      const revealTime = new Date();
      const updated = await prisma.party.updateMany({
        where: { id: party.id, answerRevealedAt: null },
        data: { answerRevealedAt: revealTime },
      });
      answerRevealedAt = revealTime;
      if (updated.count > 0) {
        eventStamp = await markPartyEvent(party.id);
      }
    }
  }

  revealedCorrectIndex =
    mode === PartyMode.QUIZ && answerRevealedAt && currentQuestion
      ? currentQuestion.correctIndex
      : null;

  const players = visiblePlayers
    .map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      bonusScore: p.bonusScore,
      totalScore: p.score + p.bonusScore,
      avatarId: p.avatarId,
      isHost: hostPlayerId === p.id,
      isActive: now.getTime() - p.lastSeenAt.getTime() < HOST_INACTIVE_MS,
    }))
    .sort((a, b) => b.totalScore - a.totalScore || a.name.localeCompare(b.name));

  const results = party.status === "COMPLETE"
    ? await buildResults({ partyId: party.id, mode, players: visiblePlayers, questions, flashcards })
    : null;

  const result: PartyStateResult = {
    ok: true,
    data: {
      ok: true,
      party: {
        id: party.id,
        status: party.status,
        mode,
        joinCode: party.joinCode,
        hostPlayerId,
        currentQuestionIndex: party.currentQuestionIndex,
        questionStartedAt: party.questionStartedAt ? party.questionStartedAt.toISOString() : null,
        answerRevealedAt: answerRevealedAt ? answerRevealedAt.toISOString() : null,
        timeRemainingMs: timerState.timeRemainingMs,
        questionDurationSec: timerState.durationSec,
        joinLocked: party.joinLocked,
        isPaused: timerState.isPaused,
      },
      deck: {
        title: party.deck.title,
        totalQuestions: questions.length,
        totalFlashcards: flashcards.length,
        deckId: party.deckId,
      },
      question: currentQuestion
        ? {
            id: currentQuestion.id,
            prompt: currentQuestion.prompt,
            choices: currentQuestion.choices,
            order: currentQuestion.order,
          }
        : null,
      flashcard: currentFlashcard
        ? {
            id: currentFlashcard.id,
            front: currentFlashcard.front,
            back: currentFlashcard.back,
            order: currentFlashcard.order,
          }
        : null,
      player: player
        ? {
            id: player.id,
            name: player.name,
            score: player.score,
            bonusScore: player.bonusScore,
            totalScore: player.score + player.bonusScore,
            avatarId: player.avatarId,
            isHost: hostPlayerId === player.id,
            hasSubmitted: Boolean(playerSubmission),
            submission: playerSubmission,
          }
        : null,
      players,
      distribution,
      flashcardStats,
      correctIndex:
        currentQuestion &&
        answerRevealedAt &&
        hostPlayerId &&
        player &&
        player.id === hostPlayerId
          ? currentQuestion.correctIndex
          : null,
      revealedCorrectIndex,
      results,
    },
  };

  stateCache.set(cacheKey, {
    data: result,
    stamp: eventStamp,
    expiresAt: now.getTime() + STATE_CACHE_TTL_MS,
  });

  return result;
}

async function buildResults({
  partyId,
  mode,
  players,
  questions,
  flashcards,
}: {
  partyId: string;
  mode: PartyMode;
  players: Array<{ id: string; name: string; avatarId: string | null; score: number; bonusScore: number }>;
  questions: Array<{ id: string; order: number; prompt: string; correctIndex: number; choices: string[] }>;
  flashcards: Array<{ id: string; order: number; front: string; back: string }>;
}): Promise<PartyResults> {
  const playerStats = new Map<string, {
    id: string;
    name: string;
    avatarId: string | null;
    score: number;
    bonusScore: number;
    totalScore: number;
    correctCount: number;
    totalAnswered: number;
    totalTimeMs: number;
    fastestCount: number;
    knewItCount: number;
  }>();

  for (const player of players) {
    playerStats.set(player.id, {
      id: player.id,
      name: player.name,
      avatarId: player.avatarId,
      score: player.score,
      bonusScore: player.bonusScore,
      totalScore: player.score + player.bonusScore,
      correctCount: 0,
      totalAnswered: 0,
      totalTimeMs: 0,
      fastestCount: 0,
      knewItCount: 0,
    });
  }

  const questionStats = questions.map((question) => ({
    id: question.id,
    order: question.order,
    prompt: question.prompt,
    correctIndex: question.correctIndex,
    distribution: Array.from({ length: question.choices.length }, () => 0),
    correctCount: 0,
    totalCount: 0,
    fastestPlayerId: null as string | null,
    fastestTimeMs: null as number | null,
  }));
  const questionMap = new Map(questionStats.map((q) => [q.id, q]));

  const flashcardStats = flashcards.map((card) => ({
    id: card.id,
    order: card.order,
    front: card.front,
    back: card.back,
    knewItCount: 0,
    missedCount: 0,
    totalCount: 0,
  }));
  const flashcardMap = new Map(flashcardStats.map((c) => [c.id, c]));

  if (mode === PartyMode.QUIZ) {
    const submissions = await prisma.partySubmission.findMany({
      where: { partyId },
      select: { questionId: true, partyPlayerId: true, isCorrect: true, answerIndex: true, timeMs: true },
    });

    for (const submission of submissions) {
      const question = questionMap.get(submission.questionId);
      if (question) {
        question.totalCount += 1;
        if (submission.answerIndex >= 0 && submission.answerIndex < question.distribution.length) {
          question.distribution[submission.answerIndex] += 1;
        }
        if (submission.isCorrect) {
          question.correctCount += 1;
          if (submission.timeMs !== null) {
            if (question.fastestTimeMs === null || submission.timeMs < question.fastestTimeMs) {
              question.fastestTimeMs = submission.timeMs;
              question.fastestPlayerId = submission.partyPlayerId;
            }
          }
        }
      }

      const stats = playerStats.get(submission.partyPlayerId);
      if (stats) {
        stats.totalAnswered += 1;
        if (submission.isCorrect) {
          stats.correctCount += 1;
        }
        if (typeof submission.timeMs === "number") {
          stats.totalTimeMs += submission.timeMs;
        }
      }
    }

    for (const question of questionStats) {
      if (!question.fastestPlayerId) continue;
      const stats = playerStats.get(question.fastestPlayerId);
      if (stats) {
        stats.fastestCount += 1;
      }
    }
  }

  if (mode === PartyMode.FLASHCARDS) {
    const submissions = await prisma.partyFlashcardSubmission.findMany({
      where: { partyId },
      select: { flashcardId: true, partyPlayerId: true, knewIt: true, timeMs: true },
    });

    for (const submission of submissions) {
      const card = flashcardMap.get(submission.flashcardId);
      if (card) {
        card.totalCount += 1;
        if (submission.knewIt) {
          card.knewItCount += 1;
        } else {
          card.missedCount += 1;
        }
      }

      const stats = playerStats.get(submission.partyPlayerId);
      if (stats) {
        stats.totalAnswered += 1;
        if (submission.knewIt) {
          stats.knewItCount += 1;
          stats.correctCount += 1;
        }
        if (typeof submission.timeMs === "number") {
          stats.totalTimeMs += submission.timeMs;
        }
      }
    }
  }

  const playersOut = [...playerStats.values()].map((stats) => {
    const avgTimeMs = stats.totalAnswered > 0 ? Math.round(stats.totalTimeMs / stats.totalAnswered) : null;
    const accuracy = stats.totalAnswered > 0 ? stats.correctCount / stats.totalAnswered : 0;
    return {
      id: stats.id,
      name: stats.name,
      avatarId: stats.avatarId,
      score: stats.score,
      bonusScore: stats.bonusScore,
      totalScore: stats.totalScore,
      accuracy,
      correctCount: stats.correctCount,
      totalAnswered: stats.totalAnswered,
      avgTimeMs,
      fastestCount: stats.fastestCount,
      ...(mode === PartyMode.FLASHCARDS ? { knewItCount: stats.knewItCount } : {}),
    };
  }).sort((a, b) => b.totalScore - a.totalScore || a.name.localeCompare(b.name));

  return {
    mode,
    totalItems: mode === PartyMode.QUIZ ? questions.length : flashcards.length,
    bonusPointValue: BONUS_POINT_VALUE,
    players: playersOut,
    questions: questionStats,
    flashcards: flashcardStats,
  };
}
