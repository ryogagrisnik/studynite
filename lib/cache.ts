import type { Question as PrismaQuestion } from "@prisma/client";
import { redis } from "./redis";
import prisma from "./prisma";
import type { Exam, Section, Difficulty } from "./types";

const SEEN_TTL_SECONDS = 60 * 60 * 24 * 21;

function queueKey(exam: Exam, section: Section, topic = "algebra", difficulty: Difficulty = "easy") {
  return `queue:${exam}:${section}:${topic}:${difficulty}`;
}
function seenKey(userId: string, exam: Exam, section: Section) {
  return `seen:${userId}:${exam}:${section}`;
}
function quotaKey(userId: string) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `quota:${userId}:${today}`;
}

export async function quotaCheck(userId: string, total = 25) {
  const key = quotaKey(userId);
  const used = (await redis.incr(key)) - 1;
  if (used === 0) await redis.expire(key, 86400);
  return { ok: used < total, used, total };
}

function adaptQuestion(row: PrismaQuestion) {
  const choices = row.choices ?? [];
  const correctIndex = choices.findIndex(choice => choice === row.answer);
  const difficulty = row.difficulty === 500 ? "easy" : row.difficulty === 700 ? "hard" : "medium";

  return {
    id: row.id,
    exam: row.exam as Exam,
    section: row.section as Section,
    type: "single" as const,
    stem: row.stem,
    choices,
    correct: correctIndex >= 0 ? [correctIndex] : [],
    explanation: row.explanation,
    topic: row.topic ?? undefined,
    difficulty,
  };
}

export async function pickFromQueue(
  userId: string,
  exam: Exam,
  section: Section,
  topic = "algebra",
  difficulty: Difficulty = "easy"
) {
  const qKey = queueKey(exam, section, topic, difficulty);
  const sKey = seenKey(userId, exam, section);

  const ids: string[] = (await redis.lrange(qKey, 0, 19)) as any;
  let chosen: string | null = null;
  for (const id of ids) {
    const seen = await redis.sismember(sKey, id);
    if (!seen) {
      chosen = id;
      break;
    }
  }
  chosen = chosen ?? ids[0] ?? null;

  if (chosen) {
    const head = await redis.lpop(qKey);
    if (head) await redis.rpush(qKey, head);
  }

  if (chosen) {
    const row = await prisma.question.findUnique({ where: { id: chosen } });
    if (row) {
      const q = adaptQuestion(row);
      await redis.sadd(sKey, chosen);
      await redis.expire(sKey, SEEN_TTL_SECONDS);
      return q;
    }
  }

  const saved = await generateQuestionFallback(exam, section, topic, difficulty);
  await redis.rpush(qKey, saved.id);
  await redis.sadd(sKey, saved.id);
  await redis.expire(sKey, SEEN_TTL_SECONDS);
  return adaptQuestion(saved as PrismaQuestion);
}

async function generateQuestionFallback(
  _exam: Exam,
  _section: Section,
  _topic: string,
  _difficulty: Difficulty
): Promise<PrismaQuestion> {
  throw new Error("Question generator is not available in this build.");
}
