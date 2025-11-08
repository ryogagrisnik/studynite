// lib/explainer.ts
import { z } from "zod";
import { gpt } from "./openai";
import { preflightFixMath } from "@/lib/math/preflight";

/** Config for explanation generation */
const ExplainerInput = z.object({
  stem: z.string(),
  choices: z.array(z.string()).min(2),
  correctIndex: z.number().int().nonnegative(),
  userIndex: z.number().int().nonnegative().optional(),
  targetWords: z.number().int().positive().optional(), // NEW
});

const WORD_MIN = Math.max(60, Number(process.env.EXPLANATION_WORD_MIN || '140'));
const WORD_MAX = Math.max(WORD_MIN + 40, Number(process.env.EXPLANATION_WORD_MAX || '300'));

export function getExplanationTargetWords(): number {
  const n = Number(process.env.EXPLANATION_TARGET_WORDS || '230');
  if (!Number.isFinite(n) || n <= 0) return 230;
  return Math.min(Math.max(n, WORD_MIN), WORD_MAX);
}

/** Naive word counter */
function wc(s: string): number {
  return (s || "").trim().split(/\s+/).filter(Boolean).length;
}

/** Promote plain fractions such as 1/6 into KaTeX inline fractions. */
function normalizeSimpleFractions(text: string): string {
  const fractionRegex =
    /(?<!\\\()(?<!\\\[)(?<![\\\w{])(-?\d{1,3})\s*\/\s*(\d{1,3})(?!\s*(?:[A-Za-z0-9\\{]|\/))/g;

  return text.replace(fractionRegex, (_match, rawNumerator, rawDenominator) => {
    const sign = rawNumerator.startsWith("-") ? "-" : "";
    const numerator = sign ? rawNumerator.slice(1) : rawNumerator;
    return `\\(${sign}\\frac{${numerator}}{${rawDenominator}}\\)`;
  });
}

/** Convert user LaTeX to KaTeX-friendly delimiters & sanitize */
export function sanitizeExplanation(raw: string): string {
  let s = (raw || "").trim();

  // Pre-flight: fix obvious math typos and malformed brace pairs
  try {
    const res = preflightFixMath(s);
    s = res.text;
  } catch {}

  // Remove obvious scaffolding
  s = s.replace(/```(?:[\s\S]*?)```/g, "").replace(/^\s*#+\s*/gm, "");

  // Normalize math delimiters:
  // $$...$$ -> \[...\]  and $...$ -> \(...\)
  // Handle multi-line $$ blocks first
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, (_m, inner) => `\\[\n${inner.trim()}\n\\]`);
  // Then inline $...$ (avoid conflicts with \$)
  s = s.replace(/(^|[^\$])\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\w)/g, (_m, pre, inner) => `${pre}\\(${inner.trim()}\\)`);

  // Elevate bare fractions like 1/6 into KaTeX inline fractions.
  s = normalizeSimpleFractions(s);

  // Encourage sentence breaks for readability.
  s = s.replace(
    /\. (Therefore|Thus|Hence|As a result|Consequently|This means|So\b)/g,
    '.\n\n$1'
  );

  // Promote heavy inline math (long with = or +) to display blocks
  s = s.replace(/\\\(([^()]{20,})\\\)/g, (_m, inner) => {
    const heavy = /(=|\+|\\frac|\\sum|\\int|\\sqrt|\\binom|\\times)/.test(inner);
    return heavy ? `\\n\\[${inner.trim()}\\]\\n` : `\\(${inner}\\)`;
  });

  // Common LaTeX fixes
  s = s
    .replace(/\\frac\s*\(\s*([^)]+)\s*\)\s*\(\s*([^)]+)\s*\)/g, "\\frac{$1}{$2}")
    .replace(/\\cdot/g, "\\cdot ")
    .replace(/\\times/g, "\\times ");

  // Ensure lists render nicely
  s = s.replace(/\n-\s+/g, "\n• ");

  // Clean duplicate punctuation like ".." or "!!!"
  s = s.replace(/\.{2,}/g, ".").replace(/!{2,}/g, "!").replace(/\?{2,}/g, "?");

  // Normalize and de-duplicate trailing repeated "Key steps" blocks
  s = s.replace(/\*\*Key steps:\*\*/gi, 'Key steps:');
  s = s.replace(/(Key steps:[\s\S]*?)(?:\s*Key steps:[\s\S]*?)+$/i, '$1');

  // Clamp length softly: if too long, trim at sentence boundary
  const words = wc(s);
  if (words > WORD_MAX + 60) {
    const sentences = s.split(/(?<=[.!?])\s+/);
    let acc = "";
    for (const sent of sentences) {
      if (wc(acc) + wc(sent) > WORD_MAX) break;
      acc += (acc ? " " : "") + sent;
    }
    s = acc;
  }

  // If too short, add “Key Steps” hint (non-LM fallback)
  if (wc(s) < WORD_MIN) {
    s += (s.endsWith(".") ? "" : ".") + "\n\nKey steps: Identify what’s being asked, set up equations using given relationships, simplify carefully, and check edge cases.";
  }

  return s;
}

/** Ask the model for a clear, GRE-appropriate explanation */
export async function generateExplanation(input: z.infer<typeof ExplainerInput>): Promise<string> {
  const parsed = ExplainerInput.parse(input);
  const targetWords = parsed.targetWords ?? getExplanationTargetWords();

  const sys = [
    "You explain solutions in a friendly, learner-first style.",
    "Write ~" + targetWords + " words (stay ~120–220).",
    "Lead with plain English; use math only where it clarifies.",
    "Avoid formal number-theory notation like '≡' or 'mod'. Prefer: 'leaves remainder r when divided by n'.",
    "Prefer KaTeX-friendly LaTeX when needed: inline \\( ... \\), display \\[ ... \\].",
    "No code blocks, no markdown headers.",
    "For Quantitative Comparison, point out when different valid cases lead to different outcomes (so the answer is 'Cannot be determined').",
  ].join(" ");

  const user = [
    "STEM:", parsed.stem,
    "CHOICES:", parsed.choices.map((c, i) => `${String.fromCharCode(65 + i)}. ${c}`).join("  "),
    "CORRECT_INDEX:", String(parsed.correctIndex),
    parsed.userIndex !== undefined ? `USER_INDEX: ${parsed.userIndex}` : ""
  ].join("\n");

  const reply = await gpt({
    system: sys,
    user,
    json: false,
    temperature: 0.2,
    model: process.env.EXPLAINER_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
  });

  return reply;
}
