import { z } from "zod";

export const OptionZ = z.object({
  id: z.union([z.string(), z.number()]),
  html: z.string().optional(),
  latex: z.string().optional(),
});

export const QuestionPayloadZ = z.object({
  id: z.union([z.string(), z.number()]),
  exam: z.enum(["GRE", "GMAT"]),
  section: z.union([z.literal("Quant"), z.literal("Verbal")]),
  mode: z.union([z.literal("random"), z.literal("topic")]),
  topic: z.string().nullable().optional(),
  difficulty: z.string().optional(),
  stemHTML: z.string().optional(),
  stemLatex: z.string().optional(),
  badge: z.string().optional(),
  kind: z.union([z.literal("mcq"), z.literal("qc"), z.literal("ds")]).optional(),
  quantityA: z.string().nullable().optional(),
  quantityB: z.string().nullable().optional(),
  options: z.array(OptionZ).min(2),
  correct: z.array(z.number()).min(1),
  explainHTML: z.string().optional(),
  meta: z
    .object({
      source: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .passthrough()
    .optional(),
});

export type QuestionPayload = z.infer<typeof QuestionPayloadZ>;

export const NextQuestionRequestZ = z.object({
  exam: z.enum(["GRE", "GMAT"]),
  section: z.union([z.literal("Quant"), z.literal("Verbal")]),
  mode: z.union([z.literal("random"), z.literal("topic")]),
  topic: z.string().optional(),
});
export type NextQuestionRequest = z.infer<typeof NextQuestionRequestZ>;

export function ensureQuestionPayload(u: unknown): QuestionPayload {
  return QuestionPayloadZ.parse(u);
}
