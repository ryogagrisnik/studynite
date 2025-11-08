// lib/generator.ts
import { randomInt } from "crypto";
import { z } from "zod";
import { gpt } from "./openai";
import {
  BaseQuestion,
  BaseQuestionT,
  sysQuant,
  sysVerbal,
  sysVerbalFill,
  GRE_QUANT_ALLOWED,
  GRE_RC_ALLOWED,
  GRE_VERBAL_ALLOWED,
} from "./aiSchema";
import { validateGreQuant } from "./validator/quant";
import { validateGreRcItem } from "./validator/verbal";
import { sanitizeExplanation, generateExplanation, getExplanationTargetWords } from "./explainer";

type Diff = "easy" | "medium" | "hard";

const Out = BaseQuestion;

function randomIndex(size: number): number {
  if (size <= 1) return 0;
  try {
    return randomInt(size);
  } catch {
    return Math.floor(Math.random() * size);
  }
}

function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) {
    const i = randomIndex(copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

function pickOne<T>(collection: Iterable<T>): T {
  const arr = Array.isArray(collection) ? collection : Array.from(collection);
  return arr[randomIndex(arr.length)]!;
}

function toDifficultyScale(d: Diff): number {
  return d === "easy" ? 500 : d === "medium" ? 600 : 700;
}

function ensureCategory(section: "Quant" | "Verbal", concept: string): boolean {
  if (section === "Quant") return GRE_QUANT_ALLOWED.has(concept);
  return GRE_VERBAL_ALLOWED.has(concept);
}

function baseUserPrompt(p: {
  section: "Quant" | "Verbal";
  concept?: string;
  topic?: string;
  difficulty: Diff;
  avoidHashes?: string[];
}) {
  const lines = [
    `EXAM: GRE`,
    `SECTION: ${p.section}`,
    `CATEGORY: ${p.concept ?? p.topic ?? ""}`,
    `DIFFICULTY: ${p.difficulty}`,
    `FORMAT: JSON ONLY. No backticks.`,
    `FIELDS: exam, section, concept, stem, choices, correctIndex, explanation (optional), passage (optional for RC), kind (optional), quantityA, quantityB.`,
  ];
  if (p.section === "Quant") {
    if (p.difficulty === "hard") {
      lines.push("Design a GRE Quant HARD question that requires multi-step reasoning, often combining algebra/number properties/word interpretation. Avoid one-line plug-and-chug.");
      lines.push("Use realistic numbers (2–3 digits or simple fractions) and craft trap choices that reflect common GRE misreads.");
    } else if (p.difficulty === "medium") {
      lines.push("Ensure at least two reasoning steps and include one tempting distractor that rewards partial reasoning errors.");
    }
  } else {
    if (p.difficulty === "hard") {
      lines.push("For a HARD RC item, rely on nuanced inference or author-attitude shifts; answer choices should be subtly distinct and require line-referencing.");
    } else if (p.difficulty === "medium") {
      lines.push("Medium RC questions should still require close reading—avoid answers that can be confirmed by single-sentence paraphrase.");
    }
  }
  if (p?.avoidHashes?.length) lines.push(`AVOID_SIMILAR_TO: ${pickN(p.avoidHashes, Math.min(5, p.avoidHashes.length)).join(" | ")}`);
  return lines.join("\n");
}

async function askLLM(opts: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<BaseQuestionT> {
  const raw = await gpt({
    system: opts.system,
    user: opts.user,
    json: true,
    temperature: opts.temperature ?? 0.2,
  });
  const parsed = Out.parse(raw);
  return parsed;
}

/** QUANT: single or batch */
export async function generateGreQuantBatch(args: {
  topic?: string;                  // concept
  difficulty: Diff;
  avoidHashes?: string[];
  batchSize?: number;
}): Promise<BaseQuestionT[]> {
  const concept = args.topic ?? pickOne(GRE_QUANT_ALLOWED);
  const sys = sysQuant;
  const user = [
    baseUserPrompt({ section: "Quant", concept, difficulty: args.difficulty, avoidHashes: args.avoidHashes }),
    `CATEGORY: ${concept}`,
    "Return a single GRE Quant question with 4–5 choices. If QC, use the canonical four choices.",
  ].join("\n");

  const q = await askLLM({ system: sys, user, temperature: 0.2 });

  // Validate category & shape
  if (!ensureCategory("Quant", q.concept)) {
    throw new Error("Model drifted category (Quant).");
  }
  const ok = validateGreQuant({ concept: q.concept, stem: q.stem, choices: q.choices, correctIndex: q.correctIndex });
  if (!ok.ok) throw new Error("Invalid GRE Quant question: " + ok.reason);

  // Ensure explanation present, clean and sized
  let explanation = (q.explanation || "").trim();
  if (explanation.length < 60) {
    explanation = await generateExplanation({
      stem: q.stem,
      choices: q.choices,
      correctIndex: q.correctIndex,
      targetWords: getExplanationTargetWords(),
    });
  }
  q.explanation = sanitizeExplanation(explanation);

  // Normalize QC choices if needed
  if (/^quantitative comparison$/i.test(q.concept) && (!q.kind || q.choices.length !== 4)) {
    q.kind = "qc";
    q.choices = ["Quantity A", "Quantity B", "Equal", "Cannot be determined"];
  }

  q.exam = "GRE";
  q.section = "Quant";
  return [q];
}

/** VERBAL (RC): single or batch */
export async function generateGreRcBatch(args: {
  category?: string;              // RC category
  difficulty: Diff;
  avoidHashes?: string[];
  withPassage?: boolean;          // allow short passage
}): Promise<BaseQuestionT[]> {
  const concept = args.category ?? pickOne(GRE_RC_ALLOWED);
  const sys = sysVerbal;
  const user = [
    baseUserPrompt({ section: "Verbal", concept, difficulty: args.difficulty, avoidHashes: args.avoidHashes }),
    `CATEGORY: ${concept}`,
    args.withPassage ? "INCLUDE_PASSAGE: 120–300 words" : "PASSAGE: optional (short snippet allowed)",
    "Return ONE GRE RC multiple-choice question (4–5 options).",
  ].join("\n");

  const q = await askLLM({ system: sys, user, temperature: 0.3 });

  // Validate category & shape
  if (!ensureCategory("Verbal", q.concept)) {
    throw new Error("Model drifted category (Verbal).");
  }
  const ok = validateGreRcItem({ passage: q.passage, concept: q.concept, stem: q.stem, choices: q.choices, correctIndex: q.correctIndex });
  if (!ok.ok) throw new Error("Invalid GRE RC item: " + ok.reason);

  // Explanation
  let explanation = (q.explanation || "").trim();
  if (explanation.length < 60) {
    explanation = await generateExplanation({
      stem: q.stem,
      choices: q.choices,
      correctIndex: q.correctIndex,
      targetWords: getExplanationTargetWords(),
    });
  }
  q.explanation = sanitizeExplanation(explanation);

  q.exam = "GRE";
  q.section = "Verbal";
  return [q];
}

export async function generateGreTextCompletion(args: {
  difficulty: Diff;
  avoidHashes?: string[];
}): Promise<BaseQuestionT[]> {
  const sys = sysVerbalFill;
  const lines = [
    "QUESTION_TYPE: Text Completion",
    `DIFFICULTY: ${args.difficulty}`,
    "Provide one or two sentences with a single blank represented as '____'.",
    "Return JSON with fields exam, section, concept, stem, choices (exactly five strings), correctIndex (0-based), explanation.",
    "All answer choices must be distinct vocabulary words or short phrases.",
    "Exactly one choice should best complete the sentence based on context.",
  ];
  if (args.avoidHashes?.length) {
    lines.push(`AVOID_SIMILAR_TO: ${pickN(args.avoidHashes, Math.min(5, args.avoidHashes.length)).join(" | ")}`);
  }
  const user = lines.join("\n");

  const q = await askLLM({ system: sys, user, temperature: 0.25 });

  q.exam = "GRE";
  q.section = "Verbal";
  q.concept = "Text Completion";

  if (!ensureCategory("Verbal", q.concept)) {
    throw new Error("Model drifted category (Text Completion).");
  }

  let explanation = (q.explanation || "").trim();
  if (explanation.length < 80) {
    explanation = await generateExplanation({
      stem: q.stem,
      choices: q.choices,
      correctIndex: q.correctIndex,
      targetWords: getExplanationTargetWords(),
    });
  }
  q.explanation = sanitizeExplanation(explanation);

  return [q];
}

export async function generateGreSentenceEquivalence(args: {
  difficulty: Diff;
  avoidHashes?: string[];
}): Promise<BaseQuestionT[]> {
  const sys = sysVerbalFill;
  const lines = [
    "QUESTION_TYPE: Sentence Equivalence",
    `DIFFICULTY: ${args.difficulty}`,
    "Create one sentence with a single blank represented as '____'.",
    "Provide six answer choices consisting of single words or short phrases; ensure they share similar part of speech.",
    "Exactly one choice should be the best fit (choose the single most precise option).",
    "Return JSON with fields exam, section, concept, stem, choices (exactly six strings), correctIndex (0-based), explanation.",
  ];
  if (args.avoidHashes?.length) {
    lines.push(`AVOID_SIMILAR_TO: ${pickN(args.avoidHashes, Math.min(5, args.avoidHashes.length)).join(" | ")}`);
  }
  const user = lines.join("\n");

  const q = await askLLM({ system: sys, user, temperature: 0.3 });

  q.exam = "GRE";
  q.section = "Verbal";
  q.concept = "Sentence Equivalence";

  if (!ensureCategory("Verbal", q.concept)) {
    throw new Error("Model drifted category (Sentence Equivalence).");
  }

  let explanation = (q.explanation || "").trim();
  if (explanation.length < 80) {
    explanation = await generateExplanation({
      stem: q.stem,
      choices: q.choices,
      correctIndex: q.correctIndex,
      targetWords: getExplanationTargetWords(),
    });
  }
  q.explanation = sanitizeExplanation(explanation);

  return [q];
}
