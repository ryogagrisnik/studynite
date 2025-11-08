// lib/validator/verbal.ts
export const GRE_RC_CATEGORIES = [
  "Main Idea",
  "Inference",
  "Detail",
  "Function/Purpose",
  "Vocabulary-in-Context",
  "Author Attitude/Tone",
  "Application/Analogy"
] as const;

export type GreRcCategory = typeof GRE_RC_CATEGORIES[number];

export const GRE_VERBAL_PRIMARY_TYPES = [
  "Text Completion",
  "Sentence Equivalence",
  "Reading Comprehension",
] as const;

const GRE_VERBAL_ALL = new Set<string>([
  ...GRE_RC_CATEGORIES,
  ...GRE_VERBAL_PRIMARY_TYPES,
]);

export function validVerbalCategory(
  cat: string | undefined
): cat is typeof GRE_VERBAL_PRIMARY_TYPES[number] | GreRcCategory {
  return !!cat && GRE_VERBAL_ALL.has(cat);
}

export function validateGreRcItem(q: {
  passage?: string;
  concept?: string;  // use "concept" as the category key for consistency
  stem: string;
  choices: string[];
  correctIndex: number;
}): { ok: true } | { ok: false; reason: string } {
  const { passage = "", concept, stem, choices, correctIndex } = q;

  if (!validVerbalCategory(concept)) return { ok: false, reason: "Invalid GRE RC category" };

  if (!Array.isArray(choices) || choices.length < 2) return { ok: false, reason: "Choices invalid" };
  if (correctIndex < 0 || correctIndex >= choices.length) return { ok: false, reason: "Correct index out of range" };

  // Passage length: short and medium GRE RC
  const w = passage.trim().split(/\s+/).filter(Boolean).length;
  if (w && (w < 80 || w > 400)) return { ok: false, reason: "Passage length not GRE-like (80–400 words)" };

  // Stem length sanity
  const sw = stem.trim().split(/\s+/).filter(Boolean).length;
  if (sw < 5 || sw > 80) return { ok: false, reason: "Question stem length out of bounds" };

  // Avoid giveaways like "ALL of the following EXCEPT" for most categories (optional, GRE sometimes uses EXCEPT)
  // Keep as soft rule if you like:
  // if (/EXCEPT\b/i.test(stem) && concept !== "Detail") return { ok: false, reason: "EXCEPT forms restricted" };

  return { ok: true };
}
