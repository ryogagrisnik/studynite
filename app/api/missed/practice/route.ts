export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { QuestionPayload } from "@/lib/types/question";
import { normalizeQuestionPayload } from "@/lib/normalizeQuestionPayload";
import { isMissedQuestionTableMissing } from "@/lib/server/missedTableGuard";

const Body = z.object({
  groupKey: z.string().min(3),
  excludeQuestionId: z.string().optional(),
});

type GroupFilter =
  | { kind: "exam"; exam: string }
  | { kind: "section"; exam: string; section: string }
  | { kind: "topic"; exam: string; section: string; topic: string | null };

function parseGroupKey(raw: string): GroupFilter | null {
  const parts = raw.split("|");
  if (!parts.length) return null;
  const kind = parts[0];
  if (kind === "exam" && parts.length >= 2) {
    return { kind: "exam", exam: decodeURIComponent(parts[1]!) };
  }
  if (kind === "section" && parts.length >= 3) {
    return {
      kind: "section",
      exam: decodeURIComponent(parts[1]!),
      section: decodeURIComponent(parts[2]!),
    };
  }
  if (kind === "topic" && parts.length >= 4) {
    const topicRaw = decodeURIComponent(parts.slice(3).join("|"));
    const topic = topicRaw === "__general__" ? null : topicRaw;
    return {
      kind: "topic",
      exam: decodeURIComponent(parts[1]!),
      section: decodeURIComponent(parts[2]!),
      topic,
    };
  }
  return null;
}

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
  const correctIdx = choices.findIndex(
    (choice) => normalize(choice ?? "") === target
  );
  const fallbackIdx = correctIdx >= 0 ? correctIdx : 0;

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

export async function POST(req: Request) {
  try {
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

    const { groupKey, excludeQuestionId } = parsed.data;
    const filter = parseGroupKey(groupKey);
    if (!filter) {
      return NextResponse.json({ error: "INVALID_GROUP" }, { status: 400 });
    }

    const where: Prisma.MissedQuestionWhereInput = {
      userId,
      clearedAt: null,
    };

    if (excludeQuestionId) {
      where.questionId = { not: excludeQuestionId };
    }

    const questionFilter: Prisma.QuestionWhereInput = {};
    if (filter.kind === "exam") {
      questionFilter.exam = filter.exam;
    } else if (filter.kind === "section") {
      questionFilter.exam = filter.exam;
      questionFilter.section = filter.section;
    } else if (filter.kind === "topic") {
      questionFilter.exam = filter.exam;
      questionFilter.section = filter.section;
      questionFilter.topic = filter.topic ?? null;
    }

    if (Object.keys(questionFilter).length > 0) {
      where.question = questionFilter;
    }

    const record = await prisma.missedQuestion.findFirst({
      where,
      orderBy: [
        { lastServedAt: "asc" },
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

    if (!record || !record.question) {
      return NextResponse.json({ empty: true }, { status: 200 });
    }

    const payload = toQuestionPayload(record.question);
    const reviewMeta = {
      groupKey,
      attempts: record.totalMisses,
      lastMissedAt: record.lastMissedAt.toISOString(),
    };

    await prisma.missedQuestion.update({
      where: { userId_questionId: { userId, questionId: record.questionId } },
      data: { lastServedAt: new Date() },
    });

    return NextResponse.json(
      { question: payload, review: reviewMeta },
      { status: 200 }
    );
  } catch (error) {
    if (isMissedQuestionTableMissing(error)) {
      console.warn(
        "[missed.practice] MissedQuestion table not found – returning empty response. Apply the latest migration to enable this feature."
      );
      return NextResponse.json({ empty: true, missingTable: true }, { status: 200 });
    }
    console.error("[missed.practice] failed", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
