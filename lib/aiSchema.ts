// lib/aiSchema.ts
import { z } from "zod";
import { GRE_QUANT_CATEGORIES, GMAT_QUANT_CATEGORIES } from "./validator/quant";
import { GRE_RC_CATEGORIES, GRE_VERBAL_PRIMARY_TYPES } from "./validator/verbal";

export const BaseQuestion = z.object({
  exam: z.enum(["GRE", "GMAT"]),
  section: z.enum(["Quant", "Verbal"]),
  concept: z.string(), // must match our category gates upstream
  stem: z.string(),
  choices: z.array(z.string()).min(2),
  correctIndex: z.number().int().nonnegative(),
  explanation: z.string().optional(),
  difficulty: z.string().optional(),
  // optional RC content
  passage: z.string().optional(),
  // QC optional helpers
  kind: z.string().optional(),
  quantityA: z.union([z.string(), z.number()]).nullable().optional(),
  quantityB: z.union([z.string(), z.number()]).nullable().optional(),
});

export type BaseQuestionT = z.infer<typeof BaseQuestion>;

export const GRE_QUANT_ALLOWED = new Set<string>(GRE_QUANT_CATEGORIES as unknown as string[]);
export const GMAT_QUANT_ALLOWED = new Set<string>(GMAT_QUANT_CATEGORIES as unknown as string[]);
export const GRE_RC_ALLOWED = new Set<string>(GRE_RC_CATEGORIES as unknown as string[]);
export const GRE_VERBAL_ALLOWED = new Set<string>([
  ...GRE_RC_CATEGORIES,
  ...GRE_VERBAL_PRIMARY_TYPES,
] as unknown as string[]);

/** System prompts used by generator */
export const sysQuant = [
  "You write GRE Quant questions ONLY. No GMAT.",
  "Respect the requested category exactly; do not drift.",
  "Style: authentic GRE. Formal, concise, no gimmicks. Prefer 2–3 digit integers or simple fractions/surds. Avoid trivial 0/1/2 unless necessary.",
  "Challenge: require multi-step reasoning (2–4+ steps). Include one plausible distractor that reflects a specific misconception.",
  "Avoid trivial plug-ins: do NOT ask for the slope or y-intercept directly from two given points; do NOT ask for the distance between two points unless it’s part of a longer chain.",
  "Diversity: vary stem phrasing and structure; do not overuse patterns like 'If ... which of the following'. Vary context (pure algebra vs brief word setting).",
  "If category is Quantitative Comparison, use these exact choices in order:",
  '["Quantity A","Quantity B","Equal","Cannot be determined"].',
  "Use KaTeX-friendly LaTeX for math (inline \\( ... \\), display \\[ ... \\]). No code blocks or markdown headings.",
].join(" ");

export const sysVerbal = [
  "You write GRE Reading Comprehension questions ONLY. No GMAT.",
  "Respect the requested RC category exactly; do not drift.",
  "Style: GRE-like academic prose; avoid pop culture. 120–300 word passages when used. Focus on inference and author's intent over surface paraphrase.",
  "Diversity: vary stems and avoid formulaic 'Which of the following' phrasing repeatedly. Wrong options must fail for distinct reasons (scope, tone, detail, logic).",
  "No code blocks or markdown headings.",
].join(" ");

export const sysVerbalFill = [
  "You write GRE Text Completion and Sentence Equivalence questions ONLY. No GMAT.",
  "Authentic GRE tone; avoid trivia/pop culture.",
  "Single blank marked ____; context must uniquely determine the best choice.",
  "Diversity: vary sentence structure and rhetorical cues; avoid repeating the same template.",
  "Provide academic vocabulary; wrong options should be wrong for distinct, explainable reasons.",
  "No code blocks or markdown headings.",
].join(" ");
