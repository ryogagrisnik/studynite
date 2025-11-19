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
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { checkQuestionQuality } from "@/lib/quality";
import { cleanReadableText } from "@/lib/math/cleanText";

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
function parseWeights(raw?: string | null): [number, number, number] {
  const def: [number, number, number] = [0.2, 0.55, 0.25]; // easy, medium, hard
  if (!raw) return def;
  const parts = raw.split(/[;,\s]+/).map((v) => Number(v)).filter((n) => Number.isFinite(n));
  if (parts.length !== 3) return def;
  const sum = parts.reduce((a, b) => a + b, 0) || 1;
  return [parts[0] / sum, parts[1] / sum, parts[2] / sum] as [number, number, number];
}

function pickWeightedDifficulty(): Diff {
  const [we, wm, wh] = parseWeights(process.env.NEXT_QUESTION_DIFFICULTY_WEIGHTS || process.env.DIFFICULTY_WEIGHTS);
  const r = Math.random();
  if (r < we) return "easy";
  if (r < we + wm) return "medium";
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

function isChoiceSetValid(choices: unknown, correctIndex: unknown): boolean {
  if (!Array.isArray(choices) || choices.length < 2) return false;
  if (!Number.isFinite(Number(correctIndex))) return false;
  const idx = Number(correctIndex);
  if (idx < 0 || idx >= choices.length) return false;
  // ensure all options are non-empty strings
  for (const c of choices) {
    if (typeof c !== 'string' || !c.trim()) return false;
  }
  return true;
}

function normalizeChoiceText(value: string): string {
  const plain = String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  return plain;
}

function hasDuplicateChoices(choices: string[]): boolean {
  const seen = new Set<string>();
  for (const c of choices) {
    const n = normalizeChoiceText(c);
    if (seen.has(n)) return true;
    seen.add(n);
  }
  return false;
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

function indexToLetter(i: number): string {
  const n = Math.max(0, Math.floor(i));
  return String.fromCharCode(65 + (n % 26));
}

async function ensureLatexExplanation(args: {
  stem: string;
  choices: string[];
  correctIndex: number;
  existing?: string | null;
}): Promise<string> {
  const { stem, choices, correctIndex, existing } = args;
  // Always favor the standardized explainer pipeline over any legacy
  // explanation text stored in the bank/DB. We keep a cache keyed by stem
  // + choices so regenerated explanations are reused cheaply.
  const ver = (process.env.EXPLANATION_CACHE_VERSION || '2').trim();
  const cacheKey = `exp:v${ver}:${questionHash(stem, choices)}:${correctIndex}`;
  const WORD_MIN = Math.max(60, Number(process.env.EXPLANATION_WORD_MIN || '80'));
  const wordCount = (s: string) => (s || '').trim().split(/\s+/).filter(Boolean).length;

  let text = "";
  try {
    const cached = await redis.get(cacheKey);
    if (typeof cached === "string" && cached.trim().length >= 40) {
      text = cached.trim();
    }
  } catch {}

  // If no cached explanation (or cache is clearly bad/too short), generate a
  // fresh, step‑by‑step one using the shared explainer.
  if (!text || wordCount(text) < WORD_MIN) {
    text = await generateExplanation({
      stem,
      choices,
      correctIndex,
      targetWords: getExplanationTargetWords(),
    });
  }

  let sanitized = sanitizeExplanation(text);

  // Ensure completeness unless passthrough mode is enabled
  try {
    const passthrough = (process.env.EXPLANATION_PASSTHROUGH || 'true').toLowerCase() === 'true';
    if (!passthrough) {
      const alreadyHasAnswer = /\bAnswer\s*:/i.test(sanitized);
      if (!alreadyHasAnswer && Array.isArray(choices) && choices.length > 0) {
        const safeIdx = Math.min(Math.max(correctIndex, 0), Math.max(0, choices.length - 1));
        const label = indexToLetter(safeIdx);
        const choiceText = String(choices[safeIdx] ?? '').trim();
        const answerLine = `\n\nAnswer: ${label}. ${choiceText}`;
        sanitized = sanitized.trimEnd() + answerLine;
      }
      if (!/\bCheck\s*:/i.test(sanitized)) {
        sanitized = sanitized.trimEnd() + "\n\nCheck: Substitute or reason about units to confirm.";
      }
    }
  } catch {}

  // Heuristic: detect obviously broken tokens that impair readability
  const looksBroken = (s: string) =>
    /(?:[^\\]rac\b|[^\\]imes\b|\\t|&lt;|\bext\{|\begin\{[^}]*$|\bend\{[^}]*$|={2,}|\\binom(?!\s*\{)|\bThis can be expressed as\s*:\s*=)/i.test(
      s,
    ) ||
    // Common partially-clipped algebra like "(7-3)/(6-" or "C = -"
    /\(\s*\d+\s*-\s*\d+\s*\)\s*\/\s*\(\s*\d+\s*-\s*$/m.test(s) ||
    /\bC\s*=\s*-\s*(?:$|\n|\.)/m.test(s) ||
    // Coordinates missing a second component, e.g. "(4," or "(2, )"
    /\(\s*\d+\s*,\s*(?:\)|and|\n|$)/m.test(s);

  // Only attempt heavy repair when passthrough mode is disabled. In the new
  // plain-text explanation flow we prefer short, readable prose over trying to
  // salvage LaTeX fragments, which previously caused clipping like "ory=x +".
  const repairEnabled =
    (process.env.EXPLANATION_PASSTHROUGH || "true").toLowerCase() !== "true";

  if (repairEnabled && looksBroken(sanitized)) {
    // Try a one-shot rewrite to friendly prose + block math
    const repairKey = `exp:repair:v${ver}:${questionHash(sanitized, [])}`;
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
          await redis.set(repairKey, sanitized); await redis.expire(repairKey, 30 * 24 * 60 * 60);
        } catch {}
      }
    } catch {}
  }
  try {
    // Cache for 7 days
    await redis.set(cacheKey, sanitized);
    await redis.set(cacheKey, sanitized); await redis.expire(cacheKey, 7 * 24 * 60 * 60);
  } catch {}
  // If still too short and not in passthrough, ask model once more for a fuller write-up
  try {
    const passthrough = (process.env.EXPLANATION_PASSTHROUGH || 'true').toLowerCase() === 'true';
    if (!passthrough && wordCount(sanitized) < WORD_MIN) {
      const richer = await generateExplanation({ stem, choices, correctIndex, targetWords: Math.max(WORD_MIN + 40, 140) });
      const cleaned = sanitizeExplanation(richer);
      if (wordCount(cleaned) >= WORD_MIN) return cleaned;
    }
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

// Preference order when trying to reuse or fall back to bank questions.
// Map desired label -> numeric difficulty scores to search, in order.
const DIFFICULTY_PREF_MAP: Record<Diff, number[]> = {
  // When user wants easy, try easy first, then medium, then hard
  easy: [500, 600, 700],
  // When user wants medium, try medium, then hard, then easy
  medium: [600, 700, 500],
  // When user wants hard, try hard, then medium, then easy
  hard: [700, 600, 500],
};

function difficultyPreference(base: Diff): number[] {
  return DIFFICULTY_PREF_MAP[base] ?? [700, 600, 500];
}

const REUSE_FRESHNESS_WINDOW_MS = 1000 * 60 * 20; // 20 minutes

function hasHtmlMarkup(text: string): boolean {
  // Detect tags even if whitespace appears after '<' (e.g., "< spanclass=...")
  return /<\s*\/?\s*[a-z][\s\S]*>/i.test(text);
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
  // Allow equations that start with variables, numbers, or LaTeX commands like \sum, \frac, etc.
  const inlineEquationRegex =
    /(^|[\s(])(-?\s*(?:\\[A-Za-z]+(?:_{[^}]+}|\^{[^}]+})?|[A-Za-z](?:_{[0-9]+}|[0-9]*)?|[0-9]+(?:\.[0-9]+)?)(?:[A-Za-z0-9+\-*/^(){}\\\s]*?)\s*(?:=|<|>|≤|≥)\s*-?\s*(?:\\[A-Za-z]+(?:_{[^}]+}|\^{[^}]+})?|[A-Za-z](?:_{[0-9]+}|[0-9]*)?|[0-9]+(?:\.[0-9]+)?)(?:[A-Za-z0-9+\-*/^(){}\\\s]*?))(?=(?:[,.;:!?)]|\s|$))/g;

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
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtmlPreservingBreaks(value: string): string {
  return String(value || '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n\n')
    .replace(/<\s*\/div\s*>/gi, '\n\n')
    .replace(/<\s*\/li\s*>/gi, '\n')
    .replace(/<\s*h[1-6][^>]*>/gi, '\n')
    .replace(/<\s*\/h[1-6]\s*>/gi, '\n')
    .replace(/<[\s\S]+?>/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function repairCorruptedKatex(html: string): string {
  let s = String(html || "");
  if (!s) return s;
  // Decode entities again to surface any hidden markup
  s = decodeEntities(s);
  // Normalize unicode minus to hyphen
  s = s.replace(/\u2212/g, '-');
  // Common broken sequences missing '<' and '-' characters
  s = s.replace(/spanclass=/g, '<span class=');
  s = s.replace(/mathxmlns=/g, '<math xmlns=');
  s = s.replace(/annotationencoding=/g, '<annotation encoding=');
  s = s.replace(/katex−/g, 'katex-');
  s = s.replace(/aria−hidden/g, 'aria-hidden');
  s = s.replace(/reset−size/g, 'reset-size');
  s = s.replace(/vlist−/g, 'vlist-');
  // Backslashes that slipped into class names
  s = s.replace(/m\\frac/g, 'mfrac').replace(/\\frac-line/g, 'frac-line');
  // Undo accidental frac conversions inside the MathML xmlns
  s = s.replace(/\\frac\s*\{org\}\s*\{1998\}/gi, 'org/1998');
  s = s.replace(/\\frac\s*\{Math\}\s*\{MathML\}/gi, 'Math/MathML');
  // Remove bulky/broken MathML blocks; keep HTML renderer only
  s = s.replace(/<span class="katex">\s*<span class="katex[-−]mathml">[\s\S]*?<\/span>\s*<span class="katex[-−]html"/g, '<span class="katex"><span class="katex-html"');
  // Replace MathJax pending spans with freshly rendered KaTeX
  s = s.replace(/<span class="mathjax-pending"[^>]*data-mathjax="([^"]+)"[^>]*>[\s\S]*?<\/span>/g, (_m, payload) => {
    const inner = decodeEntities(String(payload));
    const rendered = renderMathToHtml(inner) ?? inner;
    return rendered;
  });
  // Collapse stray paragraph splits that landed inside math
  s = s.replace(/<\/p>\s*<p>/g, ' ');
  return s;
}

