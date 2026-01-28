import { gpt } from "@/lib/openai";
import {
  DEFAULT_FLASHCARD_COUNT,
  DEFAULT_QUESTION_COUNT,
  MAX_FLASHCARD_COUNT,
  MAX_QUESTION_COUNT,
  MIN_FLASHCARD_COUNT,
  MIN_QUESTION_COUNT,
} from "./constants";
import { clampCount } from "./utils";

type RawQuestion = {
  prompt?: string;
  question?: string;
  choices?: string[];
  options?: string[];
  correctIndex?: number;
  explanation?: string;
};

type RawFlashcard = {
  front?: string;
  back?: string;
  question?: string;
  answer?: string;
};

export type GeneratedQuestion = {
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation?: string | null;
};

export type GeneratedFlashcard = {
  front: string;
  back: string;
};

export type GeneratedDeck = {
  title: string;
  questions: GeneratedQuestion[];
  flashcards: GeneratedFlashcard[];
};

function buildFlashcardsFromQuestions(questions: GeneratedQuestion[]) {
  const seen = new Set<string>();
  const cards: GeneratedFlashcard[] = [];
  for (const question of questions) {
    const front = sanitizeText(question.prompt);
    const back = sanitizeText(question.choices?.[question.correctIndex] ?? "");
    const key = `${front}::${back}`;
    if (!front || !back || seen.has(key)) continue;
    seen.add(key);
    cards.push({ front, back });
  }
  return cards;
}

function buildFlashcardsFromText(sourceText: string, targetCount: number) {
  const cards: GeneratedFlashcard[] = [];
  if (!sourceText.trim()) return cards;

  const lines = sourceText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (cards.length >= targetCount) break;
    if (!line.includes(":")) continue;
    const [left, ...rest] = line.split(":");
    const front = sanitizeText(left);
    const back = sanitizeText(rest.join(":"));
    if (front.length < 3 || back.length < 6) continue;
    if (!isValidFlashcard({ front, back }, sourceText)) continue;
    cards.push({ front, back });
  }

  if (cards.length >= targetCount) return cards;

  const sentences = sourceText
    .split(/[.!?]\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 30);

  for (const sentence of sentences) {
    if (cards.length >= targetCount) break;
    const snippet = sentence.split(/[,:;]/)[0]?.trim() ?? "";
    const front = snippet && snippet.length <= 60 ? snippet : `Key point ${cards.length + 1}`;
    cards.push({ front: sanitizeText(front), back: sanitizeText(sentence) });
  }

  if (cards.length >= targetCount) return cards;

  return cards;
}

const BAD_PLACEHOLDER_PATTERNS = [
  /^\s*(?:n\/a|n\.a\.|na|none|unknown|tbd|not provided|not sure)\s*$/i,
  /lorem ipsum/i,
  /\bundefined\b/i,
  /\bnull\b/i,
];

const POLICY_PATTERNS = [
  /\bdo not (reproduce|distribute|display|share|copy)\b/i,
  /\bunauthorized\b/i,
  /\bcopyright\b/i,
  /\ball rights reserved\b/i,
  /\blecture notes\b/i,
  /\bcourse materials?\b/i,
  /\brecordings?\b/i,
  /\bsyllabus\b/i,
  /\bgrading\b/i,
  /\battendance\b/i,
  /\b(course|class|academic)\s+policy\b/i,
  /\b(course|class)\s+(overview|description|objectives|outcomes|goals|requirements|info|focus)\b/i,
  /\b(instructor|professor|teacher|ta|teaching assistant)\b/i,
  /\boffice hours\b/i,
  /\b(textbook|required (text|reading|materials))\b/i,
];

