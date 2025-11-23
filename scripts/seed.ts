import prisma from "../lib/prisma";
import { generateGreQuantBatch, generateGreRcBatch, generateGreSentenceEquivalence, generateGreTextCompletion } from "../lib/generator";
import { pickRandomGmatQuant } from "../lib/gmatBank";
import { sanitizeExplanation, generateExplanation, getExplanationTargetWords } from "../lib/explainer";
import { sanitizeHtml } from "../lib/sanitizeHtml";

type Diff = "easy" | "medium" | "hard";

const GRE_QUANT_TOPICS: readonly string[] = [
  "Number Properties",
  "Algebra",
  "Word Problems & Arithmetic",
  "Set Theory",
  "Statistics & Average",
  "Ratio / Percent / Fractions",
  "Rates / Work / Speed",
  "Permutation & Probability",
  "Geometry / Solid Geometry",
  "Coordinate Geometry",
  "Quantitative Comparison",
] as const;

const GRE_VERBAL_MODES: readonly ("Text Completion" | "Sentence Equivalence" | "Reading Comprehension")[] = [
  "Text Completion",
  "Sentence Equivalence",
  "Reading Comprehension",
] as const;

const DIFFS: Diff[] = ["easy", "medium", "hard"];

function difficultyToScore(diff: Diff): number {
  return diff === "easy" ? 500 : diff === "medium" ? 600 : 700;
}

async function ensureExplanation(stem: string, choices: string[], correctIndex: number, existing?: string | null) {
  const trimmed = (existing ?? "").trim();
  if (trimmed.length >= 60) {
    return sanitizeExplanation(trimmed);
  }
  const generated = await generateExplanation({
    stem,
    choices,
    correctIndex,
    targetWords: getExplanationTargetWords(),
  });
  return sanitizeExplanation(generated);
}

async function saveQuestion(params: {
  exam: "GRE" | "GMAT";
  section: "Quant" | "Verbal";
  topic: string;
  stem: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  difficulty: Diff;
}) {
  const safeStem = sanitizeHtml(params.stem) ?? params.stem;
  const safeExplanation = sanitizeHtml(params.explanation) ?? params.explanation;
  const answer = params.choices[params.correctIndex] ?? params.choices[0] ?? "";

  const existing = await prisma.question.findFirst({
    where: {
      exam: params.exam,
      section: params.section,
      stem: safeStem,
    },
    select: { id: true },
  });
  if (existing) {
    return existing.id;
  }

  const created = await prisma.question.create({
    data: {
      exam: params.exam,
      section: params.section,
      topic: params.topic,
      stem: safeStem,
      choices: params.choices,
      answer,
      explanation: safeExplanation,
      difficulty: difficultyToScore(params.difficulty),
    },
    select: { id: true },
  });
  return created.id;
}

async function seedGreQuant(): Promise<number> {
  let created = 0;
  for (const topic of GRE_QUANT_TOPICS) {
    for (const difficulty of DIFFS) {
      const [question] = await generateGreQuantBatch({ topic, difficulty });
      const choices = Array.isArray(question.choices) ? question.choices : [];
      const correctIndex = Math.min(
        Math.max(Number(question.correctIndex) || 0, 0),
        Math.max(0, choices.length - 1),
      );
      const explanation = await ensureExplanation(question.stem, choices, correctIndex, question.explanation);
      await saveQuestion({
        exam: "GRE",
        section: "Quant",
        topic: question.concept || topic,
        stem: question.stem,
        choices,
        correctIndex,
        explanation,
        difficulty,
      });
      created += 1;
    }
  }
  return created;
}

async function seedGmatQuant(): Promise<number> {
  let created = 0;
  for (const difficulty of DIFFS) {
    const sample = pickRandomGmatQuant();
    const choices = Array.isArray(sample.choices) ? sample.choices : [];
    const boundedIndex = Math.min(Math.max(Number(sample.correctIndex) || 0, 0), Math.max(0, choices.length - 1));
    const explanation = await ensureExplanation(sample.stem, choices, boundedIndex, sample.explanation);
    await saveQuestion({
      exam: "GMAT",
      section: "Quant",
      topic: sample.concept,
      stem: sample.stem,
      choices,
      correctIndex: boundedIndex,
      explanation,
      difficulty: sample.difficulty ?? difficulty,
    });
    created += 1;
  }
  return created;
}

async function seedGreVerbal(): Promise<number> {
  let created = 0;
  for (const difficulty of DIFFS) {
    for (const mode of GRE_VERBAL_MODES) {
      if (mode === "Reading Comprehension") {
        const [question] = await generateGreRcBatch({ category: mode, difficulty, withPassage: true });
        const stem = question.passage
          ? `Passage:\n${question.passage}\n\nQuestion:\n${question.stem}`
          : question.stem;
        const choices = Array.isArray(question.choices) ? question.choices : [];
        const correctIndex = Math.min(Math.max(Number(question.correctIndex) || 0, 0), Math.max(0, choices.length - 1));
        const explanation = await ensureExplanation(stem, choices, correctIndex, question.explanation);
        await saveQuestion({
          exam: "GRE",
          section: "Verbal",
          topic: question.concept ?? mode,
          stem,
          choices,
          correctIndex,
          explanation,
          difficulty,
        });
      } else if (mode === "Text Completion") {
        const [question] = await generateGreTextCompletion({ difficulty });
        const choices = Array.isArray(question.choices) ? question.choices : [];
        const correctIndex = Math.min(Math.max(Number(question.correctIndex) || 0, 0), Math.max(0, choices.length - 1));
        const explanation = await ensureExplanation(question.stem, choices, correctIndex, question.explanation);
        await saveQuestion({
          exam: "GRE",
          section: "Verbal",
          topic: "Text Completion",
          stem: question.stem,
          choices,
          correctIndex,
          explanation,
          difficulty,
        });
      } else {
        const [question] = await generateGreSentenceEquivalence({ difficulty });
        const choices = Array.isArray(question.choices) ? question.choices : [];
        const correctIndex = Math.min(Math.max(Number(question.correctIndex) || 0, 0), Math.max(0, choices.length - 1));
        const explanation = await ensureExplanation(question.stem, choices, correctIndex, question.explanation);
        await saveQuestion({
          exam: "GRE",
          section: "Verbal",
          topic: "Sentence Equivalence",
          stem: question.stem,
          choices,
          correctIndex,
          explanation,
          difficulty,
        });
      }
      created += 1;
    }
  }
  return created;
}

async function main() {
  const greQuant = await seedGreQuant();
  const gmatQuant = await seedGmatQuant();
  const greVerbal = await seedGreVerbal();
  console.log(`Seeded ${greQuant} GRE Quant, ${gmatQuant} GMAT Quant, and ${greVerbal} GRE Verbal questions.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
