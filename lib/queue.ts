// /lib/queue.ts
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  generateGreQuantBatch,
  generateGreRcBatch,
  generateGreSentenceEquivalence,
  generateGreTextCompletion,
} from "@/lib/generator";
import { pickRandomGmatQuant } from "@/lib/gmatBank";
import { sanitizeExplanation, generateExplanation, getExplanationTargetWords } from "@/lib/explainer";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

type Diff = "easy" | "medium" | "hard";

/**
 * Minimal shape used by /app/api/next-question/route.ts
 */
export type EnsureQueueOpts = {
  exam: "GRE" | "GMAT";
  section: "Quant" | "Verbal";
  topic?: string;
  difficulty: Diff;
  target: number; // desired items for the day
};

const DIFFICULTY_PREF_MAP: Record<Diff, number[]> = {
  easy: [500, 600, 700],
  medium: [600, 700, 500],
  hard: [700, 600, 500],
};

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function difficultyToScore(diff: Diff): number {
  return diff === "easy" ? 500 : diff === "medium" ? 600 : 700;
}

function difficultyPreference(diff: Diff): number[] {
  return DIFFICULTY_PREF_MAP[diff] ?? [700, 600, 500];
}

function clampIndex(idx: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(idx, 0), Math.max(0, total - 1));
}

function detectVerbalMode(topic?: string | null): "Text Completion" | "Sentence Equivalence" | "Reading Comprehension" {
  const normalized = (topic ?? "").toLowerCase();
  if (/sentence\s*equivalence|^se$/.test(normalized)) return "Sentence Equivalence";
  if (/text\s*completion|^tc$/.test(normalized)) return "Text Completion";
  return "Reading Comprehension";
}

async function ensureExplanation(stem: string, choices: string[], correctIndex: number, existing?: string | null) {
  const trimmed = (existing ?? "").trim();
  if (trimmed.length >= 60) {
    return sanitizeExplanation(trimmed);
  }
  const generated = await generateExplanation({
    stem,
    choices,
    correctIndex,
    targetWords: getExplanationTargetWords(),
  });
  return sanitizeExplanation(generated);
}

function appendQuantitiesIfNeeded(stem: string, question: { concept?: string | null; kind?: string | null; quantityA?: unknown; quantityB?: unknown }): string {
  const isQcConcept = typeof question.concept === "string" && question.concept.toLowerCase().includes("quantitative comparison");
  const hasQcKind = typeof question.kind === "string" && question.kind.toLowerCase().includes("qc");
  const quantityA =
    typeof question.quantityA === "string" ? question.quantityA.trim() : typeof question.quantityA === "number" ? String(question.quantityA) : "";
  const quantityB =
    typeof question.quantityB === "string" ? question.quantityB.trim() : typeof question.quantityB === "number" ? String(question.quantityB) : "";
  if ((!isQcConcept && !hasQcKind) || (!quantityA && !quantityB)) {
    return stem;
  }
  if (/Quantity\s*A[:\-]/i.test(stem) || /Quantity\s*B[:\-]/i.test(stem)) {
    return stem;
  }
  const lines: string[] = [];
  if (quantityA) lines.push(`Quantity A: ${quantityA}`);
  if (quantityB) lines.push(`Quantity B: ${quantityB}`);
  return `${stem}\n\n${lines.join("\n")}`;
}

