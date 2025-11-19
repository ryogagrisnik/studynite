// /lib/queue.ts
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Minimal shape used by /app/api/next-question/route.ts
 */
export type EnsureQueueOpts = {
  exam: "GRE" | "GMAT";
  section: "Quant" | "Verbal";
  topic?: string;
  difficulty: "easy" | "medium" | "hard";
  target: number; // desired items for the day (ignored in this minimal version)
};

/**
 * Minimal, safe no-op implementation.
 * Your next-question route awaits this but doesn't rely on any output.
 * This avoids importing non-existent generator functions and breaking the build.
 */
export async function ensureDailyQueue(
  userId: string,
  opts: EnsureQueueOpts
): Promise<void> {
  const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  const target = Math.max(1, Math.min(200, opts.target || 20));

  const existing = await prisma.dailyQueueItem.count({ where: { userId, date: today, servedAt: null } });
  if (existing >= target) return;

  // Build candidate pool from recent Questions matching filters
  const where: Prisma.QuestionWhereInput = {
    exam: opts.exam,
    section: opts.section,
    ...(opts.topic ? { topic: opts.topic } : {}),
  };

  const pool = await prisma.question.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { id: true },
  });

  // Shuffle lightly
  const ids = pool.map(p => p.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor((Math.random() * 1e9) % (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  // Determine how many new items we need
  const needed = Math.max(0, target - existing);
  const slice = ids.slice(0, needed);
  if (!slice.length) return;

  // Compute next order index
  const maxOrder = await prisma.dailyQueueItem.aggregate({
    where: { userId, date: today },
    _max: { order: true },
  });
  let order = (maxOrder._max.order ?? 0) + 1;

  await prisma.$transaction(
    slice.map((qid) =>
      prisma.dailyQueueItem.create({ data: { userId, date: today, questionId: qid, order: order++ } })
    )
  );
}
