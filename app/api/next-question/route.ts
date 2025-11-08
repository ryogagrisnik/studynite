// /app/api/next-question/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { ensureDailyQueue } from "@/lib/queue";
import {
  getRecentQuestionHashes,
  rememberQuestionHash,
} from "@/lib/recentQuestionCache";
import { randomInt } from "crypto";
import {
  PRACTICE_LIMIT,
  PRACTICE_WINDOW_MS,
  IS_DEV_ENV,
  resolvePracticeUser,
  getQuotaState,
  incrementQuotaState,
  quotaMeta,
} from "@/lib/server/practiceAccess";

import { pickRandomGreQuant, GRE_QUESTIONS } from "@/lib/greBank";
import { pickRandomGmatQuant, GMAT_QUESTIONS } from "@/lib/gmatBank";
import {
  generateGreQuantBatch,
  generateGreRcBatch,
  generateGreTextCompletion,
  generateGreSentenceEquivalence,
} from "@/lib/generator";
import { questionHash } from "@/lib/hash";
import { generateExplanation, sanitizeExplanation, getExplanationTargetWords } from "@/lib/explainer";
import { gpt } from "@/lib/openai";
import { GRE_QUANT_CATEGORIES, GMAT_QUANT_CATEGORIES, validQuantCategory } from "@/lib/validator/quant";
import { GRE_RC_CATEGORIES, validVerbalCategory } from "@/lib/validator/verbal";
import { redis } from "@/lib/redis";
import { renderMathToHtml } from "@/lib/math/renderMathToHtml";
import { normalizeLooseTex } from "@/lib/math/normalizeLooseTex";
import { preflightFixMath } from "@/lib/math/preflight";

const MIN_INTERVAL_SECONDS = Math.max(
  1,
  Number(process.env.NEXT_QUESTION_MIN_INTERVAL_SECONDS ?? (IS_DEV_ENV ? "1" : "5"))
);
const HOURLY_LIMIT = Math.max(
  1,
  Number(process.env.NEXT_QUESTION_HOURLY_LIMIT ?? (IS_DEV_ENV ? "90" : "40"))
);
const DAILY_LIMIT = PRACTICE_LIMIT;

type Diff = "easy" | "medium" | "hard";
function pickWeightedDifficulty(): Diff {
  const r = randomFraction();
  if (r < 0.25) return "medium";
  return "hard";
}

const Input = z.object({
  exam: z.enum(["GRE", "GMAT"]),
  section: z.enum(["Quant", "Verbal"]),
  topic: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  studyMode: z.enum(["random", "concept"]).optional(),
  mode: z.enum(["random", "topic"]).optional(), // legacy alias from client
});

// ───────────────────────────────
// HELPERS
// ───────────────────────────────
function randomFraction(): number {
  try {
    // 2^20 granularity keeps denominator reasonable while using crypto RNG
    return randomInt(1 << 20) / (1 << 20);
  } catch {
    return Math.random();
  }
}

function randomIndex(size: number): number {
  if (size <= 1) return 0;
  try {
    return randomInt(size);
  } catch {
    return Math.floor(Math.random() * size);
  }
}

