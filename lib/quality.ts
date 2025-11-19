// lib/quality.ts
// Lightweight quality checks for questions served to users.
// Heuristics only: aims to catch obviously broken items and approximate difficulty.

export type Difficulty = "easy" | "medium" | "hard";

export type ModernQuestion = {
  id: string;
  exam: "GRE" | "GMAT";
  section: "Quant" | "Verbal";
  stem: string;
  stemHTML: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  explainHTML?: string;
  difficulty: Difficulty | string;
  kind?: "mcq" | "qc" | "ds";
  quantityA?: string | null;
  quantityB?: string | null;
};

export type QualityIssue = {
  code: string;
  message: string;
};

export type QualityReport = {
  ok: boolean;
  issues: QualityIssue[];
  predictedDifficulty: Difficulty;
  confidence: number; // 0..1
  originalDifficulty?: string;
  adjusted: boolean;
};

const BAD_TOKENS = [
  /\brac\b/i, // should be \\frac
  /\bimes\b/i, // should be \\times
  /&lt;|&gt;|&amp;lt;|&amp;gt;/i,
  /\\sum(?![^{])\b/, // stray LaTeX control words
  /\\prod(?![^{])\b/,
];

function stripHtml(input: string): string {
  return String(input || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(s: string): number {
  return (s.match(/\b\w+\b/g) || []).length;
}

function sentenceCount(s: string): number {
  return (s.match(/[.!?](?:\s|$)/g) || []).length || (s ? 1 : 0);
}

function countRegex(s: string, re: RegExp): number {
  let m: RegExpExecArray | null;
  let c = 0;
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  while ((m = r.exec(s)) !== null) c++;
  return c;
}

function estimateDifficulty(section: ModernQuestion["section"], stemText: string, explainText: string, choices: string[]): Difficulty {
  const text = (stemText + "\n" + explainText).toLowerCase();
  // Trivial arithmetic check: expression has only numbers/operators and no variables/words
  const trivialExpr = /^[\s0-9^+\-*/().=]+$/.test(stemText.trim()) && !/[a-zA-Z]/.test(stemText);
  if (trivialExpr) return "easy";

  // Trivial coordinate-geometry pattern: slope/y-intercept from two points
  if (section === "Quant") {
    const mentionsSlope = /\bslope\b/.test(text);
    const mentionsYInt = /y[-\s]?intercept/.test(text);
    const coordPairs = (text.match(/\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)/g) || []).length;
    const advancedGeoTokens = /perpendicular|parallel|intersection|intersect|midpoint|triangle|area|distance\s+from|circle|radius|diameter|region|inequalit|system of|simultaneous|locus/.test(text);
    if (mentionsSlope && (mentionsYInt || /y\s*=\s*/.test(text)) && coordPairs <= 2 && !advancedGeoTokens) {
      return "easy";
    }
  }

  let score = 0;
  // Signal words and multi-step indicators
  const signals = ["therefore","thus","hence","assume","let","consider","implies","consequently","case","suppose","note that","given that","subject to","at least","at most"];
  for (const w of signals) if (text.includes(w)) score += 1.2;
  // Math density
  score += countRegex(text, /[=±≠≤≥]/g) * 0.8;
  score += countRegex(text, /\\?frac|\b\d+\/\d+\b/g) * 1.1;
  score += countRegex(text, /\\sqrt|√/g) * 1.0;
  score += countRegex(text, /\\sum|\\binom|choose\b|permutation|combination|probability/gi) * 1.2;
  score += countRegex(text, /prime|coprime|distinct|integer|remainder|mod\b|divisible|ratio/gi) * 0.8;
  // Numbers magnitude / structure
  score += countRegex(text, /\b\d{3,}\b/g) * 0.4; // 3+ digits
  // Length / complexity from explanation
  const sc = sentenceCount(explainText);
  const wc = wordCount(explainText);
  score += Math.min(8, Math.max(0, sc - 3)) * 0.5;
  score += Math.min(12, Math.max(0, wc - 140) / 20) * 0.3;

  if (section === "Verbal") {
    score += countRegex(text, /however|although|nevertheless|except|unless|except that|despite/gi) * 0.6;
    score += countRegex(text, /inference|assumption|author|tone/gi) * 0.5;
  }

  // Map score -> difficulty (tightened thresholds)
  if (score >= 10) return "hard";
  if (score >= 6) return "medium";
  return "easy";
}

export function checkQuestionQuality(q: ModernQuestion): QualityReport {
  const issues: QualityIssue[] = [];

  // Basic structure
  if (!q.stem || !q.stemHTML) issues.push({ code: 'NO_STEM', message: 'Missing question stem.' });
  if (!Array.isArray(q.choices) || q.choices.length < 2) issues.push({ code: 'CHOICES_FEW', message: 'Not enough choices.' });
  if (q.correctIndex == null || q.correctIndex < 0 || q.correctIndex >= (q.choices?.length || 0)) {
    issues.push({ code: 'BAD_ANSWER_INDEX', message: 'Correct index out of range.' });
  }

  // Type-specific checks
  if (q.kind === 'qc') {
    if (q.choices.length !== 4) issues.push({ code: 'QC_CHOICES', message: 'Quantitative Comparison must have exactly 4 choices.' });
    const joined = q.choices.join(' ').toLowerCase();
    const needed = ['quantity a', 'quantity b', 'equal', 'cannot be determined'];
    for (const word of needed) if (!joined.includes(word)) {
      issues.push({ code: 'QC_LABELS', message: 'QC choices must include standard labels.' }); break;
    }
  }
  if (q.kind === 'ds') {
    // GMAT DS has 5 canonical statements; soft-check by count
    if (q.choices.length !== 5) issues.push({ code: 'DS_CHOICES', message: 'Data Sufficiency should have 5 standard choices.' });
  }

  // Readability
  const stemText = stripHtml(q.stemHTML || q.stem);
  const explainText = stripHtml(q.explainHTML || q.explanation || "");
  const sWords = wordCount(stemText);
  const eWords = wordCount(explainText);
  if (sWords < 6) issues.push({ code: 'STEM_TOO_SHORT', message: 'Stem is too short to be clear.' });
  if (eWords < 60) issues.push({ code: 'EXPLAIN_TOO_SHORT', message: 'Explanation is too brief.' });

  // Detect obviously clipped or incomplete comparative phrases in the stem.
  const stemLower = stemText.toLowerCase();
  // Pattern: "both 12 and what/which/when/where/why/how ..." (missing second item)
  if (/\bboth\b[^.!?]*\band\s+(what|which|when|where|why|how)\b/.test(stemLower)) {
    issues.push({
      code: "STEM_INCOMPLETE_BOTH_AND",
      message: 'Stem appears to use "both ... and" without a second item.',
    });
  }

  for (const pattern of BAD_TOKENS) {
    if (pattern.test(stemText) || pattern.test(explainText)) {
      issues.push({ code: 'BAD_TOKENS', message: 'Contains unreadable tokens (math typos or entities).' });
      break;
    }
  }

  // Simple balance checks for parentheses/brackets in text (very loose)
  const openParens = (stemText.match(/\(/g) || []).length;
  const closeParens = (stemText.match(/\)/g) || []).length;
  if (openParens !== closeParens) issues.push({ code: 'UNBALANCED_PARENS', message: 'Unbalanced parentheses in stem.' });

  // Difficulty estimation and mismatch detection
  const predicted = estimateDifficulty(q.section, stemText, explainText, q.choices);
  const original = (q.difficulty || '').toString().toLowerCase();
  let adjusted = false;
  if (original && (original === 'easy' || original === 'medium' || original === 'hard')) {
    const mismatch = original !== predicted;
    if (mismatch) {
      adjusted = true;
    }
  }

  // Confidence heuristic: fewer issues and stronger signal words -> higher confidence
  const baseConf = Math.max(0.3, 1 - issues.length * 0.12);
  const signalBoost = Math.min(0.3, countRegex(explainText, /therefore|thus|hence|implies/gi) * 0.05);
  const confidence = Math.min(1, baseConf + signalBoost);

  return {
    ok: issues.length === 0,
    issues,
    predictedDifficulty: predicted,
    confidence,
    originalDifficulty: original || undefined,
    adjusted,
  };
}
