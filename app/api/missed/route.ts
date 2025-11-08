export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizeQuestionPayload } from "@/lib/normalizeQuestionPayload";
import type { QuestionPayload } from "@/lib/types/question";
import { isMissedQuestionTableMissing } from "@/lib/server/missedTableGuard";

function toQuestionPayload(question: {
  id: string;
  exam: string;
  section: string;
  topic: string | null;
  stem: string;
  choices: string[];
  answer: string;
  explanation: string;
  difficulty: number;
}): QuestionPayload {
  const normalize = (value: string) =>
    value
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const choices = Array.isArray(question.choices) ? question.choices : [];
  const options = choices.map((choice, idx) => ({
    id: `${question.id}-${idx}`,
    html: choice ?? `Option ${idx + 1}`,
  }));

  const answer = (question.answer ?? "").toString();
  const target = normalize(answer);
  const correctIdx =
    choices.findIndex((choice) => normalize(choice ?? "") === target) ?? -1;
  const fallbackIdx = Number.isInteger(correctIdx) && correctIdx >= 0 ? correctIdx : 0;

  const raw = {
    question: {
      id: question.id,
      exam: (question.exam || "GRE") as "GRE" | "GMAT",
      section: (question.section || "Quant") as "Quant" | "Verbal",
      mode: "topic" as const,
      topic: question.topic ?? undefined,
      difficulty: String(question.difficulty ?? ""),
      stemHTML: question.stem,
      options,
      correct: [fallbackIdx],
      explainHTML: question.explanation,
      badge: `${question.exam} · ${question.section}`,
    },
  };

  return normalizeQuestionPayload(raw);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  try {
    const records = await prisma.missedQuestion.findMany({
      where: { userId, clearedAt: null },
      orderBy: [
        { lastMissedAt: "desc" },
        { createdAt: "desc" },
      ],
      include: {
        question: {
          select: {
            id: true,
            exam: true,
            section: true,
            topic: true,
            stem: true,
            choices: true,
            answer: true,
            explanation: true,
            difficulty: true,
          },
        },
      },
    });

    const missed = records
      .map((record) => {
        if (!record.question) return null;
        const question = toQuestionPayload(record.question);
        return {
          id: record.questionId,
          question,
          lastMissedAt: record.lastMissedAt.toISOString(),
          exam: record.question.exam,
          section: record.question.section,
          topic: record.question.topic,
          attempts: record.totalMisses,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    return NextResponse.json({ missed }, { status: 200 });
  } catch (error) {
    if (isMissedQuestionTableMissing(error)) {
      console.warn(
        "[missed] MissedQuestion table not found – returning empty response. Apply the latest migration to enable this feature."
      );
      return NextResponse.json({ missed: [], missingTable: true }, { status: 200 });
    }
    console.error("[missed] failed to load records", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
