// @ts-nocheck
// scripts/validate-banks.ts
import { QuestionPayloadZ } from "@/lib/types/question";
import { quantBank, verbalBank } from "@/lib/banks";

/** Convert a raw bank item into something close to QuestionPayload for validation. */
function toPayloadish(raw: any) {
  const optionsSrc: any[] = Array.isArray(raw?.options)
    ? raw.options
    : Array.isArray(raw?.choices)
    ? raw.choices
    : Array.isArray(raw?.answers)
    ? raw.answers
    : [];

  const options = optionsSrc.map((op: any, i: number) =>
    typeof op === "object"
      ? { id: op.id ?? i, html: op.html ?? op.text ?? String(op.value ?? i) }
      : { id: i, html: String(op) }
  );

  let correct: number[] =
    Array.isArray(raw?.correct) ? raw.correct
    : typeof raw?.answerIndex === "number" ? [raw.answerIndex]
    : typeof raw?.correctIndex === "number" ? [raw.correctIndex]
    : typeof raw?.answer === "number" ? [raw.answer]
    : [];

  if (correct.length === 0) correct = [0];

  return {
    id: raw?.id ?? raw?._id ?? raw?.uuid ?? "tmp",
    exam: "GRE" as const,
    section: (raw?.section === "Verbal" ? "Verbal" : "Quant") as const,
    mode: "random" as const,
    topic: raw?.topic ?? raw?.category ?? raw?.concept,
    difficulty: raw?.difficulty ?? raw?.level ?? "medium",
    stemHTML: raw?.stemHTML ?? raw?.promptHTML ?? raw?.stem ?? "",
    stemLatex: raw?.stemLatex ?? raw?.promptLatex ?? undefined,
    options,
    correct,
    explainHTML: raw?.explainHTML ?? raw?.explanation ?? undefined,
    meta: raw?.meta ?? {},
  };
}

function check(name: string, bank: any[]) {
  let bad = 0;
  for (const q of bank) {
    try {
      const candidate = toPayloadish(q);
      QuestionPayloadZ.parse(candidate);
    } catch (e: any) {
      bad++;
      console.error(`[${name}] invalid item id=${q?.id ?? "?"}:`, e?.issues ?? e?.message);
    }
  }
  console.log(`[${name}] total=${bank.length}, invalid=${bad}`);
}

check("quantBank", quantBank);
check("verbalBank", verbalBank);
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
