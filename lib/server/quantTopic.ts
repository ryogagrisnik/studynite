// lib/server/quantTopic.ts

/**
 * Canonicalize a topic string: lowercase, remove extra punctuation,
 * convert "&" → "and", collapse spaces.
 */
export function canonicalize(input?: string | null): string {
  if (!input) return "";
  return String(input)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s/]/g, "")   // keep slashes for "rates/work/speed" style
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Map MANY possible UI/bank labels → ONE canonical bank label.
 * Right side values should match how your bank actually stores topics.
 */
export const TOPIC_ALIASES: Record<string, string> = {
  // Number Properties
  "number properties": "Number Properties",

  // Algebra (& Inequalities)
  "algebra": "Algebra",
  "algebra inequalities": "Algebra",
  "algebra and inequalities": "Algebra",

  // Word Problems / Arithmetic
  "word problems arithmetic": "Word Problems & Arithmetic",
  "word problems and arithmetic": "Word Problems & Arithmetic",

  // Set Theory
  "set theory": "Set Theory",

  // Statistics
  "statistics average": "Statistics & Average",
  "statistics averages": "Statistics & Average",
  "statistics and average": "Statistics & Average",
  "statistics and averages": "Statistics & Average",

  // Ratios / Percents / Fractions
  "ratio percent fractions": "Ratios & Percents",
  "ratios percents": "Ratios & Percents",
  "ratios and percents": "Ratios & Percents",

  // Rates / Work / Speed
  "rates work speed": "Rates / Work / Speed",
  "rates/work/speed": "Rates / Work / Speed",

  // Counting / Probability
  "permutation probability": "Counting & Probability",
  "counting probability": "Counting & Probability",
  "counting and probability": "Counting & Probability",

  // Geometry
  "geometry": "Geometry",
  "geometry solid geometry": "Geometry",

  // Coordinate Geometry
  "coordinate geometry": "Coordinate Geometry",

  // Quantitative Comparison
  "quantitative comparison": "Quantitative Comparison",
};

/**
 * Normalize a user/request topic string to your bank's canonical label.
 * If we can't map it, return the original (so you can still try a loose match).
 */
export function normalizeQuantTopic(uiTopic?: string | null): string | undefined {
  const c = canonicalize(uiTopic);
  if (!c) return undefined;
  return TOPIC_ALIASES[c] ?? uiTopic ?? undefined;
}

/**
 * Decide if a bank item's topic matches the requested topic.
 * We first try exact (after aliasing), then a loose "includes" check
 * to catch near-misses (e.g., "algebraic expressions" vs "algebra").
 */
export function topicMatches(bankTopic: string | undefined, requested: string | undefined): boolean {
  if (!requested) return true; // treat "no request" as match-all
  const reqCanon = canonicalize(requested);
  const bankCanon = canonicalize(bankTopic);

  // Exact via alias mapping on BOTH sides
  const reqAliased = canonicalize(TOPIC_ALIASES[reqCanon] ?? requested);
  const bankAliased = canonicalize(TOPIC_ALIASES[bankCanon] ?? bankTopic);

  if (reqAliased && bankAliased && reqAliased === bankAliased) return true;

  // Loose contains either way (very forgiving)
  return bankAliased.includes(reqAliased) || reqAliased.includes(bankAliased);
}
