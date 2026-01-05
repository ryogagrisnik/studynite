import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasActiveProSession } from "@/lib/server/membership";
import { generateStudyDeck } from "@/lib/studyhall/generator";
import {
  DEFAULT_QUESTION_COUNT,
  FREE_REGENERATE_LIMIT,
  PRO_REGENERATE_LIMIT,
} from "@/lib/studyhall/constants";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { deckId: string } }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const deck = await prisma.studyDeck.findUnique({
    where: { id: params.deckId },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!deck || deck.userId !== userId) {
    return NextResponse.json({ ok: false, error: "Quiz not found" }, { status: 404 });
  }

  if (!deck.sourceText?.trim()) {
    return NextResponse.json(
      { ok: false, error: "This quiz cannot be regenerated without the original source text." },
      { status: 400 }
    );
  }

  const isPro = hasActiveProSession(session);
  const limit = isPro ? PRO_REGENERATE_LIMIT : FREE_REGENERATE_LIMIT;
  if ((deck.regenerateCount ?? 0) >= limit) {
    return NextResponse.json(
      { ok: false, error: "Regeneration limit reached for this quiz." },
      { status: 429 }
    );
  }

  const questionCount = deck.questions.length || DEFAULT_QUESTION_COUNT;

  try {
    const generated = await generateStudyDeck({
      sourceText: deck.sourceText,
      title: deck.title,
      questionCount,
      flashcardCount: 0,
      includeQuestions: true,
      includeFlashcards: false,
      includeExplanations: isPro,
    });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.studyQuestion.deleteMany({ where: { deckId: deck.id } });
      const next = await tx.studyDeck.update({
        where: { id: deck.id },
        data: {
          regenerateCount: (deck.regenerateCount ?? 0) + 1,
          lastRegeneratedAt: new Date(),
          questions: {
            create: generated.questions.map((question, index) => ({
              order: index + 1,
              prompt: question.prompt,
              choices: question.choices,
              correctIndex: question.correctIndex,
              explanation: question.explanation ?? null,
            })),
          },
        },
        include: { questions: { orderBy: { order: "asc" } } },
      });
      return next;
    });

    return NextResponse.json({
      ok: true,
      regenerateCount: updated.regenerateCount,
      questions: updated.questions.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        choices: q.choices,
        correctIndex: q.correctIndex,
        explanation: q.explanation ?? "",
        order: q.order,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Unable to regenerate quiz." },
      { status: 400 }
    );
  }
}
