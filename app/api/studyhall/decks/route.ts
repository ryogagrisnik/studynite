import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";

import { withApi } from "@/lib/api";
import { authOptions } from "@/lib/auth";
import { env } from "@/lib/env";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { hasActiveProSession } from "@/lib/server/membership";
import { resolvePracticeUser } from "@/lib/server/practiceAccess";
import { getCachedDeck, setCachedDeck } from "@/lib/studyhall/deckCache";
import { checkDeckLimits, recordDeckCreate } from "@/lib/studyhall/deckLimits";
import { extractStudyText } from "@/lib/studyhall/ingest";
import { generateStudyDeck, type GeneratedDeck } from "@/lib/studyhall/generator";
import { clampCount, generateShareId, toSafeTitle } from "@/lib/studyhall/utils";
import { getTestUserId } from "@/lib/testing";
import {
  DEFAULT_FLASHCARD_COUNT,
  DEFAULT_QUESTION_COUNT,
  FREE_MAX_FLASHCARD_COUNT,
  FREE_MAX_QUESTION_COUNT,
  MAX_INPUT_CHARS,
  MIN_FLASHCARD_COUNT,
  MIN_QUESTION_COUNT,
  PRO_MAX_FLASHCARD_COUNT,
  PRO_MAX_QUESTION_COUNT,
} from "@/lib/studyhall/constants";

export const dynamic = "force-dynamic";

const GUEST_DAILY_LIMIT = 1;
const GUEST_WINDOW_MS = 24 * 60 * 60 * 1000;

type GuestQuotaState = {
  count: number;
  resetAt: number;
};

function parseGuestQuota(raw: unknown, now: number): GuestQuotaState {
  if (!raw) return { count: 0, resetAt: now + GUEST_WINDOW_MS };
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : (raw as GuestQuotaState);
    if (typeof parsed?.count === "number" && typeof parsed?.resetAt === "number") {
      if (now >= parsed.resetAt) {
        return { count: 0, resetAt: now + GUEST_WINDOW_MS };
      }
      return { count: Math.max(0, parsed.count), resetAt: parsed.resetAt };
    }
  } catch {
    // ignore parse errors
  }
  return { count: 0, resetAt: now + GUEST_WINDOW_MS };
}

async function checkGuestDeckLimit(userId: string) {
  const key = `studyhall:guest:deck:${userId}`;
  const now = Date.now();
  const raw = await redis.get(key);
  const state = parseGuestQuota(raw, now);
  if (state.count >= GUEST_DAILY_LIMIT) {
    return {
      ok: false as const,
      retryAfterMs: state.resetAt - now,
    };
  }
  return { ok: true as const, state };
}

async function recordGuestDeckCreate(userId: string, state: GuestQuotaState) {
  const key = `studyhall:guest:deck:${userId}`;
  const next: GuestQuotaState = {
    count: state.count + 1,
    resetAt: state.resetAt,
  };
  await redis.set(key, JSON.stringify(next));
}

const optionalString = z.preprocess(
  (value) => (value === null || value === undefined ? undefined : value),
  z.string().optional()
);
const optionalCount = z.preprocess(
  (value) => (value === null || value === undefined || value === "" ? undefined : value),
  z.coerce.number().int().positive().optional()
);
const formSchema = z.object({
  title: optionalString,
  text: optionalString,
  includeQuestions: z.enum(["true", "false"]).optional(),
  includeFlashcards: z.enum(["true", "false"]).optional(),
  questionCount: optionalCount,
  flashcardCount: optionalCount,
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
});

function buildTestDeck(args: {
  sourceText: string;
  title: string;
  questionCount: number;
  flashcardCount: number;
  includeQuestions: boolean;
  includeFlashcards: boolean;
  includeExplanations: boolean;
}): GeneratedDeck {
  const questions = args.includeQuestions
    ? Array.from({ length: args.questionCount }).map((_, idx) => ({
        prompt: `Sample question ${idx + 1}`,
        choices: ["Option A", "Option B", "Option C", "Option D"],
        correctIndex: 0,
        explanation: args.includeExplanations ? `Explanation for question ${idx + 1}.` : null,
      }))
    : [];
  const flashcards = args.includeFlashcards
    ? Array.from({ length: args.flashcardCount }).map((_, idx) => ({
        front: `Card ${idx + 1}`,
        back: `Answer ${idx + 1}`,
      }))
    : [];
  return {
    title: args.title,
    questions,
    flashcards,
  };
}

export const GET = withApi(async () => {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const decks = await prisma.studyDeck.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: { questions: true, flashcards: true },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    decks: decks.map((deck) => ({
      id: deck.id,
      title: deck.title,
      description: deck.description,
      shareId: deck.shareId,
      updatedAt: deck.updatedAt,
      questionCount: deck._count.questions,
      flashcardCount: deck._count.flashcards,
    })),
  });
});

