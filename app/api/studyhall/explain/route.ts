export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";
import { getServerSession } from "next-auth";

import { ApiError, withApi, badRequest, notFound, unauthorized, tooManyRequests } from "@/lib/api";
import { authOptions } from "@/lib/auth";
import { generateExplanation, sanitizeExplanation } from "@/lib/explainer";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { getRequestIp } from "@/lib/request";

const Input = z.object({
  deckId: z.string().min(1),
  questionId: z.string().min(1),
  shareId: z.string().optional(),
  userIndex: z.number().int().nonnegative().optional(),
});

const MAX_WORDS = 90;

function wc(text: string) {
  return (text || "").trim().split(/\s+/).filter(Boolean).length;
}

function clampExplanation(text: string, maxWords: number) {
  const trimmed = (text || "").trim();
  if (!trimmed) return trimmed;
  if (wc(trimmed) <= maxWords) return trimmed;
  const sentences = trimmed.split(/(?<=[.!?])\s+/);
  let acc = "";
  for (const sentence of sentences) {
    const next = acc ? `${acc} ${sentence}` : sentence;
    if (wc(next) > maxWords) break;
    acc = next;
  }
  if (acc) return acc.trim();
  const words = trimmed.split(/\s+/).slice(0, maxWords);
  return `${words.join(" ")}.`;
}

function fallbackExplanation() {
  return "Review the prompt, find the key clue, and eliminate choices that contradict it. The correct option matches the core idea and any numbers or constraints.";
}

export const POST = withApi(async (req: Request) => {
  const raw = await req.json().catch(() => ({}));
  const parsed = Input.safeParse(raw);
  if (!parsed.success) throw badRequest("Invalid payload");

  const body = parsed.data;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  const keyId = userId ? `u:${userId}` : `ip:${getRequestIp(req)}`;
  try {
    const minuteKey = `rl:study-explain:${keyId}:${Math.floor(Date.now() / 60000)}`;
    const used = await redis.incr(minuteKey);
    if (used === 1) {
      await redis.expire(minuteKey, 70);
    }
    if (used > 20) throw tooManyRequests("Rate limit exceeded");
  } catch (error) {
    if (error instanceof ApiError) throw error;
  }

  const question = await prisma.studyQuestion.findUnique({
    where: { id: body.questionId },
    include: {
      deck: {
        select: { id: true, userId: true, shareId: true, shareExpiresAt: true },
      },
    },
  });
  if (!question || question.deckId !== body.deckId) throw notFound("Question not found");

  const now = Date.now();
  const shareValid =
    Boolean(body.shareId) &&
    body.shareId === question.deck.shareId &&
    (!question.deck.shareExpiresAt || question.deck.shareExpiresAt.getTime() > now);
  const isOwner = Boolean(userId && question.deck.userId === userId);
  if (!isOwner && !shareValid) throw unauthorized();

  if (question.explanation) {
    return new Response(JSON.stringify({ explanation: question.explanation }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const useApi = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 10);
  let explanation = fallbackExplanation();
  if (useApi) {
    try {
      const generated = await generateExplanation({
        stem: question.prompt,
        choices: question.choices,
        correctIndex: question.correctIndex,
        userIndex: body.userIndex,
        targetWords: 70,
      });
      explanation = clampExplanation(sanitizeExplanation(generated), MAX_WORDS);
    } catch {
      explanation = fallbackExplanation();
    }
  }

  try {
    await prisma.studyQuestion.update({
      where: { id: question.id },
      data: { explanation },
    });
  } catch {
    // swallow db hiccups; still return explanation
  }

  return new Response(JSON.stringify({ explanation }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