function randomFromArray<T>(arr: T[]): T {
  return arr[randomIndex(arr.length)]!;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

async function enforceRateLimit(userId: string) {
  const now = Date.now();
  const cooldownKey = `rl:nq:cooldown:${userId}`;
  const lastHitRaw = await redis.get(cooldownKey);
  const lastHit = asNumber(lastHitRaw);
  if (lastHit && now - lastHit < MIN_INTERVAL_SECONDS * 1000) {
    const retryMillis = MIN_INTERVAL_SECONDS * 1000 - (now - lastHit);
    const retryAfter = Math.max(1, Math.ceil(retryMillis / 1000));
    return {
      ok: false as const,
      reason: "cooldown" as const,
      retryAfter,
    };
  }

  const hourKey = `rl:nq:hour:${userId}:${Math.floor(now / 3_600_000)}`;
  const hourCount = await redis.incr(hourKey);
  if (hourCount === 1) {
    await redis.expire(hourKey, 3_600);
  }
  if (hourCount > HOURLY_LIMIT) {
    return {
      ok: false as const,
      reason: "burst" as const,
      retryAfter: 3_600,
    };
  }

  await redis.set(cooldownKey, String(now));
  await redis.expire(cooldownKey, MIN_INTERVAL_SECONDS * 2);

  return { ok: true as const };
}

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function ensureLatexExplanation(args: {
  stem: string;
  choices: string[];
  correctIndex: number;
  existing?: string | null;
}): Promise<string> {
  const { stem, choices, correctIndex, existing } = args;
  let text = (existing || "").trim();
  // Cache key to reuse explanations across identical items
  const cacheKey = `exp:${questionHash(stem, choices)}:${correctIndex}`;
  if (text.length < 40) {
    try {
      const cached = await redis.get(cacheKey);
      if (typeof cached === 'string' && cached.trim().length >= 40) {
        return cached;
      }
    } catch {}

    text = await generateExplanation({ stem, choices, correctIndex, targetWords: getExplanationTargetWords() });
  }
  let sanitized = sanitizeExplanation(text);

  // Heuristic: detect obviously broken tokens that impair readability
  const looksBroken = (s: string) => /(?:[^\\]rac\b|[^\\]imes\b|\\t|&lt;|\bext\{|\begin\{[^}]*$|\bend\{[^}]*$|={2,}|\bQuantity\s*[AB]\b[^\n]*=\s*$)/i.test(s);

  if (looksBroken(sanitized)) {
    // Try a one-shot rewrite to friendly prose + block math
    const repairKey = `exp:repair:${questionHash(sanitized, [])}`;
    try {
      const cached = await redis.get(repairKey);
      if (typeof cached === 'string' && cached.trim().length > 40) {
        sanitized = cached;
      } else {
        const sys = [
          'Rewrite the explanation below into clear English first, with math shown as proper LaTeX.',
          'Rules: 1) No code fences. 2) Use plain sentences; avoid symbols like \'≡\' or raw tokens (rac, imes).',
          '3) Wrap any substantial expression in display math: \\[ ... \\]. 4) Use valid LaTeX: \\frac, \\times, \\sqrt, \\binom.',
          '5) Decode any HTML entities like &lt; to <. 6) Remove duplicates and stray control characters. 7) Keep the same conclusion.',
        ].join(' ');
        const user = `ORIGINAL EXPLANATION:\n${sanitized}`;
        const repaired = await gpt({ system: sys, user, json: false, temperature: 0.1, model: process.env.EXPLAINER_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini' });
        sanitized = sanitizeExplanation(String(repaired || ''));
        try {
          await redis.set(repairKey, sanitized);
          await redis.expire(repairKey, 30 * 24 * 60 * 60);
        } catch {}
      }
    } catch {}
  }
  try {
    // Cache for 7 days
    await redis.set(cacheKey, sanitized);
    await redis.expire(cacheKey, 7 * 24 * 60 * 60);
  } catch {}
  return sanitized;
}

// New + legacy mapping (for frontend compatibility)
function coerceString(v: unknown): string | undefined {
  if (typeof v === "string") return v.trim();
  if (v == null) return undefined;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return undefined;
}

const TOPIC_STOP_WORDS = new Set(["and", "the", "of", "in", "to", "for"]);

type TopicIndexEntry = {
  section: "Quant" | "Verbal";
  canonical: string;
  key: string;
  tokens: Set<string>;
};

function tokenizeTopic(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => token.replace(/'s$/, ""))
    .map((token) => (token.length > 3 && token.endsWith("es") ? token.slice(0, -2) : token))
    .map((token) => (token.length > 3 && token.endsWith("s") ? token.slice(0, -1) : token))
    .filter((token) => token && !TOPIC_STOP_WORDS.has(token));
}

function buildTopicIndex<T extends readonly string[]>(
  section: "Quant" | "Verbal",
  categories: T
): TopicIndexEntry[] {
  return categories.map((canonical) => {
    const tokens = new Set(tokenizeTopic(canonical));
    const key = Array.from(tokens).sort().join(" ");
    return { section, canonical, key, tokens };
  });
}

const QUANT_TOPIC_INDEX_BY_EXAM = {
  GRE: buildTopicIndex("Quant", GRE_QUANT_CATEGORIES),
  GMAT: buildTopicIndex("Quant", GMAT_QUANT_CATEGORIES),
};
const VERBAL_TOPIC_INDEX = buildTopicIndex("Verbal", [
  ...GRE_RC_CATEGORIES,
  "Text Completion",
  "Sentence Equivalence",
  "Reading Comprehension",
]);

const VERBAL_TOPIC_ALIAS: Record<string, "Text Completion" | "Sentence Equivalence" | "Reading Comprehension"> = {
  tc: "Text Completion",
  textcompletion: "Text Completion",
  textcompletions: "Text Completion",
  se: "Sentence Equivalence",
  sentenceequivalence: "Sentence Equivalence",
  sentenceequivalences: "Sentence Equivalence",
  rc: "Reading Comprehension",
  readingcomprehension: "Reading Comprehension",
};

function canonicalizeTopic(input: {
  exam: "GRE" | "GMAT";
  section: "Quant" | "Verbal";
  topic?: string | null;
}): { kind: "Quant" | "Verbal"; value: string } | undefined {
  const topic = (input.topic ?? "").trim();
  if (!topic) return undefined;
  const simplified = topic.toLowerCase().replace(/[^a-z]/g, "");
  if (input.section === "Verbal") {
    const alias = VERBAL_TOPIC_ALIAS[simplified];
    if (alias) return { kind: "Verbal", value: alias };
  }
  const tokensRaw = tokenizeTopic(topic);
  if (!tokensRaw.length) return undefined;
  const key = Array.from(new Set(tokensRaw)).sort().join(" ");
  const index =
    input.section === "Quant"
      ? QUANT_TOPIC_INDEX_BY_EXAM[input.exam] ?? QUANT_TOPIC_INDEX_BY_EXAM.GRE
      : VERBAL_TOPIC_INDEX;

  const direct = index.find((entry) => entry.key === key);
  if (direct) return { kind: direct.section, value: direct.canonical };

  const scored = index
    .map((entry) => {
      let overlap = 0;
      for (const token of tokensRaw) {
        if (entry.tokens.has(token)) overlap += 1;
      }
      const score = overlap / tokensRaw.length;
      return { entry, overlap, score };
    })
    .filter((item) => item.overlap > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.overlap !== a.overlap) return b.overlap - a.overlap;
      return a.entry.canonical.localeCompare(b.entry.canonical);
    });

  if (!scored.length) return undefined;
  return { kind: scored[0]!.entry.section, value: scored[0]!.entry.canonical };
}

function difficultyToScore(diff: Diff): number {
  return diff === "easy" ? 500 : diff === "medium" ? 600 : 700;
}

function scoreToDifficulty(score: number): Diff {
  if (score >= 700) return "hard";
  if (score >= 600) return "medium";
  return "easy";
}

const DIFFICULTY_PREF_MAP: Record<Diff, number[]> = {
  easy: [700, 600, 500],
  medium: [700, 600, 500],
  hard: [700, 600, 500],
};

function difficultyPreference(base: Diff): number[] {
  return DIFFICULTY_PREF_MAP[base] ?? [700, 600, 500];
}

const REUSE_FRESHNESS_WINDOW_MS = 1000 * 60 * 20; // 20 minutes

function hasHtmlMarkup(text: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(text);
}

const INLINE_ALLOWED_WORDS = new Set([
  "sin",
  "cos",
  "tan",
  "cot",
  "sec",
  "csc",
  "log",
  "ln",
  "mod",
  "max",
  "min",
  "det",
  "lim",
]);

function wrapInlineMathSegments(text: string): string {
  const inlineEquationRegex =
    /(^|[\s(])(-?\s*(?:[A-Za-z](?:_{[0-9]+}|[0-9]*)?|[0-9]+(?:\.[0-9]+)?)(?:[A-Za-z0-9+\-*/^()\s]*?)\s*(?:=|<|>|≤|≥)\s*-?\s*(?:[A-Za-z](?:_{[0-9]+}|[0-9]*)?|[0-9]+(?:\.[0-9]+)?)(?:[A-Za-z0-9+\-*/^()\s]*?))(?=(?:[,.;:!?)]|\s|$))/g;

  return text.replace(inlineEquationRegex, (match, prefix, expr) => {
    const trimmed = expr.trim();
    if (!trimmed || trimmed.includes("\\(")) return `${prefix}${expr}`;
    const compact = trimmed.replace(/\s+/g, " ");
    const proseWords = compact.match(/[A-Za-z]{3,}/g);
    if (
      proseWords &&
      proseWords.some((word: string) => !INLINE_ALLOWED_WORDS.has(word.toLowerCase()))
    ) {
      return `${prefix}${expr}`;
    }
    return `${prefix}\\(${compact}\\)`;
  });
}

function normalizeSimpleFractions(text: string): string {
  const fractionRegex =
    /(?<!\\\()(?<!\\\[)(?<![\w\\])(-?\d{1,3})\s*\/\s*(\d{1,3})(?!\s*(?:[A-Za-z0-9\\{]|\/))/g;
  return text.replace(fractionRegex, (_match, rawNumerator, rawDenominator) => {
    const sign = String(rawNumerator).startsWith("-") ? "-" : "";
    const numerator = sign ? String(rawNumerator).slice(1) : String(rawNumerator);
    return `\\(${sign}\\frac{${numerator}}{${rawDenominator}}\\)`;
  });
}

function normalizeSimplePowers(text: string): string {
  const powerRegex =
    /(?<!\\\()(?<!\\\[)(?<![\w\\])([A-Za-z])\^([0-9]{1,2})(?![\w^])/g;
  return text.replace(powerRegex, (_match, base, exponent) => {
    return `\\(${base}^{${exponent}}\\)`;
  });
}

function friendlyizeLanguage(input: string): string {
  let s = input;
  // Replace full congruence patterns first: x ≡ a (mod n) or LaTeX variants
  s = s.replace(
    /\b([A-Za-z][A-Za-z0-9]*)\s*(?:\\equiv|≡)\s*([A-Za-z0-9+\-]+)\s*(?:\(\s*mod\s*([0-9]+)\s*\)|\\pmod\{\s*([0-9]+)\s*\}|mod\s*([0-9]+))/gi,
    (_m, v, a, n1, n2, n3) => `${v} leaves remainder ${a} when divided by ${n1 || n2 || n3}`
  );
  // Replace lone (mod n)
  s = s.replace(/\(\s*mod\s*([0-9]+)\s*\)/gi, (_m, n) => ` when divided by ${n}`);
  // Replace \pmod{n}
  s = s.replace(/\\pmod\{\s*([0-9]+)\s*\}/gi, (_m, n) => ` when divided by ${n}`);
  // Replace remaining \equiv or ≡ with a plain "equals"
  s = s.replace(/\\equiv|≡/g, " equals ");
  // Friendly arrows and therefore symbol
  s = s.replace(/[⇒→]/g, " so ").replace(/∴/g, " therefore ");
  // Compact multiple spaces
  s = s.replace(/\s{2,}/g, " ");
  return s;
}

function decodeEntities(input: string): string {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');
}

function enhancePlainContent(raw: string | null | undefined): string {
  // Pre-flight math fixes first, then decode HTML entities
  const pre = preflightFixMath(String(raw ?? ""));
  const decoded = decodeEntities(pre.text);
  // Normalize sloppy LaTeX, then apply friendly language, then simple math helpers
  const text = normalizeLooseTex(decoded.trim());
  if (!text) return "";
  if (hasHtmlMarkup(text)) return raw ?? "";
  const friendly = friendlyizeLanguage(text);
  const normalized = normalizeSimplePowers(normalizeSimpleFractions(friendly))
    .replace(
      /\. (Therefore|Thus|Hence|As a result|Consequently|This means|So\b)/g,
      '.\n\n$1'
    );
  const paragraphs = normalized
    .split(/\n{2,}/g)
    .map((segment) => segment.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .map((segment) => {
      const withMath = wrapInlineMathSegments(segment);
      const withStrong = withMath.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      return `<p>${withStrong}</p>`;
    });
  return paragraphs.join("");
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

function extractQuantitiesFromStem(stemRaw: string): { A?: string; B?: string } {
  const stem = stripHtml(stemRaw);
  const qaRegex = /Quantity\s*A[:\-]?\s*([\s\S]*?)(?=Quantity\s*B[:\-]|$)/i;
  const qbRegex = /Quantity\s*B[:\-]?\s*([\s\S]*?)(?=$)/i;
  const qaMatch = stem.match(qaRegex)?.[1]?.trim();
  const qbMatch = stem.match(qbRegex)?.[1]?.trim();
  if (qaMatch || qbMatch) return { A: qaMatch, B: qbMatch };

  const compareRegex = /compare\s+([\s\S]+?)\s+(?:and|vs\.?|versus)\s+([\s\S]+?)(?:[.?!]|$)/i;
  const compareMatch = stem.match(compareRegex);
  if (compareMatch) {
    const [, rawA, rawB] = compareMatch;
    const clean = (input: string) => input.trim().replace(/^the\s+/i, "");
    return { A: clean(rawA), B: clean(rawB) };
  }

  return {};
}

function toClientShape(q: {
  id: string;
  stem: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  exam: "GRE" | "GMAT";
  section: "Quant" | "Verbal";
  difficulty: "easy" | "medium" | "hard";
  badge?: string;
  kind?: string | null;
  quantityA?: unknown;
  quantityB?: unknown;
}) {
  const choices = Array.isArray(q.choices) ? q.choices : [];
  const safeChoices =
    choices.length >= 2 ? choices : ["Option A", "Option B"]; // ensure something to render
  const correctIndex =
    typeof q.correctIndex === "number" &&
    q.correctIndex >= 0 &&
    q.correctIndex < safeChoices.length
      ? q.correctIndex
      : 0;

  const stem = (q.stem || "").trim();
  const stemPlain = stripHtml(stem);
  const explanation = (q.explanation || "").trim();

  const kindRaw = typeof q.kind === "string" ? q.kind.toLowerCase() : "";
  const normalizedKind =
    kindRaw.includes("qc") || kindRaw.includes("quantitative comparison")
      ? ("qc" as const)
      : kindRaw
      ? ("mcq" as const)
      : undefined;

  const canonicalQcChoices =
    safeChoices.length === 4 &&
    safeChoices.every((choice, idx) =>
      ["Quantity A", "Quantity B", "Equal", "Cannot be determined"][idx] === choice?.trim?.()
    );

  const finalKind = normalizedKind ?? (canonicalQcChoices ? ("qc" as const) : undefined);

  const quantityA =
    finalKind === "qc"
      ? coerceString(q.quantityA) ?? null
      : null;
  const quantityB =
    finalKind === "qc"
      ? coerceString(q.quantityB) ?? null
      : null;

  let finalQuantityA = quantityA;
  let finalQuantityB = quantityB;
  if (finalKind === "qc" && (!finalQuantityA || !finalQuantityB)) {
    const extracted = extractQuantitiesFromStem(stemPlain);
    if (!finalQuantityA && extracted.A) finalQuantityA = extracted.A;
    if (!finalQuantityB && extracted.B) finalQuantityB = extracted.B;
  }

  const stemHTMLRaw = enhancePlainContent(stem);
  const explanationHTMLRaw = enhancePlainContent(explanation);
  const stemHTML = renderMathToHtml(stemHTMLRaw) ?? stemHTMLRaw;
  const explanationHTML =
    renderMathToHtml(explanationHTMLRaw) ?? explanationHTMLRaw;
  const quantityAHTMLRaw =
    finalKind === "qc" && finalQuantityA
      ? enhancePlainContent(finalQuantityA) || finalQuantityA
      : null;
  const quantityBHTMLRaw =
    finalKind === "qc" && finalQuantityB
      ? enhancePlainContent(finalQuantityB) || finalQuantityB
      : null;
  const quantityAHTML =
    quantityAHTMLRaw != null
      ? renderMathToHtml(quantityAHTMLRaw) ?? quantityAHTMLRaw
      : null;
  const quantityBHTML =
    quantityBHTMLRaw != null
      ? renderMathToHtml(quantityBHTMLRaw) ?? quantityBHTMLRaw
      : null;

  const modern = {
    id: q.id,
    exam: q.exam,
    section: q.section,
    stem,
    stemHTML,
    choices: safeChoices,
    correctIndex,
    explanation,
    explainHTML: explanationHTML,
    difficulty: q.difficulty,
    badge: q.badge,
    kind: finalKind,
    quantityA: finalKind === "qc" ? (quantityAHTML ?? finalQuantityA ?? null) : null,
    quantityB: finalKind === "qc" ? (quantityBHTML ?? finalQuantityB ?? null) : null,
  };

  // legacy aliases
  const legacy = {
    prompt: stem,
    options: safeChoices,
    answerIndex: correctIndex,
    answer: safeChoices[correctIndex] ?? "",
    explanationHtml: explanation,
  };

  return { modern, legacy };
}

// Build payload that includes both nested and root-level fields (for old UI)
function responseWithQuestion(questionModern: ReturnType<typeof toClientShape>["modern"]) {
  const { legacy } = toClientShape(questionModern as any);
  return {
    question: questionModern,
    used: 0,
    source: "generator",
    // spread legacy + modern at root for older call sites
    ...legacy,
    ...questionModern,
  };
}

// ───────────────────────────────
// MAIN ROUTE HANDLER
// ───────────────────────────────
export async function POST(req: Request) {
  try {
    // 0) Auth or anonymous allowance
    const session = await getServerSession(authOptions);
    const cookieStore = cookies();
    const { userId: userIdSafe, isUnlimited } = resolvePracticeUser(session, cookieStore);
    const userId = userIdSafe;
    let quotaState = await getQuotaState(userIdSafe);
    if (!isUnlimited && quotaState.count >= DAILY_LIMIT) {
      const meta = quotaMeta(quotaState, false);
      return NextResponse.json(
        {
          quotaExceeded: true,
          ...meta,
        },
        { status: 429 }
      );
    }

    const respondWithQuestion = async (
      questionModern: ReturnType<typeof toClientShape>["modern"]
    ) => {
      if (!isUnlimited) {
        quotaState = await incrementQuotaState(userIdSafe, quotaState, 1);
      }
      const payload = {
        ...responseWithQuestion(questionModern),
        ...quotaMeta(quotaState, isUnlimited),
      };
      const res = NextResponse.json(payload, { status: 200 });
      res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      return res;
    };

    // 1) Input validation
    const body = await req.json().catch(() => ({}));
    const parsed = Input.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.issues }, { status: 400 });
    }

    const {
      exam,
      section,
      topic = "AUTO",
      difficulty: requestedDifficulty,
      studyMode = "random",
      mode: incomingMode,
    } = parsed.data;

    const rawMode =
      typeof (body as any)?.mode === "string" ? ((body as any).mode as string) : incomingMode;
    const canonicalMode =
      rawMode === "topic"
        ? "topic"
        : rawMode === "random"
        ? "random"
        : studyMode === "concept"
        ? "topic"
        : "random";
    const resolvedTopic =
      canonicalMode === "topic" && topic !== "AUTO"
        ? canonicalizeTopic({ exam, section, topic })
        : undefined;

    const topicNormalizedRaw = typeof topic === "string" ? topic.trim() : "";
    const topicAliasKey = topicNormalizedRaw.toLowerCase().replace(/[^a-z]/g, "");
    const verbalAlias = section === "Verbal" ? VERBAL_TOPIC_ALIAS[topicAliasKey] : undefined;

    const effectiveDifficulty: Diff =
      requestedDifficulty && requestedDifficulty !== "medium"
        ? requestedDifficulty
        : pickWeightedDifficulty();

    const rate = await enforceRateLimit(userIdSafe);
    if (!rate.ok) {
      const retryAfter = Math.max(1, rate.retryAfter ?? MIN_INTERVAL_SECONDS);
      const res = NextResponse.json(
        {
          error: rate.reason === "burst" ? "RATE_LIMIT_EXCEEDED" : "RATE_LIMIT_COOLDOWN",
          retryAfter,
        },
        { status: 429 }
      );
      res.headers.set("Retry-After", String(retryAfter));
      return res;
    }

    // 3) Avoid duplicates
    const recentAttempts = await prisma.attempt.findMany({
      where: { userId },
      take: 800,
      orderBy: { createdAt: "desc" },
      select: { questionId: true },
    });

    const attemptedIds = Array.from(new Set(recentAttempts.map((a) => a.questionId)));
    const attemptedQs =
      attemptedIds.length > 0
        ? await prisma.question.findMany({
            where: { id: { in: attemptedIds } },
            select: { stem: true, choices: true },
          })
        : [];

    const recentServed = getRecentQuestionHashes(userId);
    const avoidHashes = Array.from(
      new Set([
        ...attemptedQs.map((q) => questionHash(q.stem, q.choices)),
        ...recentServed,
      ])
    );

    // ───────────────────────────────
    // GRE QUANT GENERATION
    // ───────────────────────────────
    if (exam === "GRE" && section === "Quant") {
      const wantTopic = resolvedTopic?.kind === "Quant" ? resolvedTopic.value : undefined;
      const difficultyPreferences = difficultyPreference(effectiveDifficulty);
      const reuseCandidates = await prisma.question.findMany({
        where: {
          exam: "GRE",
          section: "Quant",
          difficulty: { in: difficultyPreferences },
          ...(wantTopic ? { topic: wantTopic } : {}),
          ...(attemptedIds.length
            ? { id: { notIn: attemptedIds.slice(0, 400) } }
            : {}),
        },
        select: {
          id: true,
          stem: true,
          choices: true,
          answer: true,
          explanation: true,
          topic: true,
          difficulty: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      });

      const reuseFiltered = reuseCandidates
        .filter((candidate) =>
          validVerbalCategory(
            typeof candidate.topic === "string" ? candidate.topic : undefined
          )
        )
        .filter((candidate) => {
          const hash = questionHash(candidate.stem, candidate.choices ?? []);
          return !avoidHashes.includes(hash);
        });
      const freshnessCutoff = new Date(Date.now() - REUSE_FRESHNESS_WINDOW_MS);
      const prioritizedPools = difficultyPreferences
        .map((score) => reuseFiltered.filter((candidate) => candidate.difficulty === score));
      const bestDifficultyPool =
        prioritizedPools.find((pool) => pool.length > 0) ?? reuseFiltered;
      const reuseOlder = bestDifficultyPool.filter(
        (candidate) => candidate.createdAt < freshnessCutoff
      );
      const reuseFallbackPool =
        reuseOlder.length > 0 ? reuseOlder : bestDifficultyPool;
      if (reuseFallbackPool.length > 0) {
        const picked = randomFromArray(reuseFallbackPool);
        const choices = Array.isArray(picked.choices) ? picked.choices : [];
        const correctIndex = Math.max(
          0,
          choices.findIndex((choice) => choice === picked.answer)
        );
        const actualDifficulty = scoreToDifficulty(picked.difficulty ?? difficultyPreferences[0] ?? 700);
        const { modern } = toClientShape({
          id: picked.id,
          stem: picked.stem,
          choices,
          correctIndex: correctIndex >= 0 ? correctIndex : 0,
          explanation: picked.explanation ?? "",
          exam: "GRE",
          section: "Quant",
          difficulty: actualDifficulty,
          badge: picked.topic ? `GRE – Quant (${picked.topic})` : undefined,
          kind: undefined,
          quantityA: undefined,
          quantityB: undefined,
        });

        rememberQuestionHash(
          userIdSafe,
          questionHash(modern.stem, modern.choices ?? [])
        );

        return respondWithQuestion(modern);
      }

      let generated: any;

      try {
        const batch = await generateGreQuantBatch({
          topic: wantTopic,
          difficulty: effectiveDifficulty,
          avoidHashes,
          batchSize: 3,
        });
        generated = batch[0];
      } catch {
        const basePoolRaw =
          GRE_QUESTIONS.filter((q) => {
            if (wantTopic && q.concept !== wantTopic) return false;
            return true;
          }) ?? [];
        const basePoolFiltered = basePoolRaw.filter((q) => q.difficulty !== "easy");
        const basePool = basePoolFiltered.length > 0 ? basePoolFiltered : basePoolRaw;
        let fallbackSource: typeof GRE_QUESTIONS | undefined;
        for (const prefScore of difficultyPreferences) {
          const prefLabel = scoreToDifficulty(prefScore);
          const candidates = basePool.filter((q) => q.difficulty === prefLabel);
          if (!fallbackSource && candidates.length) fallbackSource = candidates;
          const dedup = candidates.filter((item) => {
            const hash = questionHash(item.stem, item.choices ?? []);
            return !avoidHashes.includes(hash);
          });
          if (dedup.length > 0) {
            fallbackSource = dedup;
            break;
          }
        }
        if (!fallbackSource || fallbackSource.length === 0) {
          const dedupAll = basePool.filter((item) => {
            const hash = questionHash(item.stem, item.choices ?? []);
            return !avoidHashes.includes(hash);
          });
          fallbackSource = dedupAll.length > 0 ? dedupAll : basePool;
        }
        if (!fallbackSource || fallbackSource.length === 0) {
          fallbackSource = [pickRandomGreQuant(wantTopic)];
        }

        const chosen = randomFromArray(fallbackSource);
        const b = chosen;
        generated = {
          concept: b.concept,
          difficulty: b.difficulty,
          kind: (b as any).kind ?? "mcq",
          quantityA: (b as any).quantityA ?? null,
          quantityB: (b as any).quantityB ?? null,
          stem: b.stem,
          choices: b.choices,
          correctIndex: b.correctIndex,
          explanation: b.explanation || "See solution.",
          badge: b.badge,
        };
      }

      const ensuredExplanation = await ensureLatexExplanation({
        stem: generated.stem,
        choices: generated.choices,
        correctIndex: generated.correctIndex,
        existing: generated.explanation,
      });
      const enhancedStemRaw = enhancePlainContent(generated.stem);
      const enhancedExplanationRaw = enhancePlainContent(ensuredExplanation);
      const enhancedStem = renderMathToHtml(enhancedStemRaw) ?? enhancedStemRaw;
      const enhancedExplanation =
        renderMathToHtml(enhancedExplanationRaw) ?? enhancedExplanationRaw;
      const generatedDifficulty = (() => {
        const raw = typeof generated.difficulty === "string" ? generated.difficulty.toLowerCase() : "";
        if (raw === "easy" || raw === "medium" || raw === "hard") return raw as Diff;
        return effectiveDifficulty;
      })();

      const stored = await prisma.question.create({
        data: {
          exam: "GRE",
          section: "Quant",
          topic: generated.concept,
          stem: enhancedStem,
          choices: generated.choices,
          answer: generated.choices[generated.correctIndex] ?? "",
          explanation: enhancedExplanation,
          difficulty: difficultyToScore(generatedDifficulty),
        },
        select: { id: true },
      });

      const { modern } = toClientShape({
        id: stored.id,
        stem: enhancedStem,
        choices: generated.choices,
        correctIndex: generated.correctIndex,
        explanation: enhancedExplanation,
        exam: "GRE",
        section: "Quant",
        difficulty: generatedDifficulty,
        badge: `GRE – Quant (${generated.concept})`,
        kind: generated.kind,
        quantityA: generated.quantityA,
        quantityB: generated.quantityB,
      });

      rememberQuestionHash(
        userIdSafe,
        questionHash(modern.stem, modern.choices ?? [])
      );

      return respondWithQuestion(modern);
    }

    if (exam === "GMAT" && section === "Quant") {
      const wantTopic = resolvedTopic?.kind === "Quant" ? resolvedTopic.value : undefined;
      const difficultyLabels = difficultyPreference(effectiveDifficulty).map(scoreToDifficulty);

      const basePoolRaw =
        GMAT_QUESTIONS.filter((q) => {
          if (wantTopic && q.concept !== wantTopic) return false;
          return true;
        }) ?? [];
      const basePool = basePoolRaw.length > 0 ? basePoolRaw : GMAT_QUESTIONS;

      const deduped = (pool: typeof GMAT_QUESTIONS) =>
        pool.filter((item) => {
          const hash = questionHash(item.stem, item.choices ?? []);
          return !avoidHashes.includes(hash);
        });

      let selectionPool: typeof GMAT_QUESTIONS = [];
      for (const label of difficultyLabels) {
        const candidates = basePool.filter((q) => q.difficulty === label);
        if (!candidates.length) continue;
        if (!selectionPool.length) selectionPool = candidates;
        const dedup = deduped(candidates);
        if (dedup.length) {
          selectionPool = dedup;
          break;
        }
      }
      if (!selectionPool.length) {
        const dedupAll = deduped(basePool);
        selectionPool = dedupAll.length ? dedupAll : basePool;
      }
      if (!selectionPool.length) {
        selectionPool = [pickRandomGmatQuant(wantTopic)];
      }

      const chosen = randomFromArray(selectionPool);
      const ensuredExplanation = await ensureLatexExplanation({
        stem: chosen.stem,
        choices: chosen.choices,
        correctIndex: chosen.correctIndex,
        existing: chosen.explanation,
      });
      const enhancedStemRaw = enhancePlainContent(chosen.stem);
      const enhancedExplanationRaw = enhancePlainContent(ensuredExplanation);
      const enhancedStem = renderMathToHtml(enhancedStemRaw) ?? enhancedStemRaw;
      const enhancedExplanation =
        renderMathToHtml(enhancedExplanationRaw) ?? enhancedExplanationRaw;
      const generatedDifficulty =
        chosen.difficulty === "easy" || chosen.difficulty === "medium" || chosen.difficulty === "hard"
          ? chosen.difficulty
          : effectiveDifficulty;

      const stored = await prisma.question.create({
        data: {
          exam: "GMAT",
          section: "Quant",
          topic: chosen.concept,
          stem: enhancedStem,
          choices: chosen.choices,
          answer: chosen.choices[chosen.correctIndex] ?? "",
          explanation: enhancedExplanation,
          difficulty: difficultyToScore(generatedDifficulty),
        },
        select: { id: true },
      });

      const { modern } = toClientShape({
        id: stored.id,
        stem: enhancedStem,
        choices: chosen.choices,
        correctIndex: chosen.correctIndex,
        explanation: enhancedExplanation,
        exam: "GMAT",
        section: "Quant",
        difficulty: generatedDifficulty,
        badge: chosen.badge ?? `GMAT – Quant (${chosen.concept})`,
        kind: chosen.kind ?? "mcq",
        quantityA: null,
        quantityB: null,
      });

      rememberQuestionHash(
        userIdSafe,
        questionHash(modern.stem, modern.choices ?? [])
      );

      return respondWithQuestion(modern);
    }

    // ───────────────────────────────
    // GRE VERBAL
    // ───────────────────────────────
    if (exam === "GRE" && section === "Verbal") {
      let category = resolvedTopic?.kind === "Verbal" ? resolvedTopic.value : undefined;
      if (verbalAlias === "Text Completion" || verbalAlias === "Sentence Equivalence") {
        category = verbalAlias;
      }
      if (category === "Reading Comprehension") {
        category = undefined;
      }

      const difficultyPreferences = difficultyPreference(effectiveDifficulty);
      const isTextCompletion = category === "Text Completion";
      const isSentenceEquivalence = category === "Sentence Equivalence";

      async function reuseVerbalQuestion(topicFilter?: string) {
        const baseWhere: Prisma.QuestionWhereInput = {
          exam: "GRE",
          section: "Verbal",
          difficulty: { in: difficultyPreferences },
          ...(topicFilter ? { topic: topicFilter } : {}),
          ...(attemptedIds.length
            ? { id: { notIn: attemptedIds.slice(0, 400) } }
            : {}),
        };

        const candidates = await prisma.question.findMany({
          where: baseWhere,
          select: {
            id: true,
            stem: true,
            choices: true,
            answer: true,
            explanation: true,
            topic: true,
            difficulty: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 30,
        });

        const filtered = candidates
          .filter((candidate) =>
            validVerbalCategory(
              typeof candidate.topic === "string" ? candidate.topic : undefined
            )
          )
          .filter((candidate) => {
            const hash = questionHash(candidate.stem, candidate.choices ?? []);
            return !avoidHashes.includes(hash);
          });

        const freshnessCutoff = new Date(Date.now() - REUSE_FRESHNESS_WINDOW_MS);
        const prioritizedPools = difficultyPreferences
          .map((score) => filtered.filter((candidate) => candidate.difficulty === score));
        const bestDifficultyPool =
          prioritizedPools.find((pool) => pool.length > 0) ?? filtered;
        const reuseOlder = bestDifficultyPool.filter(
          (candidate) => candidate.createdAt < freshnessCutoff
        );
        const pool = reuseOlder.length > 0 ? reuseOlder : bestDifficultyPool;
        if (!pool.length) return null;

        const picked = randomFromArray(pool);
        const choices = Array.isArray(picked.choices) ? picked.choices : [];
        const correctIndex = Math.max(
          0,
          choices.findIndex((choice) => choice === picked.answer)
        );
        const actualDifficulty = scoreToDifficulty(
          picked.difficulty ?? difficultyPreferences[0] ?? 700
        );
        const { modern } = toClientShape({
          id: picked.id,
          stem: picked.stem,
          choices,
          correctIndex: correctIndex >= 0 ? correctIndex : 0,
          explanation: picked.explanation ?? "",
          exam: "GRE",
          section: "Verbal",
          difficulty: actualDifficulty,
          badge: picked.topic ? `GRE – Verbal (${picked.topic})` : undefined,
        });

        rememberQuestionHash(
          userIdSafe,
          questionHash(modern.stem, modern.choices ?? [])
        );

        return respondWithQuestion(modern);
      }

      if (isTextCompletion) {
        const reused = await reuseVerbalQuestion("Text Completion");
        if (reused) return reused;

        const batch = await generateGreTextCompletion({
          difficulty: effectiveDifficulty,
          avoidHashes,
        });
        const generated: any = batch[0];

        const ensuredExplanation = await ensureLatexExplanation({
          stem: generated.stem,
          choices: generated.choices,
          correctIndex: generated.correctIndex,
          existing: generated.explanation,
        });
        const enhancedStemRaw = enhancePlainContent(generated.stem);
        const enhancedExplanationRaw = enhancePlainContent(ensuredExplanation);
        const enhancedStem = renderMathToHtml(enhancedStemRaw) ?? enhancedStemRaw;
        const enhancedExplanation =
          renderMathToHtml(enhancedExplanationRaw) ?? enhancedExplanationRaw;
        const generatedDifficulty = (() => {
          const raw = typeof generated.difficulty === "string" ? generated.difficulty.toLowerCase() : "";
          if (raw === "easy" || raw === "medium" || raw === "hard") return raw as Diff;
          return effectiveDifficulty;
        })();

        const stored = await prisma.question.create({
          data: {
            exam: "GRE",
            section: "Verbal",
            topic: "Text Completion",
            stem: enhancedStem,
            choices: generated.choices,
            answer: generated.choices[generated.correctIndex] ?? "",
            explanation: enhancedExplanation,
            difficulty: difficultyToScore(generatedDifficulty),
          },
          select: { id: true },
        });

        const { modern } = toClientShape({
          id: stored.id,
          stem: enhancedStem,
          choices: generated.choices,
          correctIndex: generated.correctIndex,
          explanation: enhancedExplanation,
          exam: "GRE",
          section: "Verbal",
          difficulty: generatedDifficulty,
          badge: "GRE – Verbal (Text Completion)",
        });

        rememberQuestionHash(
          userIdSafe,
          questionHash(modern.stem, modern.choices ?? [])
        );

        return respondWithQuestion(modern);
      }

      if (isSentenceEquivalence) {
        const reused = await reuseVerbalQuestion("Sentence Equivalence");
        if (reused) return reused;

        const batch = await generateGreSentenceEquivalence({
          difficulty: effectiveDifficulty,
          avoidHashes,
        });
        const generated: any = batch[0];

        const ensuredExplanation = await ensureLatexExplanation({
          stem: generated.stem,
          choices: generated.choices,
          correctIndex: generated.correctIndex,
          existing: generated.explanation,
        });
        const enhancedStem = enhancePlainContent(generated.stem);
        const enhancedExplanation = enhancePlainContent(ensuredExplanation);
        const generatedDifficulty = (() => {
          const raw = typeof generated.difficulty === "string" ? generated.difficulty.toLowerCase() : "";
          if (raw === "easy" || raw === "medium" || raw === "hard") return raw as Diff;
          return effectiveDifficulty;
        })();

        const stored = await prisma.question.create({
          data: {
            exam: "GRE",
            section: "Verbal",
            topic: "Sentence Equivalence",
            stem: enhancedStem,
            choices: generated.choices,
            answer: generated.choices[generated.correctIndex] ?? "",
            explanation: enhancedExplanation,
            difficulty: difficultyToScore(generatedDifficulty),
          },
          select: { id: true },
        });

        const { modern } = toClientShape({
          id: stored.id,
          stem: enhancedStem,
          choices: generated.choices,
          correctIndex: generated.correctIndex,
          explanation: enhancedExplanation,
          exam: "GRE",
          section: "Verbal",
          difficulty: generatedDifficulty,
          badge: "GRE – Verbal (Sentence Equivalence)",
        });

        rememberQuestionHash(
          userId,
          questionHash(modern.stem, modern.choices ?? [])
        );

        return respondWithQuestion(modern);
      }

      const reuseRc = await reuseVerbalQuestion(category);
      if (reuseRc) return reuseRc;

      const batch = await generateGreRcBatch({
        category,
        difficulty: effectiveDifficulty,
        avoidHashes,
        withPassage: true,
      });
      const generated: any = batch[0];

      const rawPassage =
        typeof generated.passage === "string" ? generated.passage.trim() : "";
      const combinedStem = rawPassage
        ? `Passage:\n${rawPassage}\n\nQuestion:\n${generated.stem}`
        : generated.stem;

      const ensuredExplanation = await ensureLatexExplanation({
        stem: combinedStem,
        choices: generated.choices,
        correctIndex: generated.correctIndex,
        existing: generated.explanation,
      });
      const enhancedStem = enhancePlainContent(combinedStem);
      const enhancedExplanation = enhancePlainContent(ensuredExplanation);
      const generatedDifficulty = (() => {
        const raw = typeof generated.difficulty === "string" ? generated.difficulty.toLowerCase() : "";
        if (raw === "easy" || raw === "medium" || raw === "hard") return raw as Diff;
        return effectiveDifficulty;
      })();

      const stored = await prisma.question.create({
        data: {
          exam: "GRE",
          section: "Verbal",
          topic: generated.concept,
          stem: enhancedStem,
          choices: generated.choices,
          answer: generated.choices[generated.correctIndex] ?? "",
          explanation: enhancedExplanation,
          difficulty: difficultyToScore(generatedDifficulty),
        } as any,
        select: { id: true },
      });

      const { modern } = toClientShape({
        id: stored.id,
        stem: enhancedStem,
        choices: generated.choices,
        correctIndex: generated.correctIndex,
        explanation: enhancedExplanation,
        exam: "GRE",
        section: "Verbal",
        difficulty: generatedDifficulty,
        badge: `GRE – Verbal (${generated.concept})`,
      });

      rememberQuestionHash(
        userIdSafe,
        questionHash(modern.stem, modern.choices ?? [])
      );

      return respondWithQuestion(modern);
    }

    // ───────────────────────────────
    // FALLBACK: USE DAILY QUEUE
    // ───────────────────────────────
    const today = startOfTodayUTC();

    await ensureDailyQueue(userId, {
      exam,
      section,
      topic: resolvedTopic?.value,
      difficulty: requestedDifficulty || "medium",
      target: PRACTICE_LIMIT,
    });

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let nextItem = await tx.dailyQueueItem.findFirst({
        where: { userId, date: today, servedAt: null },
        orderBy: { order: "asc" },
        include: { question: true },
      });

      const attemptedSet = new Set(attemptedIds);
      let safety = 0;

      const invalidForRequest = (item: typeof nextItem) => {
        if (!item) return false;
        const q = item.question;
        if (!q) return true;
        if (q.exam !== exam || q.section !== section) return true;
        if (section === "Verbal") {
          return !validVerbalCategory(
            typeof q.topic === "string" ? q.topic : undefined
          );
        }
        if (section === "Quant") {
          const examForValidation = q.exam === "GMAT" ? "GMAT" : "GRE";
          return !validQuantCategory(
            examForValidation,
            typeof q.topic === "string" ? q.topic : undefined
          );
        }
        return false;
      };

      while (
        nextItem &&
        (attemptedSet.has(nextItem.questionId) || invalidForRequest(nextItem)) &&
        safety < 200
      ) {
        await tx.dailyQueueItem.update({ where: { id: nextItem.id }, data: { servedAt: new Date() } });
        nextItem = await tx.dailyQueueItem.findFirst({
          where: { userId, date: today, servedAt: null },
          orderBy: { order: "asc" },
          include: { question: true },
        });
        safety++;
      }

      if (!nextItem) return { q: null as any };

      await tx.dailyQueueItem.update({ where: { id: nextItem.id }, data: { servedAt: new Date() } });
      return { q: nextItem.question };
    });

    if (!result.q) {
      return NextResponse.json({ error: "NO_QUESTION_AVAILABLE" }, { status: 500 });
    }

    const finalExplanation = await ensureLatexExplanation({
      stem: result.q.stem,
      choices: result.q.choices ?? [],
      correctIndex: Math.max(0, result.q.choices?.indexOf(result.q.answer) ?? 0),
      existing: result.q.explanation,
    });
    const enhancedStem = enhancePlainContent(result.q.stem);
    const enhancedExplanation = enhancePlainContent(finalExplanation);

    const { modern } = toClientShape({
      id: result.q.id,
      stem: enhancedStem,
      choices: result.q.choices ?? ["Option A", "Option B"],
      correctIndex: Math.max(0, result.q.choices?.indexOf(result.q.answer) ?? 0),
      explanation: enhancedExplanation,
      exam: result.q.exam,
      section: result.q.section,
      difficulty:
        result.q.difficulty === 700 ? "hard" : result.q.difficulty === 600 ? "medium" : "easy",
      badge: `${result.q.exam} – ${result.q.section}`,
    });

    rememberQuestionHash(
      userId,
      questionHash(modern.stem, modern.choices ?? [])
    );

    return respondWithQuestion(modern);
  } catch (err: any) {
    console.error("[next-question] error:", err);
    return NextResponse.json({ error: "SERVER_ERROR", message: err?.message ?? "Unknown" }, { status: 500 });
  }
}
