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
  "Difficulty must feel GRE-appropriate; avoid huge numbers or niche curricula.",
  "If category is Quantitative Comparison, use these exact choices in order:",
  '["Quantity A","Quantity B","Equal","Cannot be determined"].',
  "Explanations: 120–220 words, clear English first, then math with KaTeX-friendly LaTeX: inline \\( ... \\), display \\[ ... \\].",
  "Do not include code blocks or markdown headings.",
].join(" ");

export const sysVerbal = [
  "You write GRE Reading Comprehension questions ONLY. No GMAT.",
  "Respect the requested RC category exactly; do not drift.",
  "Use academic yet readable prose. Passage (if any) 120–300 words; short items can be passage-less when appropriate (e.g., vocabulary-in-context on a snippet).",
  "Explanations: 120–220 words, plain and specific (why correct is correct, why traps fail).",
  "No code blocks or markdown headings.",
].join(" ");

export const sysVerbalFill = [
  "You write GRE Text Completion and Sentence Equivalence questions ONLY. No GMAT.",
  "Sentences should feel authentic to GRE verbal. Avoid trivia or pop culture.",
  "Use a single blank marked with ____; context must disambiguate the correct choice.",
  "Provide academic vocabulary that differentiates the options clearly.",
  "Explanations: 120–200 words, plain English first, then reference the blank with KaTeX-friendly notation if math appears.",
  "No code blocks or markdown headings.",
].join(" ");