export const POST = withApi(async (req: Request) => {
  const session = await getServerSession(authOptions);
  const testUserId = getTestUserId(req);
  const cookieStore = cookies();
  const resolved = resolvePracticeUser(session, cookieStore);
  const sessionUserId = (session?.user as any)?.id as string | undefined;
  const userId = sessionUserId ?? testUserId ?? resolved.userId;
  const isGuest = !sessionUserId && !testUserId;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const isTestMode = process.env.NODE_ENV === "test" && req.headers.get("x-test-mode") === "1";
  const isPro = hasActiveProSession(session);
  const cacheUserId = isPro ? userId : "free";

  if (isGuest && !isTestMode) {
    const guestLimit = await checkGuestDeckLimit(userId);
    if (!guestLimit.ok) {
      const retryAfter = Math.max(1, Math.ceil(guestLimit.retryAfterMs / 1000));
      const res = NextResponse.json(
        { ok: false, error: "GUEST_LIMIT_REACHED", retryAfter },
        { status: 429 }
      );
      res.headers.set("Retry-After", String(retryAfter));
      return res;
    }
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });
  } else {
    const maxCreates = Math.max(1, Number(env.RATE_LIMIT_DECK_CREATE_MAX ?? "8"));
    if (!isTestMode) {
      const limitCheck = await checkDeckLimits(userId, isPro, maxCreates);
      if (!limitCheck.ok) {
        const retryAfter = Math.max(1, Math.ceil(limitCheck.retryAfterMs / 1000));
        const res = NextResponse.json(
          { ok: false, error: limitCheck.error, retryAfter },
          { status: 429 }
        );
        res.headers.set("Retry-After", String(retryAfter));
        return res;
      }
    }
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid form data" }, { status: 400 });
  }

  const parsed = formSchema.safeParse({
    title: form.get("title"),
    text: form.get("text"),
    includeQuestions: form.get("includeQuestions")?.toString(),
    includeFlashcards: form.get("includeFlashcards")?.toString(),
    questionCount: form.get("questionCount"),
    flashcardCount: form.get("flashcardCount"),
    difficulty: form.get("difficulty")?.toString(),
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid form fields" }, { status: 400 });
  }

  const title = toSafeTitle(parsed.data.title);
  const text = parsed.data.text ?? "";
  const files = form.getAll("files").filter(Boolean) as File[];
  const includeQuestions = (parsed.data.includeQuestions ?? "true") === "true";
  const includeFlashcards = (parsed.data.includeFlashcards ?? "false") === "true";
  const questionCountRaw = Number(parsed.data.questionCount ?? DEFAULT_QUESTION_COUNT);
  const flashcardCountRaw = Number(parsed.data.flashcardCount ?? DEFAULT_FLASHCARD_COUNT);
  const difficulty = parsed.data.difficulty ?? "medium";
  const maxQuestionCount = isPro ? PRO_MAX_QUESTION_COUNT : FREE_MAX_QUESTION_COUNT;
  const maxFlashcardCount = isPro ? PRO_MAX_FLASHCARD_COUNT : FREE_MAX_FLASHCARD_COUNT;
  const questionCount = clampCount(questionCountRaw, MIN_QUESTION_COUNT, maxQuestionCount);
  const flashcardCount = clampCount(flashcardCountRaw, MIN_FLASHCARD_COUNT, maxFlashcardCount);

  try {
    if (!includeQuestions) {
      return NextResponse.json(
        { ok: false, error: "Quiz questions are required." },
        { status: 400 }
      );
    }
    if (includeFlashcards) {
      return NextResponse.json(
        { ok: false, error: "Flashcard generation is disabled." },
        { status: 400 }
      );
    }
    if (text.length > MAX_INPUT_CHARS * 2) {
      return NextResponse.json(
        { ok: false, error: "Text input is too long. Shorten it and try again." },
        { status: 400 }
      );
    }
    const sourceText = await extractStudyText({ text, files, userId });
    let generated: GeneratedDeck | null = isTestMode
      ? buildTestDeck({
          sourceText,
          title,
          questionCount,
          flashcardCount,
          includeQuestions,
          includeFlashcards,
          includeExplanations: isPro,
        })
      : null;

    if (!generated) {
      const cached = await getCachedDeck({
        userId: cacheUserId,
        sourceText,
        includeQuestions,
        includeFlashcards,
        questionCount,
        flashcardCount,
        includeExplanations: isPro,
        difficulty,
      });
      if (cached) {
        generated = cached;
      } else {
        const fresh = await generateStudyDeck({
          sourceText,
          title,
          questionCount,
          flashcardCount,
          includeQuestions,
          includeFlashcards,
          includeExplanations: isPro,
          difficulty,
        });
        generated = fresh;
        await setCachedDeck(
          {
            userId: cacheUserId,
            sourceText,
            includeQuestions,
            includeFlashcards,
            questionCount,
            flashcardCount,
            includeExplanations: isPro,
            difficulty,
          },
          fresh
        );
      }
    }
    if (!generated) {
      throw new Error("Unable to generate quiz.");
    }

    const deck = await prisma.studyDeck.create({
      data: {
        userId,
        title: generated.title || title,
        description: sourceText.slice(0, 160),
        sourceText,
        shareId: generateShareId(),
        ...(generated.questions.length
          ? {
              questions: {
                create: generated.questions.map((question, index) => ({
                  order: index + 1,
                  prompt: question.prompt,
                  choices: question.choices,
                  correctIndex: question.correctIndex,
                  explanation: question.explanation ?? null,
                })),
              },
            }
          : {}),
        ...(generated.flashcards.length
          ? {
              flashcards: {
                create: generated.flashcards.map((card, index) => ({
                  order: index + 1,
                  front: card.front,
                  back: card.back,
                })),
              },
            }
          : {}),
      },
    });

    if (!isTestMode) {
      if (isGuest) {
        const guestState = parseGuestQuota(await redis.get(`studyhall:guest:deck:${userId}`), Date.now());
        await recordGuestDeckCreate(userId, guestState);
      } else {
        const maxCreates = Math.max(1, Number(env.RATE_LIMIT_DECK_CREATE_MAX ?? "8"));
        await recordDeckCreate(userId, isPro, maxCreates);
      }
    }

    return NextResponse.json({ ok: true, deckId: deck.id, shareId: deck.shareId });
  } catch (error: any) {
    const message = error?.message || "Failed to generate quiz.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
});
