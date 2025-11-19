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

// Keep explanations concise by default; allow env to override.
const WORD_MIN = Math.max(50, Number(process.env.EXPLANATION_WORD_MIN || '80'));
const WORD_MAX = Math.max(WORD_MIN + 40, Number(process.env.EXPLANATION_WORD_MAX || '180'));
// Default to passthrough mode so explanations are treated as plain text and
// not rewritten into LaTeX-heavy markup unless explicitly disabled.
const PASSTHROUGH = (process.env.EXPLANATION_PASSTHROUGH || 'true').toLowerCase() === 'true';

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
  if (PASSTHROUGH) {
    return (raw || '').toString();
  }
  let s = (raw || "").trim();

  // Pre-flight: fix obvious math typos and malformed brace pairs
  try {
    const res = preflightFixMath(s);
    s = res.text;
  } catch {}

  // Clarity fixes for common noisy phrases/typos
  s = s.replace(/\bisgivenby\b/gi, 'is given by');
  s = s.replace(/\bm\s*:\s*n\b/gi, 'm:n');
  // Coordinate notation cleanup: turn x1,y1) -> (x_1, y_1)
  s = s.replace(/\b(x)\s*([0-9])\s*,\s*(y)\s*([0-9])\s*\)/gi, (_m, xa, ia, yb, ib) => `(\\(${xa}_{${ia}}\\), \\(${yb}_{${ib}}\\))`);
  // Subscript shorthand like x1, y2, a3 -> math inline x_{1}, y_{2}
  s = s.replace(/\b([xyabnkmprst])([0-9])\b/gi, (_m, v, d) => `\\(${v}_{${d}}\\)`);

  // Remove obvious scaffolding
  s = s.replace(/```(?:[\s\S]*?)```/g, "").replace(/^\s*#+\s*/gm, "");

  // Strip stray closing math delimiters left without matching open
  s = s.replace(/(?<!\\\[)\\\]/g, "").replace(/(?<!\\\()\\\)/g, "");

  // Replace stray LaTeX control words appearing in prose with human words
  // e.g., "\sum:" -> "sum:" when not already inside math
  s = s.replace(/(?<!\\\(|\\\[)\\sum\s*:?/gi, "sum:");
  s = s.replace(/(?<!\\\(|\\\[)\\prod\s*:?/gi, "product:");
  s = s.replace(/(?<!\\\(|\\\[)\\times/gi, "×");

  // Normalize equals spacing for readability
  s = s.replace(/\s*=\s*/g, " = ").replace(/={2,}/g, " = ");
  // Repair common combinatorics shorthand and incomplete tokens
  // Bare "\\binom 8 2" -> "\\binom{8}{2}"
  s = s.replace(/\\binom\s+([0-9A-Za-z]+)\s+([0-9A-Za-z]+)/g, (_m, n, k) => `\\binom{${n}}{${k}}`);
  // "choose 2 from 8" -> add inline binomial helper
  s = s.replace(/\bchoose\s+(\d+)\s+(?:from|of)\s+(\d+)\b/gi, (_m, k, n) => `choose ${k} from ${n} (\\(\\binom{${n}}{${k}}\\))`);
  // Collapse accidentally repeated equals signs like "= = ="
  s = s.replace(/\s*=\s*=\s*=\s*/g, ' = ');
  // Restore LaTeX control words if prior cleanup turned them into prose
  s = s.replace(/\bsum\s*:/gi, ' \\sum ');
  s = s.replace(/\bproduct\s*:/gi, ' \\prod ');
  s = s.replace(/×/g, ' \\times ');

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

  // Heuristics to fix common STEM typos in math expressions
  // V_{ cylinder} -> V_{\text{cylinder}}
  s = s.replace(/V_\{\s*([A-Za-z][A-Za-z\s]*)\s*\}/g, (_m, label) => `V_{\\text{${String(label).trim()}}}`);
  // r2 -> r^2 (and similar r3, r4)
  s = s.replace(/\br\s*([2-9])\b/g, (_m, d) => `r^{${d}}`);
  // cm3 or cm^3 -> \text{ cm}^{3}
  s = s.replace(/cm\s*\^?\s*3\b/gi, `\\text{ cm}^{3}`);
  // Ensure \pi is spaced correctly
  s = s.replace(/\bpi\b/gi, '\\pi');
  // Fix \frac {1}{3} variants with extra spaces
  s = s.replace(/\\frac\s*\{\s*1\s*\}\s*\{\s*3\s*\}/g, '\\frac{1}{3}');

  // Close missing inline math before punctuation, e.g., "\\( 45\\pi ," -> "\\(45\\pi\\),"
  s = s.replace(/\\\(\s*([^\)]*?)(?=\s*[,.;:!?](?:\s|$))/g, (_m, inner) => `\\(${String(inner).trim()}\\)`);
  // Close missing inline math at end of line
  s = s.replace(/\\\(([^\)]*?)$/gm, (_m, inner) => `\\(${String(inner).trim()}\\)`);

  // Common LaTeX fixes
  s = s
    .replace(/\\frac\s*\(\s*([^)]+)\s*\)\s*\(\s*([^)]+)\s*\)/g, "\\frac{$1}{$2}")
    .replace(/\\cdot/g, "\\cdot ")
    .replace(/\\times/g, "\\times ");

  // Ensure lists render nicely
  s = s.replace(/\n-\s+/g, "\n• ");

  // Clean duplicate punctuation like ".." or "!!!"
  s = s.replace(/\.{2,}/g, ".").replace(/!{2,}/g, "!").replace(/\?{2,}/g, "?");

  // Reduce duplicated conclusion lines (keep first)
  s = s.replace(/(?:In conclusion[:,]?|Therefore[:,]?|Thus[:,]?)[\s\S]*?(?=(?:\n\n|$))/gi, (match) => match.split(/\n+/)[0]);

  // Normalize and de-duplicate trailing repeated "Key steps" blocks
  // Normalize variants like "Keysteps:" or missing space/case
  s = s.replace(/\*\*Key\s*steps:\*\*/gi, 'Key steps:');
  s = s.replace(/\bKey\s*steps\s*:/gi, 'Key steps:');
  s = s.replace(/\bKeysteps\s*:/gi, 'Key steps:');
  // De-duplicate repeated sections
  s = s.replace(/(Key steps:[\s\S]*?)(?:\s*Key\s*steps:[\s\S]*?)+$/i, '$1');

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

  // Avoid appending generic boilerplate. If the model replied too briefly, prefer brevity
  // over injecting duplicated or confusing "Key steps" text.

  return s;
}

/** Ask the model for a clear, GRE-appropriate explanation */
export async function generateExplanation(input: z.infer<typeof ExplainerInput>): Promise<string> {
  const parsed = ExplainerInput.parse(input);
  const targetWords = parsed.targetWords ?? getExplanationTargetWords();

  // Single, simple style: short plain‑English explanation with inline text math.
  const sys = [
    "You are a patient GRE/GMAT tutor.",
    "Explain the solution in a short, step-by-step format that a 7th–8th grade student could follow.",
    "Use 3–6 labeled steps such as 'Step 1:', 'Step 2:', etc., each on its own line.",
    "For math / Quant problems, follow this structure when possible: (1) restate the key givens and define any variables; (2) write down the relevant formula or relationship; (3) substitute the given numbers; (4) simplify step by step to solve; (5) interpret the result and map it to the correct answer choice.",
    "For Verbal / Reading questions, still use a few clear steps that explain why the correct choice works and why the main wrong options fail.",
    `Aim for around ${targetWords} words, but be concise and avoid filler.`,
    "Write math using ordinary text like 'M = 18' or 'total = 18 + 15 − 10 = 23'.",
    "Do NOT use LaTeX commands, backslashes, or $ signs (no \\frac, \\sqrt, \\(, \\), $$, etc.).",
    "Do NOT use markdown code fences or headings. Plain text only.",
    "You may use short labels like 'Step 1:' and 'Answer:' but no other section titles.",
    "Always clearly state the final answer in the last step, e.g. 'Answer: 23 students.' or 'Answer: Quantity A is greater (choice C).'",
    "For multiple‑choice or Quantitative Comparison, explicitly mention the correct option (A, B, C, D, or which quantity is larger) in the explanation.",
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
