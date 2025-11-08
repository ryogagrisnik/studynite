// lib/server/questions.ts
import { NextQuestionRequest, QuestionPayload } from "../types/question";
import { getNextQuantCore } from "./quantCore";
import { getNextVerbalCore } from "./verbalCore";
import { normalizeQuestionPayload } from "@/lib/normalizeQuestionPayload";

export async function getNextQuestionServer(
  input: NextQuestionRequest
): Promise<QuestionPayload> {
  const raw =
    input.section === "Quant"
      ? await getNextQuantCore(input)
      : await getNextVerbalCore(input);

  // tag input mode/topic onto raw so the payload reflects the request
  const enriched = { ...raw, section: input.section, mode: input.mode, topic: input.topic };
  return normalizeQuestionPayload(enriched);
}
