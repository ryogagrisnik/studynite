import { z } from "zod";
import { llm, compactJSON } from "./llm";
import crypto from "crypto";

export const RawQuestionZ = z.object({
  section: z.union([z.literal("Quant"), z.literal("Verbal")]),
  topic: z.string().optional(),
  difficulty: z.enum(["easy","medium","hard"]).optional(),
  stemHTML: z.string().optional(),
  stemLatex: z.string().optional(),
  options: z.array(z.object({ id: z.union([z.string(), z.number()]).optional(), html: z.string().optional(), latex: z.string().optional() })).min(2),
  correct: z.array(z.number()).min(1),
  explainHTML: z.string().optional(),
  meta: z.record(z.any()).optional(),
});
export type RawQuestion = z.infer<typeof RawQuestionZ>;

function sys(section:"Quant"|"Verbal"){
  return `You are a GRE ${section} item writer. Return ONLY strict JSON matching the schema. No prose. "correct" is an array of 0-based indices.`;
}

function examplesBlock(ex: any[]){
  if (!ex?.length) return "";
  return ["Examples (style only):", ...ex.slice(0,3).map((e,i)=>`EX_${i+1}: ${compactJSON(e)}`)].join("\n");
}

export async function generateQuestionStrictJSON({
  section, topic, difficulty="medium", exemplars=[]
}: {section:"Quant"|"Verbal"; topic?:string; difficulty?:"easy"|"medium"|"hard"; exemplars?:any[]}): Promise<RawQuestion> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing: GPT-based question generation is disabled.");
  }

  const fingerprint = crypto.randomBytes(6).toString("hex");
  const explanationGuidance =
    section === "Quant"
      ? "In the field explainHTML, include a fully worked, step-by-step explanation. Use 3–6 short labeled steps (Step 1, Step 2, etc.). Start by restating the givens and defining any variables, then write the key formula or relationship, substitute the given numbers, simplify step by step, and finally state the numerical answer and which option is correct."
      : "Include a fully worked explanation that justifies the correct answer.";

  const user = [
    `Create ONE GRE ${section} question.`,
    topic ? `Topic: ${topic}` : undefined,
    `Difficulty: ${difficulty}`,
    `This item must be novel and should not reuse wording or numbers from other items.`,
    explanationGuidance,
    `Fingerprint ${fingerprint} (use internally only to ensure uniqueness).`,
    `Output JSON with keys: {section, topic, difficulty, stemHTML, options:[{id,html}], correct:[number], explainHTML, meta}`,
    examplesBlock(exemplars),
  ].filter(Boolean).join("\n");

  const r1 = await llm.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [{ role:"system", content: sys(section) }, { role:"user", content: user }],
  });

  const text1 = r1.choices?.[0]?.message?.content ?? "{}";
  let parsed:any; try { parsed = JSON.parse(text1) } catch { parsed = {} }
  const candidate = parsed?.result ?? parsed;
  const ok1 = RawQuestionZ.safeParse(candidate);
  if (ok1.success) return { ...candidate, section, topic: candidate.topic ?? topic, difficulty: candidate.difficulty ?? difficulty };

  const r2 = await llm.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role:"system", content: sys(section) },
      { role:"user", content: user },
      { role:"assistant", content: text1.slice(0,1000) },
      { role:"user", content: `The JSON above does NOT match the schema. Fix it. Errors: ${JSON.stringify(ok1.error.issues).slice(0,700)}` },
    ],
  });

  const text2 = r2.choices?.[0]?.message?.content ?? "{}";
  try { parsed = JSON.parse(text2) } catch { parsed = {} }
  const candidate2 = parsed?.result ?? parsed;
  const ok2 = RawQuestionZ.safeParse(candidate2);
  if (ok2.success) return { ...candidate2, section, topic: candidate2.topic ?? topic, difficulty: candidate2.difficulty ?? difficulty };

  // last resort (your defensive normalizer will accept this and never 400)
  return {
    section, topic: topic ?? "Unknown", difficulty,
    stemHTML: "Fallback: could not generate a valid question right now.",
    options: [{ id: 0, html: "OK" }, { id: 1, html: "Next" }],
    correct: [0],
    explainHTML: "Please try again.",
    meta: { llmError: ok2.error.issues },
  };
}
