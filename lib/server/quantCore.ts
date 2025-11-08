// lib/server/quantCore.ts
import { NextQuestionRequest } from "@/lib/types/question";
import { getQuantBank, fewshotQuant, pickOne } from "@/lib/banks";
import { generateQuestionStrictJSON } from "./generate";
import { normalizeQuantTopic, topicMatches } from "./quantTopic";
import { markSeen } from "./dedupe";

export async function getNextQuantCore(input: NextQuestionRequest): Promise<any> {
  const wantedTopic = normalizeQuantTopic(input.topic);
  const bank = getQuantBank(input.exam);

  // Filter bank by topic (for "topic" mode)
  let filtered: any[] = bank;
  if (input.mode === "topic" && wantedTopic) {
    filtered = bank.filter((q) =>
      topicMatches(q?.topic ?? q?.category ?? q?.concept, wantedTopic)
    );
  }

  // ---- Path A: try LLM generation
  try {
    const exemplars =
      input.mode === "topic" && wantedTopic
        ? fewshotQuant(input.exam, wantedTopic)
        : fewshotQuant(input.exam, undefined);

    const raw = await generateQuestionStrictJSON({
      section: "Quant",
      topic: wantedTopic,
      difficulty: "medium",
      exemplars,
    });

    const enriched = { ...raw, section: "Quant", topic: raw.topic ?? wantedTopic };

    // 🔁 Check for duplicate stem
    if (markSeen(enriched.stemHTML)) {
      // regenerate once to avoid repetition
      const raw2 = await generateQuestionStrictJSON({
        section: "Quant",
        topic: wantedTopic,
        difficulty: "medium",
        exemplars,
      });
      return { ...raw2, section: "Quant", topic: raw2.topic ?? wantedTopic };
    }

    return enriched;
  } catch (e: any) {
    const message = e?.message ?? "";
    console.error("[quantCore] LLM generation failed:", e);
    if (!process.env.OPENAI_API_KEY || message.includes("OPENAI_API_KEY")) {
      throw new Error("Unable to generate Quant question: OpenAI API key not configured.");
    }
    if (e?.status === 401 || e?.status === 403) {
      throw new Error("Unable to generate Quant question: OpenAI rejected the request.");
    }
    // fall through to bank fallback for other transient issues
  }

  // ---- Path B: fallback to local bank
  const pool = filtered.length ? filtered : bank;
  const chosen = pickOne(pool);

  if (chosen) {
    const enriched = {
      ...chosen,
      section: "Quant",
      topic: chosen.topic ?? wantedTopic ?? chosen.category ?? chosen.concept,
    };

    // 🔁 De-dupe for bank items
    if (markSeen(enriched.stemHTML ?? enriched.stem ?? enriched.promptHTML)) {
      const alt = pool.find((q) => q !== chosen);
      if (alt) {
        return {
          ...alt,
          section: "Quant",
          topic: alt.topic ?? wantedTopic ?? alt.category ?? alt.concept,
        };
      }
    }

    return enriched;
  }

  // ---- Fallback if no question at all
  return {
    id: `quant-fallback-${Date.now()}`,
    section: "Quant",
    topic: wantedTopic ?? "Unknown",
    difficulty: "medium",
    stemHTML: `No questions found for topic: ${wantedTopic ?? "(any)"}`,
    options: [
      { id: 0, html: "OK" },
      { id: 1, html: "Next" },
    ],
    correct: [0],
    explainHTML: "Populate your Quant bank or enable LLM generation.",
  };
}
