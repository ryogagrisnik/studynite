// lib/server/verbalCore.ts
import { NextQuestionRequest } from "@/lib/types/question";
import { fewshotVerbal, pickOne, verbalBank } from "@/lib/banks";
import { generateQuestionStrictJSON } from "./generate";
import { markSeen } from "./dedupe";

function concept(input: NextQuestionRequest): "TC" | "SE" | "RC" | undefined {
  const t = String(input.topic ?? "").toUpperCase();
  return t === "TC" || t === "SE" || t === "RC" ? t : undefined;
}

export async function getNextVerbalCore(input: NextQuestionRequest): Promise<any> {
  const c = concept(input);
  const difficulty: "easy" | "medium" | "hard" = "medium";

  // ---- Path A: LLM generation
  try {
    const exemplars =
      input.mode === "topic" && c ? fewshotVerbal(c) : fewshotVerbal(undefined);

    const raw = await generateQuestionStrictJSON({
      section: "Verbal",
      topic: c,
      difficulty,
      exemplars,
    });

    const enriched = { ...raw, section: "Verbal", topic: raw.topic ?? c };

    // 🔁 De-dupe
    if (markSeen(enriched.stemHTML)) {
      const raw2 = await generateQuestionStrictJSON({
        section: "Verbal",
        topic: c,
        difficulty,
        exemplars,
      });
      return { ...raw2, section: "Verbal", topic: raw2.topic ?? c };
    }

    return enriched;
  } catch (e: any) {
    const message = e?.message ?? "";
    console.error("[verbalCore] LLM generation failed:", e);
    if (!process.env.OPENAI_API_KEY || message.includes("OPENAI_API_KEY")) {
      throw new Error("Unable to generate Verbal question: OpenAI API key not configured.");
    }
    if (e?.status === 401 || e?.status === 403) {
      throw new Error("Unable to generate Verbal question: OpenAI rejected the request.");
    }
    // fall through to bank fallback for other transient issues
  }

  // ---- Path B: fallback to local bank
  const pool = c
    ? verbalBank.filter(
        (q: any) =>
          String(q.type ?? q.topic ?? "").toUpperCase() === c
      )
    : verbalBank;

  const chosen = pickOne(pool);
  if (chosen) {
    const enriched = {
      ...chosen,
      section: "Verbal",
      topic: chosen.topic ?? c,
    };

    // 🔁 De-dupe for bank items
    if (markSeen(enriched.stemHTML ?? enriched.stem ?? enriched.promptHTML)) {
      const alt = pool.find((q) => q !== chosen);
      if (alt) {
        return { ...alt, section: "Verbal", topic: alt.topic ?? c };
      }
    }

    return enriched;
  }

  // ---- Fallback
  return {
    section: "Verbal",
    topic: c ?? "random",
    difficulty,
    stemHTML: "Fallback Verbal item.",
    options: [
      { id: 0, html: "OK" },
      { id: 1, html: "Next" },
    ],
    correct: [0],
    explainHTML: "No verbal bank item available.",
  };
}
