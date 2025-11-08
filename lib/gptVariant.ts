// lib/gptVariant.ts
import crypto from "node:crypto";
import OpenAI from "openai";
import { z } from "zod";
import prisma from "@/lib/prisma";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Strict schema (to avoid plain text / junk)
const VariantSchema = z.object({
  stem: z.string().min(6),
  choices: z.array(z.string()).min(2).max(6),
  correctIndex: z.number().int().nonnegative(),
  explanation: z.string().optional().default(""),
});

type VariantOut = z.infer<typeof VariantSchema>;

function variantChecksum(baselineId: string, payload: VariantOut) {
  const h = crypto.createHash("sha256");
  h.update(baselineId + "::" + payload.stem + "::" + payload.choices.join("|") + "::" + payload.correctIndex);
  return h.digest("hex").slice(0, 40);
}

/**
 * Cheap, guarded generator:
 * - Uses gpt-4o-mini
 * - Short prompt; system-bounds to keep tokens low
 * - Validates with Zod; if invalid → no write
 * - Caches by checksum to avoid dupes/cost
 */
export async function ensureVariant(opts: {
  baselineId: string;
  concept: string;
  difficulty: string;
  seedNote?: string; // optional hint like "change numbers 10–20%"
  maxNewPerBaseline?: number; // cap variants per baseline
}) {
  const { baselineId, concept, difficulty, seedNote = "", maxNewPerBaseline = 6 } = opts;

  const existingCount = await prisma.variantQuestion.count({ where: { baselineId } });
  if (existingCount >= maxNewPerBaseline) {
    // Return a random existing variant to save cost
    const v = await prisma.variantQuestion.findFirst({
      where: { baselineId },
      orderBy: { createdAt: "desc" },
    });
    return v || null;
  }

  // Fetch minimal baseline for conditioning (pull from your static bank)
  const { GRE_QUESTIONS } = await import("@/lib/greBank");
  const base = GRE_QUESTIONS.find(q => q.id === baselineId);
  if (!base) return null;

  // Call OpenAI (very compact prompt)
  const sys =
    "You rewrite GRE Quant MCQs into a fresh variant. Keep same concept & difficulty. Change numbers/structure modestly. DO NOT reveal the answer. Return STRICT JSON only. No markdown.";

  const user = JSON.stringify({
    task: "variant",
    concept,
    difficulty,
    seedNote,
    baseline: {
      stem: base.stem,
      choices: base.choices,
      correctIndex: base.correctIndex,
    },
    output: {
      stem: "string",
      choices: "string[] (2..6)",
      correctIndex: "number index",
      explanation: "string",
    },
  });

  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    max_tokens: 320,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
  });

  const raw = resp.choices[0]?.message?.content || "{}";
  let parsed: VariantOut;
  try {
    parsed = VariantSchema.parse(JSON.parse(raw));
  } catch {
    return null; // fail closed to save cost
  }

  const checksum = variantChecksum(baselineId, parsed);

  // Upsert by checksum (cache)
  const saved = await prisma.variantQuestion.upsert({
    where: { checksum },
    create: {
      checksum,
      baselineId,
      concept,
      difficulty,
      stem: parsed.stem,
      choicesJson: JSON.stringify(parsed.choices),
      correctIndex: parsed.correctIndex,
      explanation: parsed.explanation || "",
    },
    update: {}, // exists
  });

  return saved;
}