const LECTURE_REF_PATTERNS = [
  /\b(in (this|the)|from|during|in)\s+(lecture|class|session)\b/i,
  /\b(last|today'?s|this)\s+(lecture|class|session)\b/i,
  /\baccording to (the )?(lecture|class|session)\b/i,
  /\b(discussed|covered|mentioned|taught|learned)\s+(in|during)\s+(lecture|class|session)\b/i,
  /\bwe\s+(discussed|covered|learned|saw)\b/i,
];

const GENERIC_LABELS = new Set([
  "note",
  "notes",
  "overview",
  "summary",
  "introduction",
  "intro",
  "chapter",
  "section",
  "unit",
  "module",
  "topic",
  "slide",
  "slides",
  "lecture",
  "lesson",
  "reading",
  "handout",
  "outline",
  "key",
  "concept",
  "idea",
  "definition",
]);

function hasPlaceholderText(value: string) {
  const cleaned = sanitizeText(value);
  if (!cleaned) return true;
  if (/^[^a-z0-9]+$/i.test(cleaned)) return true;
  return BAD_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function looksLikePolicyText(value: string) {
  const cleaned = sanitizeText(value);
  if (!cleaned) return false;
  return POLICY_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function looksLikeLectureRef(value: string) {
  const cleaned = sanitizeText(value);
  if (!cleaned) return false;
  return LECTURE_REF_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function hasTrailingFragment(value: string) {
  return /[-:]\s*$/.test(value.trim());
}

function isGenericLabel(value: string) {
  const cleaned = sanitizeText(value).toLowerCase();
  if (!cleaned) return true;
  if (GENERIC_LABELS.has(cleaned)) return true;
  return false;
}

function extractKeywords(value: string) {
  return (sanitizeText(value).toLowerCase().match(/[a-z0-9]{5,}/g) || []).filter(Boolean);
}

function hasSourceOverlap(value: string, sourceText?: string) {
  if (!sourceText) return true;
  const keywords = extractKeywords(value);
  if (keywords.length === 0) return true;
  const source = sourceText.toLowerCase();
  return keywords.some((keyword) => source.includes(keyword));
}

function isValidQuestion(question: GeneratedQuestion, sourceText?: string) {
  const prompt = sanitizeText(question.prompt);
  if (prompt.length < 15) return false;
  if (prompt.split(/\s+/).filter(Boolean).length < 4) return false;
  if (!Array.isArray(question.choices) || question.choices.length !== 4) return false;
  if (question.correctIndex < 0 || question.correctIndex >= question.choices.length) return false;
  if (looksLikePolicyText(prompt) || hasTrailingFragment(prompt)) return false;
  if (looksLikeLectureRef(prompt)) return false;
  if (isGenericLabel(prompt)) return false;
  if (hasPlaceholderText(prompt)) return false;
  const cleanedChoices = question.choices.map((choice) => sanitizeText(choice));
  if (
    cleanedChoices.some(
      (choice) =>
        choice.length < 2 ||
        hasPlaceholderText(choice) ||
        looksLikePolicyText(choice) ||
        hasTrailingFragment(choice)
    )
  ) {
    return false;
  }
  const normalizedChoices = cleanedChoices.map((choice) => choice.toLowerCase());
  if (new Set(normalizedChoices).size !== cleanedChoices.length) return false;
  const correctChoice = cleanedChoices[question.correctIndex] ?? "";
  if (isGenericLabel(correctChoice)) return false;
  if (!hasSourceOverlap(prompt, sourceText) && !hasSourceOverlap(correctChoice, sourceText)) {
    return false;
  }
  return true;
}

function isValidFlashcard(card: GeneratedFlashcard, sourceText?: string) {
  const front = sanitizeText(card.front);
  const back = sanitizeText(card.back);
  if (front.length < 3 || back.length < 2) return false;
  if (front.toLowerCase() === back.toLowerCase()) return false;
  if (looksLikePolicyText(front) || looksLikePolicyText(back)) return false;
  if (hasTrailingFragment(front) || hasTrailingFragment(back)) return false;
  if (isGenericLabel(front)) return false;
  if (hasPlaceholderText(front) || hasPlaceholderText(back)) return false;
  const frontWords = front.split(/\s+/).filter(Boolean);
  const backWords = back.split(/\s+/).filter(Boolean);
  const isAcronym = front === front.toUpperCase() && front.length <= 6;
  if (frontWords.length < 2 && front.length < 6 && !isAcronym) return false;
  if (backWords.length < 1 && back.length < 4) return false;
  if (!hasSourceOverlap(front, sourceText) && !hasSourceOverlap(back, sourceText)) {
    return false;
  }
  return true;
}

export async function generateStudyDeck({
  sourceText,
  title,
  questionCount = DEFAULT_QUESTION_COUNT,
  flashcardCount = DEFAULT_FLASHCARD_COUNT,
  includeQuestions = true,
  includeFlashcards = true,
  includeExplanations = true,
  difficulty = "medium",
}: {
  sourceText: string;
  title?: string;
  questionCount?: number;
  flashcardCount?: number;
  includeQuestions?: boolean;
  includeFlashcards?: boolean;
  includeExplanations?: boolean;
  difficulty?: "easy" | "medium" | "hard";
}): Promise<GeneratedDeck> {
  const safeQuestionCount = includeQuestions
    ? clampCount(questionCount, MIN_QUESTION_COUNT, MAX_QUESTION_COUNT)
    : 0;
  const safeFlashcardCount = includeFlashcards
    ? clampCount(flashcardCount, MIN_FLASHCARD_COUNT, MAX_FLASHCARD_COUNT)
    : 0;

  const system =
    "You generate multiple-choice quizzes and flashcards for group study. " +
    "Return JSON only with keys: title, questions, flashcards. " +
    "Questions are multiple-choice with 4 options each. " +
    "Flashcards are short Q/A pairs. Keep everything grounded in the source text. " +
    "Skip policy, copyright, or administrative content.";

  const requirements = [
    includeQuestions
      ? `- Create ${safeQuestionCount} multiple-choice questions.`
      : "- Return an empty questions array.",
    includeQuestions
      ? includeExplanations
        ? "- Each question has: prompt, choices (array of 4), correctIndex (0-3), explanation (short)."
        : "- Each question has: prompt, choices (array of 4), correctIndex (0-3). Do not add explanations."
      : null,
    includeFlashcards
      ? `- Create ${safeFlashcardCount} flashcards with front/back text.`
      : "- Return an empty flashcards array.",
    "- Use clear wording; avoid trick questions.",
    "- Do not use generic labels like 'Note', 'Overview', or 'Section' as flashcard fronts.",
    "- Ignore any policy text (copyright, recording rules, grading, or syllabus notes).",
    `- Difficulty: ${difficulty}.`,
    "- Easy = direct recall/definitions. Medium = 1-2 step reasoning. Hard = multi-step or nuanced inference.",
    "- Output JSON only.",
  ].filter(Boolean);

  const user =
    `Source material:\n${sourceText}\n\n` +
    `Requirements:\n` +
    `${requirements.join("\n")}`;

  const result = await gpt({
    system,
    user,
    json: true,
    temperature: 0.2,
    model: process.env.OPENAI_STUDYHALL_MODEL || undefined,
  });

  return normalizeGeneratedDeck(result, title, {
    questionCount: safeQuestionCount,
    flashcardCount: safeFlashcardCount,
    includeQuestions,
    includeFlashcards,
    includeExplanations,
    sourceText,
  });
}

function normalizeGeneratedDeck(
  raw: any,
  titleOverride?: string,
  options?: {
    questionCount: number;
    flashcardCount: number;
    includeQuestions: boolean;
    includeFlashcards: boolean;
    includeExplanations: boolean;
    sourceText?: string;
  }
): GeneratedDeck {
  const title = sanitizeText(titleOverride ?? raw?.title ?? "Study deck");
  const questions: RawQuestion[] = Array.isArray(raw?.questions) ? raw.questions : [];
  const flashcards: RawFlashcard[] = Array.isArray(raw?.flashcards) ? raw.flashcards : [];
  const requestedQuestionCount = options?.questionCount ?? DEFAULT_QUESTION_COUNT;
  const requestedFlashcardCount = options?.flashcardCount ?? DEFAULT_FLASHCARD_COUNT;
  const wantsQuestions = options?.includeQuestions ?? true;
  const wantsFlashcards = options?.includeFlashcards ?? true;

  const normalizedQuestions = questions
    .map((q) => {
      const prompt = sanitizeText(q?.prompt ?? q?.question);
      const choices = (q?.choices ?? q?.options ?? []).map((choice) => sanitizeText(choice));
      const cleanChoices = choices.filter(Boolean);
      if (!prompt || cleanChoices.length < 4) return null;
      const trimmedChoices = cleanChoices.slice(0, 4);
      const correctIndex = clampCount(
        Number.isFinite(q?.correctIndex as number) ? (q?.correctIndex as number) : 0,
        0,
        trimmedChoices.length - 1,
      );
      const explanation = options?.includeExplanations ? sanitizeText(q?.explanation ?? "") : "";
      return {
        prompt,
        choices: trimmedChoices,
        correctIndex,
        explanation: explanation || null,
      };
    })
    .filter((q): q is GeneratedQuestion => Boolean(q));

  const normalizedFlashcards = flashcards
    .map((card) => {
      const front = sanitizeText(card?.front ?? card?.question);
      const back = sanitizeText(card?.back ?? card?.answer);
      if (!front || !back) return null;
      return { front, back };
    })
    .filter((c): c is GeneratedFlashcard => Boolean(c));

  const cleanedQuestions = (() => {
    const seen = new Set<string>();
    const filtered = normalizedQuestions.filter((question) =>
      isValidQuestion(question, options?.sourceText)
    );
    return filtered.filter((question) => {
      const key = `${question.prompt.toLowerCase()}::${question.choices
        .map((choice) => choice.toLowerCase())
        .join("|")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  const cleanedFlashcards = (() => {
    const seen = new Set<string>();
    const filtered = normalizedFlashcards.filter((card) =>
      isValidFlashcard(card, options?.sourceText)
    );
    return filtered.filter((card) => {
      const key = `${card.front.toLowerCase()}::${card.back.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  if (wantsQuestions && cleanedQuestions.length === 0) {
    throw new Error("Deck generation returned no quiz questions.");
  }
  if (wantsQuestions && cleanedQuestions.length < Math.max(1, Math.ceil(requestedQuestionCount * 0.6))) {
    throw new Error("Deck generation returned low-quality quiz questions. Try again with more notes.");
  }

  let combinedFlashcards = cleanedFlashcards;
  if (wantsFlashcards && combinedFlashcards.length < requestedFlashcardCount) {
    const fallback = buildFlashcardsFromQuestions(cleanedQuestions);
    const merged: GeneratedFlashcard[] = [];
    const seen = new Set<string>();
    for (const card of [...combinedFlashcards, ...fallback]) {
      const front = sanitizeText(card.front);
      const back = sanitizeText(card.back);
      if (!front || !back) continue;
      if (!isValidFlashcard({ front, back }, options?.sourceText)) continue;
      const key = `${front}::${back}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push({ front, back });
      if (merged.length >= requestedFlashcardCount) break;
    }
    combinedFlashcards = merged;
  }

  if (wantsFlashcards && combinedFlashcards.length < requestedFlashcardCount) {
    const fallback = buildFlashcardsFromText(options?.sourceText ?? "", requestedFlashcardCount);
    const merged: GeneratedFlashcard[] = [];
    const seen = new Set<string>();
    for (const card of [...combinedFlashcards, ...fallback]) {
      const front = sanitizeText(card.front);
      const back = sanitizeText(card.back);
      if (!front || !back) continue;
      if (!isValidFlashcard({ front, back }, options?.sourceText)) continue;
      const key = `${front}::${back}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push({ front, back });
      if (merged.length >= requestedFlashcardCount) break;
    }
    combinedFlashcards = merged;
  }

  if (wantsFlashcards && combinedFlashcards.length === 0) {
    throw new Error("Deck generation returned no flashcards.");
  }
  if (
    wantsFlashcards &&
    combinedFlashcards.length < Math.max(1, Math.ceil(requestedFlashcardCount * 0.6))
  ) {
    throw new Error("Deck generation returned low-quality flashcards. Try again with more notes.");
  }

  return {
    title,
    questions: wantsQuestions ? cleanedQuestions.slice(0, requestedQuestionCount) : [],
    flashcards: wantsFlashcards ? combinedFlashcards.slice(0, requestedFlashcardCount) : [],
  };
}

function sanitizeText(value?: string | null) {
  if (!value) return "";
  return String(value).replace(/\s+/g, " ").trim();
}
