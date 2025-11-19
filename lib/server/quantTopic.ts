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
    // strip punctuation including slashes and hyphens for robust matching
    .replace(/[^a-z0-9\s]/g, "")
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
  // unify many variants to one canonical label
  "ratio percent fractions": "Ratio / Percent / Fractions",
  "ratios percents": "Ratio / Percent / Fractions",
  "ratios and percents": "Ratio / Percent / Fractions",
  "ratio percent": "Ratio / Percent / Fractions",
  "percent ratios": "Ratio / Percent / Fractions",
  "ratio and percent": "Ratio / Percent / Fractions",

  // Rates / Work / Speed
  "rates work speed": "Rates / Work / Speed",
  "rates/work/speed": "Rates / Work / Speed",

  // Counting / Probability
  "permutation probability": "Permutation & Probability",
  "permutations and probability": "Permutation & Probability",
  "counting probability": "Permutation & Probability",
  "counting and probability": "Permutation & Probability",
  "probability": "Permutation & Probability",

  // Geometry
  "geometry": "Geometry / Solid Geometry",
  "geometry solid geometry": "Geometry / Solid Geometry",

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
  // exact alias first
  if (TOPIC_ALIASES[c]) return TOPIC_ALIASES[c];
  // fuzzy contains mapping for bank labels like "number properties — …"
  if (c.includes("number properties")) return "Number Properties";
  if (c.includes("algebra")) return "Algebra";
  if (c.includes("word problems") || c.includes("arithmetic")) return "Word Problems & Arithmetic";
  if (c.includes("set theory")) return "Set Theory";
  if (c.includes("statistic")) return "Statistics & Average";
  if (c.includes("ratio") || c.includes("percent") || c.includes("fraction")) return "Ratio / Percent / Fractions";
  if (c.includes("rate") || c.includes("work") || c.includes("speed")) return "Rates / Work / Speed";
  if (c.includes("probab") || c.includes("permut")) return "Permutation & Probability";
  if (c.includes("coordinate geometry") || c.includes("coordinate")) return "Coordinate Geometry";
  if (c.includes("quantitative comparison") || c === "qc") return "Quantitative Comparison";
  if (c.includes("geometry")) return "Geometry / Solid Geometry";
  return uiTopic ?? undefined;
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
  const reqAliased = canonicalize(normalizeQuantTopic(requested) ?? requested);
  const bankAliased = canonicalize(normalizeQuantTopic(bankTopic) ?? bankTopic);

  if (reqAliased && bankAliased && reqAliased === bankAliased) return true;

  // Loose contains either way (very forgiving)
  return bankAliased.includes(reqAliased) || reqAliased.includes(bankAliased);
}

/** Force a bank item's topic into a small, canonical set. */
export function canonicalGreTopic(topic?: string | null): string | undefined {
  return normalizeQuantTopic(topic);
}