async function generateQuestionForQueue(opts: EnsureQueueOpts): Promise<string | null> {
  try {
    if (opts.exam === "GRE" && opts.section === "Quant") {
      const [question] = await generateGreQuantBatch({ topic: opts.topic, difficulty: opts.difficulty });
      const choices = Array.isArray(question.choices) ? question.choices : [];
      const correctIndex = clampIndex(Number(question.correctIndex) || 0, choices.length);
      const explanation = await ensureExplanation(question.stem, choices, correctIndex, question.explanation);
      const safeStem = sanitizeHtml(appendQuantitiesIfNeeded(question.stem, question)) ?? question.stem;
      const safeExplanation = sanitizeHtml(explanation) ?? explanation;
      const stored = await prisma.question.create({
        data: {
          exam: "GRE",
          section: "Quant",
          topic: question.concept ?? opts.topic ?? "General",
          stem: safeStem,
          choices,
          answer: choices[correctIndex] ?? "",
          explanation: safeExplanation,
          difficulty: difficultyToScore(opts.difficulty),
        },
        select: { id: true },
      });
      return stored.id;
    }

    if (opts.exam === "GMAT" && opts.section === "Quant") {
      const sample = pickRandomGmatQuant(typeof opts.topic === "string" ? opts.topic : undefined);
      const choices = Array.isArray(sample.choices) ? sample.choices : [];
      const correctIndex = clampIndex(Number(sample.correctIndex) || 0, choices.length);
      const explanation = await ensureExplanation(sample.stem, choices, correctIndex, sample.explanation);
      const safeStem = sanitizeHtml(sample.stem) ?? sample.stem;
      const safeExplanation = sanitizeHtml(explanation) ?? explanation;
      const stored = await prisma.question.create({
        data: {
          exam: "GMAT",
          section: "Quant",
          topic: sample.concept,
          stem: safeStem,
          choices,
          answer: choices[correctIndex] ?? "",
          explanation: safeExplanation,
          difficulty: difficultyToScore(sample.difficulty ?? opts.difficulty),
        },
        select: { id: true },
      });
      return stored.id;
    }

    if (opts.exam === "GRE" && opts.section === "Verbal") {
      const mode = detectVerbalMode(opts.topic);
      if (mode === "Text Completion") {
        const [question] = await generateGreTextCompletion({ difficulty: opts.difficulty });
        const choices = Array.isArray(question.choices) ? question.choices : [];
        const correctIndex = clampIndex(Number(question.correctIndex) || 0, choices.length);
        const explanation = await ensureExplanation(question.stem, choices, correctIndex, question.explanation);
        const safeStem = sanitizeHtml(question.stem) ?? question.stem;
        const safeExplanation = sanitizeHtml(explanation) ?? explanation;
        const stored = await prisma.question.create({
          data: {
            exam: "GRE",
            section: "Verbal",
            topic: "Text Completion",
            stem: safeStem,
            choices,
            answer: choices[correctIndex] ?? "",
            explanation: safeExplanation,
            difficulty: difficultyToScore(opts.difficulty),
          },
          select: { id: true },
        });
        return stored.id;
      }

      if (mode === "Sentence Equivalence") {
        const [question] = await generateGreSentenceEquivalence({ difficulty: opts.difficulty });
        const choices = Array.isArray(question.choices) ? question.choices : [];
        const correctIndex = clampIndex(Number(question.correctIndex) || 0, choices.length);
        const explanation = await ensureExplanation(question.stem, choices, correctIndex, question.explanation);
        const safeStem = sanitizeHtml(question.stem) ?? question.stem;
        const safeExplanation = sanitizeHtml(explanation) ?? explanation;
        const stored = await prisma.question.create({
          data: {
            exam: "GRE",
            section: "Verbal",
            topic: "Sentence Equivalence",
            stem: safeStem,
            choices,
            answer: choices[correctIndex] ?? "",
            explanation: safeExplanation,
            difficulty: difficultyToScore(opts.difficulty),
          },
          select: { id: true },
        });
        return stored.id;
      }

      const [question] = await generateGreRcBatch({
        category: opts.topic,
        difficulty: opts.difficulty,
        withPassage: true,
      });
      const combinedStem =
        question.passage && question.passage.trim()
          ? `Passage:\n${question.passage.trim()}\n\nQuestion:\n${question.stem}`
          : question.stem;
      const choices = Array.isArray(question.choices) ? question.choices : [];
      const correctIndex = clampIndex(Number(question.correctIndex) || 0, choices.length);
      const explanation = await ensureExplanation(combinedStem, choices, correctIndex, question.explanation);
      const safeStem = sanitizeHtml(combinedStem) ?? combinedStem;
      const safeExplanation = sanitizeHtml(explanation) ?? explanation;
      const stored = await prisma.question.create({
        data: {
          exam: "GRE",
          section: "Verbal",
          topic: question.concept ?? opts.topic ?? "Reading Comprehension",
          stem: safeStem,
          choices,
          answer: choices[correctIndex] ?? "",
          explanation: safeExplanation,
          difficulty: difficultyToScore(opts.difficulty),
        },
        select: { id: true },
      });
      return stored.id;
    }
  } catch (error) {
    console.error("[queue] failed to generate question", error);
  }
  return null;
}

async function fetchQuestionPool(opts: EnsureQueueOpts, limit: number): Promise<string[]> {
  const pref = difficultyPreference(opts.difficulty);
  const where: Prisma.QuestionWhereInput = {
    exam: opts.exam,
    section: opts.section,
    ...(opts.topic ? { topic: opts.topic } : {}),
  };

  const rows = await prisma.question.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.max(limit * 2, 20),
    select: { id: true, difficulty: true },
  });

  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const score of pref) {
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      if (row.difficulty === score) {
        ordered.push(row.id);
        seen.add(row.id);
      }
    }
  }
  for (const row of rows) {
    if (!seen.has(row.id)) {
      ordered.push(row.id);
      seen.add(row.id);
    }
  }

  return ordered.slice(0, limit);
}

/**
 * Prefills the per-user daily queue with reusable question IDs. When no matching
 * questions exist, it will synthesize fresh items using the lightweight GRE/GMAT
 * generators so fallback requests never run empty.
 */
export async function ensureDailyQueue(
  userId: string,
  opts: EnsureQueueOpts
): Promise<void> {
  try {
    const today = startOfTodayUTC();
    const target = Math.max(1, Math.min(200, opts.target || 20));

    const existing = await prisma.dailyQueueItem.count({
      where: { userId, date: today, servedAt: null },
    });
    if (existing >= target) return;

    const needed = Math.max(0, target - existing);
    const queuedToday = await prisma.dailyQueueItem.findMany({
      where: { userId, date: today },
      select: { questionId: true },
    });
    const alreadyQueued = new Set(queuedToday.map((row) => row.questionId));

    const poolIds = await fetchQuestionPool(opts, needed * 2);
    const candidates: string[] = [];
    for (const id of poolIds) {
      if (alreadyQueued.has(id)) continue;
      candidates.push(id);
      if (candidates.length >= needed) break;
    }

    while (candidates.length < needed) {
      const generatedId = await generateQuestionForQueue(opts);
      if (!generatedId) break;
      if (alreadyQueued.has(generatedId)) continue;
      candidates.push(generatedId);
    }

    if (!candidates.length) return;

    const slice = candidates.slice(0, needed);
    const maxOrder = await prisma.dailyQueueItem.aggregate({
      where: { userId, date: today },
      _max: { order: true },
    });
    let order = (maxOrder._max.order ?? 0) + 1;

    await prisma.$transaction(
      slice.map((questionId) =>
        prisma.dailyQueueItem.create({
          data: { userId, date: today, questionId, order: order++ },
        })
      )
    );
  } catch (error) {
    console.error("[queue] ensureDailyQueue failed", error);
  }
}
