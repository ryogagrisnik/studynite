// lib/validator/quant.ts
import type { Exam } from "@/lib/types";
import { GMAT_QUANT_CATEGORIES } from "@/lib/gmatBank";
export { GMAT_QUANT_CATEGORIES } from "@/lib/gmatBank";

export const GRE_QUANT_CATEGORIES = [
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

export type GreQuantCategory = typeof GRE_QUANT_CATEGORIES[number];
export type GmatQuantCategory = typeof GMAT_QUANT_CATEGORIES[number];

const QC_CHOICES = ["Quantity A", "Quantity B", "Equal", "Cannot be determined"];

export function isQc(choices?: string[], stem?: string): boolean {
  if (!choices || choices.length !== 4) return false;
  const canon = choices.every((c, i) => (c?.trim?.() ?? "") === QC_CHOICES[i]);
  return canon || /Quantity A:/i.test(stem || "") && /Quantity B:/i.test(stem || "");
}

export function validQuantCategory(exam: Exam, cat: string | undefined): boolean {
  if (!cat) return false;
  if (exam === "GMAT") {
    return (GMAT_QUANT_CATEGORIES as readonly string[]).includes(cat);
  }
  return (GRE_QUANT_CATEGORIES as readonly string[]).includes(cat);
}

/** Very light GRE-level guardrails */
export function validateGreQuant(q: {
  concept?: string;
  stem: string;
  choices: string[];
  correctIndex: number;
}): { ok: true } | { ok: false; reason: string } {
  const { concept, stem, choices, correctIndex } = q;

  if (!Array.isArray(choices) || choices.length < 2) {
    return { ok: false, reason: "Choices invalid" };
  }
  if (correctIndex < 0 || correctIndex >= choices.length) {
    return { ok: false, reason: "Correct index out of range" };
  }

  // Category must be one of GRE quant
  if (!validQuantCategory("GRE", concept)) {
    return { ok: false, reason: "Invalid GRE Quant category" };
  }

  // QC must use canonical choices
  if (concept === "Quantitative Comparison") {
    if (!isQc(choices, stem)) return { ok: false, reason: "QC must use canonical four choices" };
  }

  // Ban absurdly large numbers and units (keeps GRE feel)
  if (/\b\d{7,}\b/.test(stem)) return { ok: false, reason: "Numbers too large for GRE tone" };

  // Keep stem reasonably sized
  const words = stem.trim().split(/\s+/).length;
  if (words < 8 || words > 200) return { ok: false, reason: "Stem length out of bounds" };

  return { ok: true };
}

export function validateGmatQuant(q: {
  concept?: string;
  stem: string;
  choices: string[];
  correctIndex: number;
}): { ok: true } | { ok: false; reason: string } {
  const { concept, stem, choices, correctIndex } = q;

  if (!Array.isArray(choices) || choices.length < 2) {
    return { ok: false, reason: "Choices invalid" };
  }
  if (correctIndex < 0 || correctIndex >= choices.length) {
    return { ok: false, reason: "Correct index out of range" };
  }

  if (!validQuantCategory("GMAT", concept)) {
    return { ok: false, reason: "Invalid GMAT Quant category" };
  }

  const words = stem.trim().split(/\s+/).length;
  if (words < 6 || words > 220) {
    return { ok: false, reason: "Stem length out of bounds" };
  }

  return { ok: true };
}
