import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isMissedQuestionTableMissing } from "@/lib/server/missedTableGuard";

const Body = z.object({
  questionId: z.string(),
  userAnswer: z.string().optional(),
  isCorrect: z.boolean(),
  timeMs: z.number().int().min(0).max(1000 * 60 * 60).optional(),
  conceptOverride: z.string().optional(),
});

function clampTime(ms?: number) {
  if (typeof ms !== "number" || Number.isNaN(ms)) return 0;
  return Math.min(Math.max(ms, 0), 1000 * 60 * 60);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { questionId, userAnswer = "", isCorrect, timeMs, conceptOverride } = parsed.data;
  const durationMs = clampTime(timeMs);
  const now = new Date();

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { topic: true },
  });

  if (!question) {
    return NextResponse.json({ ok: false, missingQuestion: true }, { status: 200 });
  }

  const concept = conceptOverride?.trim() || question.topic || null;

  await prisma.attempt.upsert({
    where: { userId_questionId: { userId, questionId } },
    create: {
      userId,
      questionId,
      userAnswer: userAnswer.slice(0, 500),
      isCorrect,
      timeMs: durationMs,
      concept,
    },
    update: {
      userAnswer: userAnswer.slice(0, 500),
      isCorrect,
      timeMs: durationMs,
      concept,
    },
  });

  try {
    if (!isCorrect) {
      await prisma.missedQuestion.upsert({
        where: { userId_questionId: { userId, questionId } },
        create: {
          userId,
          questionId,
          totalMisses: 1,
          lastMissedAt: now,
          lastServedAt: null,
        },
        update: {
          totalMisses: { increment: 1 },
          lastMissedAt: now,
          lastServedAt: null,
          clearedAt: null,
        },
      });
    } else {
      await prisma.missedQuestion.updateMany({
        where: { userId, questionId, clearedAt: null },
        data: { clearedAt: now },
      });
    }
  } catch (error) {
    if (isMissedQuestionTableMissing(error)) {
      console.warn(
        "[attempt] MissedQuestion table not found – skipping miss tracking. Apply the latest migration to enable this feature."
      );
    } else {
      throw error;
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
