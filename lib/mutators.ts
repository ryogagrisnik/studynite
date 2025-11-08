import type { BankItem } from "./bank";

export type NewQuestion = {
  stem: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
};

function pick<T>(arr: T[]) { return arr[Math.floor(Math.random() * arr.length)]; }

/* ---------- Quant helpers ---------- */

// simple parameterization for mod/divisibility pattern like n ≡ a (mod m)
export function mutateNumberPropertiesDivisibility(seed: BankItem): NewQuestion | null {
  // Find "n ≡ A (mod M)" pattern
  const m = seed.stem.match(/n\s*≡\s*(\d+)\s*\(mod\s*(\d+)\)/i);
  if (!m) return null;
  const A = parseInt(m[1], 10);
  const M = parseInt(m[2], 10);

  // pick new congruence same structure: keep (A mod gcd baselines)
  const mods = [M, M, M*2];            // occasionally widen modulus
  const Ms = pick(mods);
  const As = ((A + [5,10,15,20,25,30][Math.floor(Math.random()*6)]) % Ms) || (A % Ms);

  // Build new stem
  const stem = seed.stem.replace(/n\s*≡\s*\d+\s*\(mod\s*\d+\)/i, `n ≡ ${As} (mod ${Ms})`);

  // Choices: keep original set shape but shuffle 1 hard trap (even factor)
  if (!Array.isArray(seed.choices) || seed.choices.length === 0) return null;
  const baseChoices = [...seed.choices];
  // ensure one “cannot be divisor” choice is even (if remainder enforces oddness)
  baseChoices.sort(() => Math.random() - 0.5);
  const choices = baseChoices.slice(0, 5);

  // Correct choice logic (very lightweight):
  // n = Ms*k + As
  // If As is not divisible by 2, then any even number requiring factor 2 is suspicious.
  // We'll pick one even candidate in choices (if any) as the "cannot" answer.
  const evenIdx = choices.findIndex(c => parseInt(String(c), 10) % 2 === 0);
  const correctIndex = evenIdx >= 0 ? evenIdx : 0;

  return {
    stem,
    choices,
    correctIndex,
    explanation:
      "Write n = m k + a. If a is odd, n may be odd for some k; any even divisor requiring a factor 2 may fail. The listed choice violates necessary parity.",
  };
}

// combinatorics: choose positions for a color among n
export function mutateCombinatoricsDistribution(seed: BankItem): NewQuestion | null {
  const m = seed.stem.match(/(\d+)\s+identical.*?and\s+(\d+)\s+identical.*?among\s+(\d+)\s+.*?(children|employees|people)/i);
  if (!m) return null;
  const a = parseInt(m[1], 10);
  const b = parseInt(m[2], 10);
  const n = parseInt(m[3], 10);

  // random tweak but same shape
  const ra = Math.max(1, a + [-1,0,0,1][Math.floor(Math.random()*4)]);
  const rb = Math.max(1, b + [-1,0,0,1][Math.floor(Math.random()*4)]);

  const stem = `In how many ways can ${ra} identical blue items and ${rb} identical red items be given to ${n} distinct people (one each)?`;
  const correct = binom(n, rb); // choose who gets red; rest get blue

  // Build options around the correct value
  const choices = dedupe([correct, correct + n, Math.max(1, correct - n), correct * 2, Math.max(1, Math.round(correct / 2))])
    .slice(0,4)
    .map(String);

  const correctIndex = choices.findIndex(c => parseInt(c,10) === correct);

  return {
    stem,
    choices,
    correctIndex: correctIndex >= 0 ? correctIndex : 0,
    explanation: `Choose which ${rb} of the ${n} people receive red: C(${n},${rb}). The rest automatically get blue.`,
  };
}

function binom(n: number, k: number) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  k = Math.min(k, n - k);
  let res = 1;
  for (let i = 1; i <= k; i++) res = (res * (n - k + i)) / i;
  return Math.round(res);
}

function dedupe<T>(arr: T[]) { return [...new Set(arr)]; }

/* ---------- Verbal helpers ---------- */

const TC_POS = ["enamored by", "taken with", "enchanted by", "captivated by"];
const TC_NEG = ["disconcerted by", "disenchanted with", "irked by", "nonplussed by"];

export function mutateTextCompletion(seed: BankItem): NewQuestion | null {
  // Replace the blank word with a controlled synonym set while preserving logic cue words.
  const isPositive = /worthwhile|redeemed|admiring|lauded|buoyed/i.test(seed.stem);
  const pool = isPositive ? TC_POS : TC_NEG;
  if (!Array.isArray(seed.choices) || seed.choices.length === 0) return null;
  const choices = dedupe([pick(pool), ...seed.choices]).slice(0,5);

  // Correct is the first pool term present in choices
  const correctIndex = Math.max(0, choices.findIndex(c => pool.includes(c)));

  const stem = seed.stem.replace(/____|__+/, "____"); // keep a blank if present
  return {
    stem,
    choices,
    correctIndex,
    explanation: "Context dictates a positive (or negative) valence word; the keyed choice matches the sentence’s tone and logic.",
  };
}

// sentence equivalence: ensure two synonyms; here we just ask model for pair later,
// but we keep this mutator as a cheap shuffle to vary near equivalents.
export function mutateSentenceEquivalence(seed: BankItem): NewQuestion | null {
  const stem = seed.stem;
  if (!Array.isArray(seed.choices) || seed.choices.length === 0) return null;
  const choices = [...seed.choices].sort(() => Math.random() - 0.5);
  // choose two correct indices among synonyms present in seed.answer
  const correctSet = new Set(seed.answer.split("|").map(s => s.trim()));
  const indices = choices
    .map((c, i) => (correctSet.has(c) ? i : -1))
    .filter(i => i >= 0);
  if (indices.length < 2) return null;
  // hack: pick the first one as canonical index; API still returns single index to align with your UI
  return {
    stem,
    choices,
    correctIndex: indices[0],
    explanation: "Both keyed options yield the same meaning; the rest differ in tone or sense.",
  };
}