function enhancePlainContent(raw: string | null | undefined): string {
  // Pre-flight math fixes first, then decode HTML entities
  const pre = preflightFixMath(String(raw ?? ""));
  const decoded = decodeEntities(pre.text);
  // If there is HTML markup after decoding entities, prefer converting it to
  // readable plain text unless it looks like safe, simple markup. KaTeX/MathJax
  // fragments often leak unreadable spans; convert those to text here.
  if (hasHtmlMarkup(decoded)) {
    const looksMathMarkup =
      /katex|mathjax/i.test(decoded) ||
      /<\s*svg|<\s*math/i.test(decoded) ||
      /<\s*span[^>]*class\s*=|<\s*span|<\s*\/\s*span/i.test(decoded);
    if (looksMathMarkup) {
      const stripped = stripHtmlPreservingBreaks(decoded);
      // Continue through normalization pipeline with plain text
      const normalized = normalizeLooseTex(stripped);
      return normalized;
    }
    return decoded;
  }
  // Normalize sloppy LaTeX, then apply friendly language, then simple math helpers
  const text = normalizeLooseTex(decoded.trim());
  if (!text) return "";
  const friendly = friendlyizeLanguage(text);
  // Repair earlier replacements of LaTeX control words if they appear as prose tokens
  const mathFixed = friendly
    .replace(/\bsum\s*:/gi, "\\sum ")
    .replace(/\bproduct\s*:/gi, "\\prod ");
  // Ensure steps formatting: line breaks and spacing for readability
  function spaceStructuredSteps(input: string): string {
    let s = input;
    s = s.replace(/\s+Steps:/i, '\n\nSteps:');
    s = s.replace(/\s+Answer:/i, '\n\nAnswer:');
    // Put each numbered item on its own paragraph
    s = s.replace(/\s*(\d{1,2}[\)\.])\s+/g, '\n\n$1 ');
    // Trim any extra newlines after the label
    s = s.replace(/Steps:\s*\n+/i, 'Steps:\n\n');
    // If the author used signposts (First/Next/Finally), convert them to numbered steps
    let counter = 0;
    const signpost = /\b(First|Firstly|Second|Secondly|Third|Then|Next|After that|Finally|Lastly)\b\s*[:,]?\s*/gi;
    s = s.replace(signpost, (m) => {
      counter += 1;
      const n = counter;
      return `\n\n${n}) `;
    });
    // If we created numbered steps but there is no explicit Steps: label, add one at the top
    if (counter > 0 && !/\bSteps:\b/i.test(s)) {
      s = s.replace(/^/, 'Steps:\n\n');
    }
    // Ensure "Plan:" starts on its own line if present
    s = s.replace(/\s+Plan:/i, '\n\nPlan:');
    // Ensure "Check:" starts on its own line
    s = s.replace(/\s+Check:/i, '\n\nCheck:');
    return s;
  }
  const structured = spaceStructuredSteps(mathFixed);
  let normalized = normalizeSimplePowers(normalizeSimpleFractions(structured))
    .replace(
      /\. (Therefore|Thus|Hence|As a result|Consequently|This means|So\b)/g,
      '.\n\n$1'
    );

  // Optional simple style: collapse into a single readable narrative and
  // remove formal labels like Plan/Steps/Answer.
  const SIMPLE_STYLE = (process.env.EXPLANATION_FORMAT || process.env.EXPLANATION_STYLE || 'simple').toLowerCase();
  if (SIMPLE_STYLE === 'simple' || SIMPLE_STYLE === 'free') {
    // Extract an "Answer:" line if present to append at the end.
    let answerLine = '';
    normalized = normalized.replace(/\bAnswer\s*:\s*([\s\S]*?)(?=\n\n|\nCheck:|$)/i, (_m, ans) => {
      answerLine = String(ans || '').trim();
      return '';
    });
    // Remove Plan:, Steps:, Check: labels and numbered step markers
    normalized = normalized
      .replace(/\bPlan\s*:\s*/gi, '')
      .replace(/\bSteps\s*:\s*/gi, '')
      .replace(/\bCheck\s*:\s*/gi, '')
      .replace(/^[ \t]*\d{1,2}[\)\.][ \t]*/gm, '')
      .replace(/\n{2,}/g, '\n\n');
    // Use a friendly narrative without a fixed lead-in
    normalized = normalized.trim();
    if (answerLine) {
      const suffix = answerLine.replace(/^(the\s*)?answer\s*:?\s*/i, '').trim();
      if (suffix) normalized = normalized.replace(/\s*$/, `. Final answer: ${suffix}.`);
    }
  }
  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Escape plain text but keep LaTeX math segments (\\( ... \\) or \\[ ... \\]) intact
  function escapeOutsideMath(input: string): string {
    let out = '';
    let i = 0;
    const n = input.length;
    while (i < n) {
      const iInline = input.indexOf('\\(', i);
      const iDisp = input.indexOf('\\[', i);
      let next = -1;
      let kind: '(' | '[' | null = null;
      if (iInline !== -1 && (iDisp === -1 || iInline < iDisp)) { next = iInline; kind = '('; }
      else if (iDisp !== -1) { next = iDisp; kind = '['; }
      if (next === -1) {
        out += escapeHtml(input.slice(i));
        break;
      }
      // escape outside
      out += escapeHtml(input.slice(i, next));
      // copy math segment unchanged
      const close = kind === '(' ? '\\)' : '\\]';
      const j = input.indexOf(close, next + 2);
      if (j === -1) {
        // no closing; just append rest
        out += input.slice(next);
        break;
      }
      // Remove any stray HTML tags that leaked inside the math segment
      const mathPayload = input.slice(next, j + 2).replace(/<[^>]+>/g, '');
      out += mathPayload;
      i = j + 2;
    }
    return out;
  }

  const paragraphs = normalized
    .split(/\n{2,}/g)
    .map((segment) => segment.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .map((segment) => {
      const withMath = wrapInlineMathSegments(segment);
      const withStrong = withMath.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      const safe = escapeOutsideMath(withStrong);
      return `<p>${safe}</p>`;
    });
  return paragraphs.join("");
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

function toParagraphsFromText(input: string): string {
  const raw0 = String(input || '').replace(/\r\n?/g, '\n');
  // Remove renderer artifact tokens that sometimes leak into plain text
  function purgeRendererNoise(s: string): string {
    let t = s;
    // Normalize unicode minus to hyphen
    t = t.replace(/\u2212/g, '-');
    // Drop common KaTeX/MathJax artifact tokens when they appear as plaintext
    t = t.replace(/\b(?:spanclass|katex(?:−|-)?html|mathjax-pending|vlist(?:-t| -r| -s)?|pstrut|sizing(?:reset)?|mtight|mord|mspace|msupsub|mopen(?:nulldelimiter)?|mclose(?:nulldelimiter)?|base|strut|aria(?:−|-)?hidden)\b[^\n]*/gi, ' ');
    // Remove leaked attribute dumps
    t = t.replace(/data-mathjax\s*=\s*"[^"]*"/gi, ' ');
    t = t.replace(/data-mathjax\s*=\s*'[^']*'/gi, ' ');
    t = t.replace(/aria-hidden\s*=\s*"[^"]*"/gi, ' ');
    // Remove weird lexer remains like mt2 + invisible char + "> or similar
    t = t.replace(/[A-Za-z0-9_-]{1,8}[\u200B\u200C\u200D]?\"?>/g, ' ');
    // Remove any lingering angle-bracket chunks that are not part of LaTeX
    t = t.replace(/<[\s\S]*?>/g, ' ');
    // Collapse odd quotes introduced by attribute dumps
    t = t.replace(/&quot;|"|&#39;/g, ' ');
    // Clean repeated dashes and stray punctuation noise
    t = t.replace(/\s{2,}/g, ' ').replace(/\s*\n\s*/g, '\n');
    return t;
  }
  const raw = purgeRendererNoise(raw0).trim();
  if (!raw) return '';
  const parts = raw.split(/\n{2,}/g).map(s => s.trim()).filter(Boolean);

  // Escape HTML outside math segments so any leftover '<' is shown literally,
  // while math remains in LaTeX delimiters for client-side rendering.
  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeOutsideMath(input: string): string {
    let out = '';
    let i = 0;
    const n = input.length;
    while (i < n) {
      const iInline = input.indexOf('\\(', i);
      const iDisp = input.indexOf('\\[', i);
      let next = -1;
      let kind: '(' | '[' | null = null;
      if (iInline !== -1 && (iDisp === -1 || iInline < iDisp)) { next = iInline; kind = '('; }
      else if (iDisp !== -1) { next = iDisp; kind = '['; }
      if (next === -1) { out += escapeHtml(input.slice(i)); break; }
      out += escapeHtml(input.slice(i, next));
      const close = kind === '(' ? '\\)' : '\\]';
      const j = input.indexOf(close, next + 2);
      if (j === -1) { out += escapeHtml(input.slice(next)); break; }
      const mathPayload = input.slice(next, j + 2).replace(/<[^>]+>/g, '');
      out += mathPayload;
      i = j + 2;
    }
    return out;
  }

  return parts.map(s => `<p>${escapeOutsideMath(s)}</p>`).join('');
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
  const stemHTML = renderMathToHtml(stemHTMLRaw) ?? stemHTMLRaw;
  // For explanations, favor plain, readable text. Do not run the heavy
  // math/markup normalizer that can clip tokens; instead, strip any residual
  // HTML noise and build simple paragraphs from the cleaned text.
  const explanationPlain = cleanReadableText(
    hasHtmlMarkup(explanation)
      ? stripHtmlPreservingBreaks(explanation)
      : explanation,
  );
  const explanationHTML = toParagraphsFromText(explanationPlain);
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

  // Sanitize HTML fields to reduce XSS risk
  const modern = {
    id: q.id,
    exam: q.exam,
    section: q.section,
    stem,
    stemHTML: sanitizeHtml(repairCorruptedKatex(stemHTML))!,
    choices: safeChoices,
    correctIndex,
    explanation,
    explainHTML: sanitizeHtml(explanationHTML)!,
    difficulty: q.difficulty,
    badge: q.badge,
    kind: finalKind,
    quantityA: finalKind === "qc" ? (quantityAHTML ? sanitizeHtml(quantityAHTML)! : finalQuantityA ?? null) : null,
    quantityB: finalKind === "qc" ? (quantityBHTML ? sanitizeHtml(quantityBHTML)! : finalQuantityB ?? null) : null,
  };

  // Attach quality evaluation and adjust difficulty label if our heuristic disagrees strongly
  try {
    const report = checkQuestionQuality({
      id: modern.id,
      exam: modern.exam,
      section: modern.section as any,
      stem: modern.stem,
      stemHTML: modern.stemHTML || modern.stem,
      choices: modern.choices ?? [],
      correctIndex: modern.correctIndex,
      explanation: modern.explanation,
      explainHTML: modern.explainHTML,
      difficulty: modern.difficulty as any,
      kind: modern.kind as any,
      quantityA: modern.quantityA ?? undefined,
      quantityB: modern.quantityB ?? undefined,
    });
    (modern as any).quality = report;
    if (report.adjusted && report.predictedDifficulty) {
      modern.difficulty = report.predictedDifficulty;
    }
  } catch {}

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

    const effectiveDifficulty: Diff = requestedDifficulty ?? pickWeightedDifficulty();

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
          validQuantCategory(
            "GRE",
            typeof candidate.topic === "string" ? candidate.topic : undefined
          )
        )
        .filter((candidate) => {
          const hash = questionHash(candidate.stem, candidate.choices ?? []);
          return !avoidHashes.includes(hash);
        })
        .filter((candidate) => {
          // Drop obviously broken items before reuse (e.g., clipped stems).
          try {
            const qc = checkQuestionQuality({
              id: candidate.id,
              exam: "GRE",
              section: "Quant",
              stem: candidate.stem,
              stemHTML: candidate.stem,
              choices: candidate.choices ?? [],
              correctIndex: Math.max(
                0,
                (candidate.choices ?? []).findIndex((choice) => choice === candidate.answer)
              ),
              explanation: candidate.explanation ?? "",
              explainHTML: candidate.explanation ?? "",
              difficulty: scoreToDifficulty(candidate.difficulty ?? difficultyPreferences[0] ?? 700),
              kind: "mcq",
              quantityA: null,
              quantityB: null,
            });
            return qc.ok;
          } catch {
            return false;
          }
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
        // Rebuild a clean explanation (avoid leaking old MathJax/KaTeX markup)
        const ensured = await ensureLatexExplanation({
          stem: picked.stem,
          choices,
          correctIndex: correctIndex >= 0 ? correctIndex : 0,
          existing: picked.explanation ?? "",
        });
        const { modern } = toClientShape({
          id: picked.id,
          stem: picked.stem,
          choices,
          correctIndex: correctIndex >= 0 ? correctIndex : 0,
          explanation: ensured,
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
        const recentStems = attemptedQs.map((q) => q.stem).filter(Boolean).slice(0, 5);
        const batch = await generateGreQuantBatch({
          topic: wantTopic,
          difficulty: effectiveDifficulty,
          avoidHashes,
          avoidStems: recentStems,
          batchSize: 3,
        });
        generated = batch[0];
        if (
          !isChoiceSetValid(generated.choices, generated.correctIndex) ||
          hasDuplicateChoices(generated.choices)
        ) {
          throw new Error('INVALID_GENERATED_CHOICES');
        }
        if (wantTopic && typeof generated.concept === 'string' && generated.concept !== wantTopic) {
          throw new Error('TOPIC_DRIFT');
        }
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

        let chosen: typeof GRE_QUESTIONS[number] | null = null;
        // Try to find a valid candidate without duplicate choices
        for (let attempt = 0; attempt < Math.min(6, fallbackSource.length); attempt++) {
          const candidate = randomFromArray(fallbackSource);
          if (
            Array.isArray(candidate.choices) &&
            isChoiceSetValid(candidate.choices, candidate.correctIndex) &&
            !hasDuplicateChoices(candidate.choices)
          ) {
            chosen = candidate;
            break;
          }
        }
        chosen = chosen || randomFromArray(fallbackSource);
        const b = chosen as any;
        let safeCorrect = Number.isFinite(Number(b.correctIndex)) ? (Number(b.correctIndex) | 0) : 0;
        if (!Array.isArray(b.choices) || b.choices.length < 2) b.choices = ["Option 1", "Option 2"];
        if (safeCorrect < 0 || safeCorrect >= b.choices.length) safeCorrect = 0;
        generated = {
          concept: b.concept,
          difficulty: b.difficulty,
          kind: (b as any).kind ?? "mcq",
          quantityA: (b as any).quantityA ?? null,
          quantityB: (b as any).quantityB ?? null,
          stem: String(b.stem || ""),
          choices: b.choices,
          correctIndex: safeCorrect,
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
      // Defer explanation math rendering to the client to avoid corrupted HTML blocks
      const enhancedExplanation = enhancedExplanationRaw;
      const generatedDifficulty = (() => {
        const raw = typeof generated.difficulty === "string" ? generated.difficulty.toLowerCase() : "";
        if (raw === "easy" || raw === "medium" || raw === "hard") return raw as Diff;
        return effectiveDifficulty;
      })();

      // Heuristic difficulty gate: if model under-shoots difficulty, retry once with stem diversity
      const desiredRank = (d: Diff) => (d === "easy" ? 1 : d === "medium" ? 2 : 3);
      const predictedReportTry1 = (() => {
        try {
          return checkQuestionQuality({
            id: "temp",
            exam: "GRE",
            section: "Quant",
            stem: enhancedStem,
            stemHTML: enhancedStem,
            choices: generated.choices,
            correctIndex: generated.correctIndex,
            explanation: enhancedExplanation,
            explainHTML: enhancedExplanation,
            difficulty: generatedDifficulty,
            kind: (generated.kind as any) ?? "mcq",
            quantityA: (generated.quantityA as any) ?? undefined,
            quantityB: (generated.quantityB as any) ?? undefined,
          });
        } catch {
          return null as any;
        }
      })();
      if (
        predictedReportTry1 &&
        desiredRank(predictedReportTry1.predictedDifficulty as Diff) < desiredRank(effectiveDifficulty)
      ) {
        try {
          const avoidStems = [generated.stem].concat(attemptedQs.map((q) => q.stem).filter(Boolean).slice(0, 4));
          const retryBatch = await generateGreQuantBatch({
            topic: wantTopic,
            difficulty: effectiveDifficulty,
            avoidHashes,
            avoidStems,
            batchSize: 2,
          });
          const retry = retryBatch[0];
          const retryEnsured = await ensureLatexExplanation({
            stem: retry.stem,
            choices: retry.choices,
            correctIndex: retry.correctIndex,
            existing: retry.explanation,
          });
          const retryStem = renderMathToHtml(enhancePlainContent(retry.stem)) ?? retry.stem;
          const retryExp = renderMathToHtml(enhancePlainContent(retryEnsured)) ?? retryEnsured;
          const retryDiff = (() => {
            const raw = typeof retry.difficulty === "string" ? retry.difficulty.toLowerCase() : "";
            if (raw === "easy" || raw === "medium" || raw === "hard") return raw as Diff;
            return effectiveDifficulty;
          })();
          const rep2 = checkQuestionQuality({
            id: "temp2",
            exam: "GRE",
            section: "Quant",
            stem: retryStem,
            stemHTML: retryStem,
            choices: retry.choices,
            correctIndex: retry.correctIndex,
            explanation: retryExp,
            explainHTML: retryExp,
            difficulty: retryDiff,
            kind: (retry as any).kind ?? "mcq",
            quantityA: (retry as any).quantityA ?? undefined,
            quantityB: (retry as any).quantityB ?? undefined,
          });
          if (desiredRank(rep2.predictedDifficulty as Diff) >= desiredRank(effectiveDifficulty)) {
            // Replace with retry content
            generated = retry;
            (generated as any).__enhancedStem = retryStem;
            (generated as any).__enhancedExplanation = retryExp;
          }
        } catch {}
      }

      // If a retry produced stronger content, use it here
      const enhancedStemFinal = (generated as any).__enhancedStem ?? enhancedStem;
      const enhancedExplanationFinal = (generated as any).__enhancedExplanation ?? enhancedExplanation;
      const safeStem = sanitizeHtml(enhancedStemFinal)!;
      const safeExplanation = sanitizeHtml(enhancedExplanationFinal)!;
      // For Quantitative Comparison items, persist the quantities inline in the
      // stored stem so that future reuses (which only know about `stem` and
      // choices) can recover Quantity A / Quantity B via parsing.
      let stemForStorage = safeStem;
      const isQcConcept =
        typeof generated.concept === "string" &&
        generated.concept.toLowerCase().includes("quantitative comparison");
      const hasExplicitQuantities =
        typeof (generated as any).quantityA === "string" ||
        typeof (generated as any).quantityB === "string";
      if (
        isQcConcept &&
        hasExplicitQuantities &&
        !/Quantity\s*A[:\-]/i.test(safeStem) &&
        !/Quantity\s*B[:\-]/i.test(safeStem)
      ) {
        const qaText =
          typeof (generated as any).quantityA === "string"
            ? (generated as any).quantityA.trim()
            : "";
        const qbText =
          typeof (generated as any).quantityB === "string"
            ? (generated as any).quantityB.trim()
            : "";
        const lines: string[] = [];
        if (qaText) lines.push(`Quantity A: ${qaText}`);
        if (qbText) lines.push(`Quantity B: ${qbText}`);
        if (lines.length) {
          stemForStorage = `${safeStem}\n\n${lines.join("\n")}`;
        }
      }
      const stored = await prisma.question.create({
        data: {
          exam: "GRE",
          section: "Quant",
          topic: generated.concept,
          stem: stemForStorage,
          choices: generated.choices,
          answer: generated.choices[generated.correctIndex] ?? "",
          explanation: safeExplanation,
          difficulty: difficultyToScore(generatedDifficulty),
        },
        select: { id: true },
      });

      const { modern } = toClientShape({
        id: stored.id,
        stem: safeStem,
        choices: generated.choices,
        correctIndex: generated.correctIndex,
        explanation: safeExplanation,
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
      const recentStems = attemptedQs.map((q) => q.stem).filter(Boolean).slice(0, 5);

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
      if (!isChoiceSetValid(chosen.choices, chosen.correctIndex)) {
        // Clamp index if out of bounds as a last resort
        const idx = Math.min(Math.max(Number(chosen.correctIndex) | 0, 0), Math.max(0, chosen.choices.length - 1));
        (chosen as any).correctIndex = idx;
      }
      const ensuredExplanation = await ensureLatexExplanation({
        stem: chosen.stem,
        choices: chosen.choices,
        correctIndex: chosen.correctIndex,
        // Force regeneration so GMAT Quant explanations follow the same
        // standardized step‑by‑step system as GRE math.
        existing: "",
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

      const safeStem2 = sanitizeHtml(enhancedStem)!;
      const safeExplanation2 = sanitizeHtml(enhancedExplanation)!;
      const stored = await prisma.question.create({
        data: {
          exam: "GMAT",
          section: "Quant",
          topic: chosen.concept,
          stem: safeStem2,
          choices: chosen.choices,
          answer: chosen.choices[chosen.correctIndex] ?? "",
          explanation: safeExplanation2,
          difficulty: difficultyToScore(generatedDifficulty),
        },
        select: { id: true },
      });

      const { modern } = toClientShape({
        id: stored.id,
        stem: safeStem2,
        choices: chosen.choices,
        correctIndex: chosen.correctIndex,
        explanation: safeExplanation2,
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
        // Ensure clean explanation for reused items (avoid stale markup)
        const ensured = await ensureLatexExplanation({
          stem: picked.stem,
          choices,
          correctIndex: correctIndex >= 0 ? correctIndex : 0,
          existing: picked.explanation ?? "",
        });
        const { modern } = toClientShape({
          id: picked.id,
          stem: picked.stem,
          choices,
          correctIndex: correctIndex >= 0 ? correctIndex : 0,
          explanation: ensured,
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

        const recentStems = attemptedQs.map((q) => q.stem).filter(Boolean).slice(0, 5);
        const batch = await generateGreTextCompletion({
          difficulty: effectiveDifficulty,
          avoidHashes,
          avoidStems: recentStems,
        });
        const generated: any = batch[0];
        if (
          !isChoiceSetValid(generated.choices, generated.correctIndex) ||
          hasDuplicateChoices(generated.choices)
        ) {
          const idx = Math.min(Math.max(Number(generated.correctIndex) | 0, 0), Math.max(0, generated.choices.length - 1));
          generated.correctIndex = idx;
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
        const enhancedExplanation = enhancedExplanationRaw;
        const generatedDifficulty = (() => {
          const raw = typeof generated.difficulty === "string" ? generated.difficulty.toLowerCase() : "";
          if (raw === "easy" || raw === "medium" || raw === "hard") return raw as Diff;
          return effectiveDifficulty;
        })();

        // Difficulty gate for Verbal (Text Completion)
        let finalStemTC = enhancedStem;
        let finalExplainTC = enhancedExplanation;
        try {
          const rep = checkQuestionQuality({
            id: 'tmp-tc', exam: 'GRE', section: 'Verbal',
            stem: enhancedStem, stemHTML: enhancedStem,
            choices: generated.choices, correctIndex: generated.correctIndex,
            explanation: enhancedExplanation, explainHTML: enhancedExplanation,
            difficulty: generatedDifficulty, kind: 'mcq'
          });
          const rank = (d: Diff) => d === 'easy' ? 1 : d === 'medium' ? 2 : 3;
          if (rank(rep.predictedDifficulty as Diff) < rank(effectiveDifficulty)) {
            const retryBatch = await generateGreTextCompletion({ difficulty: effectiveDifficulty, avoidHashes, avoidStems: recentStems });
            const retry = retryBatch[0];
            const retryEns = await ensureLatexExplanation({ stem: retry.stem, choices: retry.choices, correctIndex: retry.correctIndex, existing: retry.explanation });
            finalStemTC = renderMathToHtml(enhancePlainContent(retry.stem)) ?? retry.stem;
            finalExplainTC = renderMathToHtml(enhancePlainContent(retryEns)) ?? retryEns;
            generated.choices = retry.choices; generated.correctIndex = retry.correctIndex; generated.difficulty = retry.difficulty;
          }
        } catch {}

        const safeStem3 = sanitizeHtml(finalStemTC)!;
        const safeExplanation3 = sanitizeHtml(finalExplainTC)!;
        const stored = await prisma.question.create({
          data: {
            exam: "GRE",
            section: "Verbal",
            topic: "Text Completion",
            stem: safeStem3,
            choices: generated.choices,
            answer: generated.choices[generated.correctIndex] ?? "",
            explanation: safeExplanation3,
            difficulty: difficultyToScore(generatedDifficulty),
          },
          select: { id: true },
        });

        const { modern } = toClientShape({
          id: stored.id,
          stem: safeStem3,
          choices: generated.choices,
          correctIndex: generated.correctIndex,
          explanation: safeExplanation3,
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

        const recentStems2 = attemptedQs.map((q) => q.stem).filter(Boolean).slice(0, 5);
        const batch = await generateGreSentenceEquivalence({
          difficulty: effectiveDifficulty,
          avoidHashes,
          avoidStems: recentStems2,
        });
        const generated: any = batch[0];
        if (
          !isChoiceSetValid(generated.choices, generated.correctIndex) ||
          hasDuplicateChoices(generated.choices)
        ) {
          const idx = Math.min(Math.max(Number(generated.correctIndex) | 0, 0), Math.max(0, generated.choices.length - 1));
          generated.correctIndex = idx;
        }

        const ensuredExplanation = await ensureLatexExplanation({
          stem: generated.stem,
          choices: generated.choices,
          correctIndex: generated.correctIndex,
          existing: generated.explanation,
        });
        let enhancedStemSE = enhancePlainContent(generated.stem);
        let enhancedExplanationSE = enhancePlainContent(ensuredExplanation);
        const generatedDifficulty = (() => {
          const raw = typeof generated.difficulty === "string" ? generated.difficulty.toLowerCase() : "";
          if (raw === "easy" || raw === "medium" || raw === "hard") return raw as Diff;
          return effectiveDifficulty;
        })();

        // Difficulty gate for Verbal (Sentence Equivalence)
        try {
          const rep = checkQuestionQuality({
            id: 'tmp-se', exam: 'GRE', section: 'Verbal',
            stem: enhancedStemSE, stemHTML: enhancedStemSE,
            choices: generated.choices, correctIndex: generated.correctIndex,
            explanation: enhancedExplanationSE, explainHTML: enhancedExplanationSE,
            difficulty: generatedDifficulty, kind: 'mcq'
          });
          const rank = (d: Diff) => d === 'easy' ? 1 : d === 'medium' ? 2 : 3;
          if (rank(rep.predictedDifficulty as Diff) < rank(effectiveDifficulty)) {
            const retryBatch = await generateGreSentenceEquivalence({ difficulty: effectiveDifficulty, avoidHashes, avoidStems: recentStems2 });
            const retry = retryBatch[0];
            const retryEns = await ensureLatexExplanation({ stem: retry.stem, choices: retry.choices, correctIndex: retry.correctIndex, existing: retry.explanation });
            enhancedStemSE = enhancePlainContent(retry.stem);
            enhancedExplanationSE = enhancePlainContent(retryEns);
            generated.choices = retry.choices; generated.correctIndex = retry.correctIndex; generated.difficulty = retry.difficulty;
          }
        } catch {}

        const safeStem4 = sanitizeHtml(enhancedStemSE)!;
        const safeExplanation4 = sanitizeHtml(enhancedExplanationSE)!;
        const stored = await prisma.question.create({
          data: {
            exam: "GRE",
            section: "Verbal",
            topic: "Sentence Equivalence",
            stem: safeStem4,
            choices: generated.choices,
            answer: generated.choices[generated.correctIndex] ?? "",
            explanation: safeExplanation4,
            difficulty: difficultyToScore(generatedDifficulty),
          },
          select: { id: true },
        });

        const { modern } = toClientShape({
          id: stored.id,
          stem: safeStem4,
          choices: generated.choices,
          correctIndex: generated.correctIndex,
          explanation: safeExplanation4,
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

      const recentStems3 = attemptedQs.map((q) => q.stem).filter(Boolean).slice(0, 5);
      const batch = await generateGreRcBatch({
        category,
        difficulty: effectiveDifficulty,
        avoidHashes,
        avoidStems: recentStems3,
        withPassage: true,
      });
      const generated: any = batch[0];
      if (
        !isChoiceSetValid(generated.choices, generated.correctIndex) ||
        hasDuplicateChoices(generated.choices)
      ) {
        const idx = Math.min(Math.max(Number(generated.correctIndex) | 0, 0), Math.max(0, generated.choices.length - 1));
        generated.correctIndex = idx;
      }

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
      let enhancedStemRC = enhancePlainContent(combinedStem);
      let enhancedExplanationRC = enhancePlainContent(ensuredExplanation);
      const generatedDifficulty = (() => {
        const raw = typeof generated.difficulty === "string" ? generated.difficulty.toLowerCase() : "";
        if (raw === "easy" || raw === "medium" || raw === "hard") return raw as Diff;
        return effectiveDifficulty;
      })();

      // Difficulty gate for Verbal (RC)
      try {
        const rep = checkQuestionQuality({
          id: 'tmp-rc', exam: 'GRE', section: 'Verbal',
          stem: enhancedStemRC, stemHTML: enhancedStemRC,
          choices: generated.choices, correctIndex: generated.correctIndex,
          explanation: enhancedExplanationRC, explainHTML: enhancedExplanationRC,
          difficulty: generatedDifficulty, kind: 'mcq'
        });
        const rank = (d: Diff) => d === 'easy' ? 1 : d === 'medium' ? 2 : 3;
        if (rank(rep.predictedDifficulty as Diff) < rank(effectiveDifficulty)) {
          const retryBatch = await generateGreRcBatch({ category, difficulty: effectiveDifficulty, avoidHashes, avoidStems: recentStems3, withPassage: true });
          const retry = retryBatch[0];
          const retryCombinedStem = (typeof retry.passage === 'string' && retry.passage.trim())
            ? `Passage:\n${retry.passage.trim()}\n\nQuestion:\n${retry.stem}`
            : retry.stem;
          const retryEns = await ensureLatexExplanation({ stem: retryCombinedStem, choices: retry.choices, correctIndex: retry.correctIndex, existing: retry.explanation });
          enhancedStemRC = enhancePlainContent(retryCombinedStem);
          enhancedExplanationRC = enhancePlainContent(retryEns);
          generated.choices = retry.choices; generated.correctIndex = retry.correctIndex; generated.difficulty = retry.difficulty; generated.concept = retry.concept;
        }
      } catch {}

      const safeStem5 = sanitizeHtml(enhancedStemRC)!;
      const safeExplanation5 = sanitizeHtml(enhancedExplanationRC)!;
      const stored = await prisma.question.create({
        data: {
          exam: "GRE",
          section: "Verbal",
          topic: category ?? generated.concept,
          stem: safeStem5,
          choices: generated.choices,
          answer: generated.choices[generated.correctIndex] ?? "",
          explanation: safeExplanation5,
          difficulty: difficultyToScore(generatedDifficulty),
        } as any,
        select: { id: true },
      });

      const { modern } = toClientShape({
        id: stored.id,
        stem: safeStem5,
        choices: generated.choices,
        correctIndex: generated.correctIndex,
        explanation: safeExplanation5,
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
      difficulty: effectiveDifficulty,
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
        // Global quality gate: avoid serving obviously broken questions
        try {
          const correctIndex = Math.max(
            0,
            (q.choices ?? []).findIndex((choice) => choice === q.answer)
          );
          const difficultyLabel: Diff =
            q.difficulty === 700 ? "hard" : q.difficulty === 600 ? "medium" : "easy";
          const report = checkQuestionQuality({
            id: q.id,
            exam: q.exam as "GRE" | "GMAT",
            section: q.section as "Quant" | "Verbal",
            stem: q.stem,
            stemHTML: q.stem,
            choices: q.choices ?? [],
            correctIndex: correctIndex,
            explanation: q.explanation ?? "",
            explainHTML: q.explanation ?? "",
            difficulty: difficultyLabel,
            kind: undefined,
            quantityA: null,
            quantityB: null,
          });
          if (!report.ok) return true;
        } catch {
          return true;
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
