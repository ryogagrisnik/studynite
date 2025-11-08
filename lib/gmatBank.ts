// lib/gmatBank.ts
import { randomInt } from "crypto";

export type GmatConcept =
  | "Number Properties & Arithmetic"
  | "Algebraic Equations & Inequalities"
  | "Exponentials & Functions"
  | "Word Problems & Rates"
  | "Counting & Probability"
  | "Data Analysis & Sets"
  | "Geometry & Coordinate Geometry"
  | "Data Sufficiency — Algebra & Number"
  | "Data Sufficiency — Geometry & Measurement"
  | "Data Sufficiency — Applications";

export type GmatQuestion = {
  id: string;
  concept: GmatConcept;
  difficulty: "easy" | "medium" | "hard";
  kind?: "ps" | "ds";
  stem: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  badge?: string;
};

export const GMAT_QUANT_CATEGORIES: readonly GmatConcept[] = [
  "Number Properties & Arithmetic",
  "Algebraic Equations & Inequalities",
  "Exponentials & Functions",
  "Word Problems & Rates",
  "Counting & Probability",
  "Data Analysis & Sets",
  "Geometry & Coordinate Geometry",
  "Data Sufficiency — Algebra & Number",
  "Data Sufficiency — Geometry & Measurement",
  "Data Sufficiency — Applications",
] as const;

const DS_STANDARD_CHOICES = [
  "Statement (1) ALONE is sufficient, but statement (2) alone is not sufficient.",
  "Statement (2) ALONE is sufficient, but statement (1) alone is not sufficient.",
  "BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.",
  "EACH statement ALONE is sufficient.",
  "Statements (1) and (2) TOGETHER are NOT sufficient.",
];

const qid = (s: string) => s.replace(/\W+/g, "_").slice(0, 48);

const badge = (concept: GmatConcept) => `GMAT – Quant (${concept})`;

export const GMAT_QUESTIONS: GmatQuestion[] = [
  {
    id: qid("GMAT_NumberProperties_square_multiple_18_45"),
    concept: "Number Properties & Arithmetic",
    difficulty: "medium",
    kind: "ps",
    stem:
      "Positive integer n is divisible by both 18 and 45. What is the smallest possible value of n that is also a perfect square?",
    choices: ["225", "450", "900", "1,350", "1,800"],
    correctIndex: 2,
    explanation:
      "The least common multiple of 18 (2·3²) and 45 (3²·5) is 90 = 2¹·3²·5¹. For n to be a perfect square, every prime exponent must be even, so we multiply by 2·5 to obtain 2²·3²·5² = 900. Any larger multiple would exceed this minimum.",
    badge: badge("Number Properties & Arithmetic"),
  },
  {
    id: qid("GMAT_Algebra_linear_system_solve_for_x"),
    concept: "Algebraic Equations & Inequalities",
    difficulty: "easy",
    kind: "ps",
    stem: "If 2x + 3y = 19 and x − y = 2, what is the value of x?",
    choices: ["2", "3", "5", "7", "9"],
    correctIndex: 2,
    explanation:
      "From x − y = 2 we have x = y + 2. Substitute into 2x + 3y = 19 to get 2(y + 2) + 3y = 19 ⇒ 5y + 4 = 19 ⇒ 5y = 15 ⇒ y = 3, and thus x = 5.",
    badge: badge("Algebraic Equations & Inequalities"),
  },
  {
    id: qid("GMAT_Quadratics_greater_root"),
    concept: "Algebraic Equations & Inequalities",
    difficulty: "easy",
    kind: "ps",
    stem: "If x is the greater root of x² − 10x + 16 = 0, what is x?",
    choices: ["2", "4", "6", "8", "10"],
    correctIndex: 3,
    explanation:
      "Using the quadratic formula, x = [10 ± √(100 − 64)] / 2 = [10 ± 6] / 2, giving roots 8 and 2. The greater root is 8.",
    badge: badge("Algebraic Equations & Inequalities"),
  },
  {
    id: qid("GMAT_Exponents_root_27_two_thirds"),
    concept: "Exponentials & Functions",
    difficulty: "easy",
    kind: "ps",
    stem: "What is the value of 27^{2/3}?",
    choices: ["3", "6", "9", "12", "27"],
    correctIndex: 2,
    explanation:
      "27^{2/3} = (27^{1/3})² = 3² = 9.",
    badge: badge("Exponentials & Functions"),
  },
  {
    id: qid("GMAT_Inequalities_abs_ineq_solution_set"),
    concept: "Algebraic Equations & Inequalities",
    difficulty: "medium",
    kind: "ps",
    stem: "Which of the following describes all real numbers x satisfying |2x − 5| < 7?",
    choices: [
      "x < −1 or x > 6",
      "−6 < x < 5",
      "−1 < x < 6",
      "x ≤ −1 or x ≥ 6",
      "−1 ≤ x ≤ 6",
    ],
    correctIndex: 2,
    explanation:
      "Solve −7 < 2x − 5 < 7 to get −2 < 2x < 12, hence −1 < x < 6. Only that interval satisfies the inequality.",
    badge: badge("Algebraic Equations & Inequalities"),
  },
  {
    id: qid("GMAT_WordProblems_store_purchase_mix"),
    concept: "Word Problems & Rates",
    difficulty: "easy",
    kind: "ps",
    stem:
      "A customer buys a total of 7 items consisting of notebooks that cost $4 each and pens that cost $2 each. If the total cost was $22, how many notebooks did the customer buy?",
    choices: ["2", "3", "4", "5", "6"],
    correctIndex: 2,
    explanation:
      "Let n be notebooks. Then 4n + 2(7 − n) = 22 ⇒ 4n + 14 − 2n = 22 ⇒ 2n = 8 ⇒ n = 4.",
    badge: badge("Word Problems & Rates"),
  },
  {
    id: qid("GMAT_Rates_work_three_machines"),
    concept: "Word Problems & Rates",
    difficulty: "medium",
    kind: "ps",
    stem:
      "Machine A can complete a job in 4 hours and Machine B in 6 hours. Working together with Machine C, they complete the job in 2 hours. How many hours would Machine C alone take to complete the job?",
    choices: ["3", "4", "6", "12", "18"],
    correctIndex: 3,
    explanation:
      "Rates add: 1/4 + 1/6 = 5/12 of the job per hour. All three together complete 1 job in 2 hours, so their combined rate is 1/2. Machine C’s rate is 1/2 − 5/12 = 1/12, so it would take 12 hours alone.",
    badge: badge("Word Problems & Rates"),
  },
  {
    id: qid("GMAT_UnitConversions_gallons_to_liters_per_hour"),
    concept: "Word Problems & Rates",
    difficulty: "medium",
    kind: "ps",
    stem:
      "A pump moves water at 45 gallons per minute. Approximately how many liters does it move in one hour? (1 gallon ≈ 3.8 liters)",
    choices: ["6,480", "8,550", "10,260", "11,400", "12,960"],
    correctIndex: 2,
    explanation:
      "Convert gallons to liters: 45 × 3.8 = 171 liters per minute. Over 60 minutes that is 171 × 60 = 10,260 liters.",
    badge: badge("Word Problems & Rates"),
  },
  {
    id: qid("GMAT_Ratios_Percent_class_boys_girls"),
    concept: "Number Properties & Arithmetic",
    difficulty: "easy",
    kind: "ps",
    stem:
      "In a class the ratio of boys to girls is 3 to 4. If there are 140 students in the class, how many are girls?",
    choices: ["45", "60", "75", "80", "90"],
    correctIndex: 3,
    explanation:
      "The ratio has 3 + 4 = 7 equal parts. Each part represents 140 ÷ 7 = 20 students. Girls correspond to 4 parts, so 4 × 20 = 80.",
    badge: badge("Number Properties & Arithmetic"),
  },
  {
    id: qid("GMAT_Statistics_find_missing_value"),
    concept: "Data Analysis & Sets",
    difficulty: "medium",
    kind: "ps",
    stem:
      "Six numbers 12, 15, 18, 21, 24, and x have an average (arithmetic mean) of 19.5. What is the value of x?",
    choices: ["25", "26", "27", "28", "30"],
    correctIndex: 2,
    explanation:
      "Average 19.5 over 6 numbers implies a total of 19.5 × 6 = 117. The known five sum to 90, so x = 117 − 90 = 27.",
    badge: badge("Data Analysis & Sets"),
  },
  {
    id: qid("GMAT_OverlappingSets_students_clubs"),
    concept: "Data Analysis & Sets",
    difficulty: "easy",
    kind: "ps",
    stem:
      "In a group of 50 students, 30 take math, 28 take science, and 12 take both. How many students take neither math nor science?",
    choices: ["2", "4", "6", "8", "10"],
    correctIndex: 1,
    explanation:
      "Use inclusion-exclusion: 30 + 28 − 12 = 46 students take at least one subject, so 50 − 46 = 4 take neither.",
    badge: badge("Data Analysis & Sets"),
  },
  {
    id: qid("GMAT_Combinatorics_arrange_LEVEL"),
    concept: "Counting & Probability",
    difficulty: "medium",
    kind: "ps",
    stem:
      "In how many distinct ways can the letters of the word LEVEL be arranged?",
    choices: ["12", "24", "30", "36", "60"],
    correctIndex: 2,
    explanation:
      "LEVEL has 5 letters with L repeated twice and E repeated twice. The number of arrangements is 5! / (2!·2!) = 120 / 4 = 30.",
    badge: badge("Counting & Probability"),
  },
  {
    id: qid("GMAT_Probability_two_draws_no_replacement"),
    concept: "Counting & Probability",
    difficulty: "medium",
    kind: "ps",
    stem:
      "A box contains 3 red balls, 4 blue balls, and 5 green balls. If two balls are drawn without replacement, what is the probability that the first is red and the second is blue?",
    choices: ["1/22", "1/18", "1/15", "1/11", "1/9"],
    correctIndex: 3,
    explanation:
      "Total balls = 12. Probability of red then blue is (3/12) × (4/11) = 12/132 = 1/11.",
    badge: badge("Counting & Probability"),
  },
  {
    id: qid("GMAT_Geometry_right_triangle_area"),
    concept: "Geometry & Coordinate Geometry",
    difficulty: "easy",
    kind: "ps",
    stem:
      "In a right triangle, the legs have lengths 6 and 8. What is the area of the triangle?",
    choices: ["18", "20", "22", "24", "26"],
    correctIndex: 3,
    explanation:
      "Area of a right triangle is 1/2 × leg₁ × leg₂ = 1/2 × 6 × 8 = 24.",
    badge: badge("Geometry & Coordinate Geometry"),
  },
  {
    id: qid("GMAT_Coordinate_geometry_find_slope"),
    concept: "Geometry & Coordinate Geometry",
    difficulty: "easy",
    kind: "ps",
    stem:
      "What is the slope of the line that passes through the points (2, −1) and (8, 5)?",
    choices: ["−1", "0", "1", "3/2", "2"],
    correctIndex: 2,
    explanation:
      "Slope = (5 − (−1)) / (8 − 2) = 6 / 6 = 1.",
    badge: badge("Geometry & Coordinate Geometry"),
  },
  {
    id: qid("GMAT_Sequences_arithmetic_10th_term"),
    concept: "Exponentials & Functions",
    difficulty: "easy",
    kind: "ps",
    stem:
      "An arithmetic sequence has first term 4 and common difference 3. What is the 10th term of the sequence?",
    choices: ["25", "28", "31", "34", "37"],
    correctIndex: 2,
    explanation:
      "Termₙ = a₁ + (n − 1)d = 4 + 9 × 3 = 31.",
    badge: badge("Exponentials & Functions"),
  },
  {
    id: qid("GMAT_Functions_composite_fg3"),
    concept: "Exponentials & Functions",
    difficulty: "easy",
    kind: "ps",
    stem: "If f(x) = 2x + 5 and g(x) = x² − 1, what is f(g(3))?",
    choices: ["15", "19", "21", "23", "27"],
    correctIndex: 2,
    explanation:
      "g(3) = 3² − 1 = 8. Then f(8) = 2·8 + 5 = 21.",
    badge: badge("Exponentials & Functions"),
  },
  {
    id: qid("GMAT_DS_NumberProperties_divisible_by_18"),
    concept: "Data Sufficiency — Algebra & Number",
    difficulty: "medium",
    kind: "ds",
    stem:
      "Is integer n divisible by 18?\nStatement (1): n is divisible by 9.\nStatement (2): n is divisible by 6.",
    choices: DS_STANDARD_CHOICES,
    correctIndex: 2,
    explanation:
      "18 requires factors 2·3². Statement (1) ensures 3² but says nothing about a factor of 2. Statement (2) ensures 2·3 but not the second factor of 3. Together they guarantee 2·3², so both statements together are sufficient, but neither alone is.",
    badge: badge("Data Sufficiency — Algebra & Number"),
  },
  {
    id: qid("GMAT_DS_Algebra_find_value_of_x"),
    concept: "Data Sufficiency — Algebra & Number",
    difficulty: "medium",
    kind: "ds",
    stem:
      "What is the value of x?\nStatement (1): 2x + 3 = 11.\nStatement (2): x² = 16.",
    choices: DS_STANDARD_CHOICES,
    correctIndex: 0,
    explanation:
      "Statement (1) gives x = 4 directly and is sufficient. Statement (2) allows x = 4 or x = −4, so it is not sufficient. Therefore only statement (1) alone is sufficient.",
    badge: badge("Data Sufficiency — Algebra & Number"),
  },
  {
    id: qid("GMAT_DS_Geometry_circle_radius"),
    concept: "Data Sufficiency — Geometry & Measurement",
    difficulty: "medium",
    kind: "ds",
    stem:
      "What is the radius of circle C?\nStatement (1): The circumference of circle C is 12π.\nStatement (2): The area of circle C is 36π.",
    choices: DS_STANDARD_CHOICES,
    correctIndex: 3,
    explanation:
      "From statement (1), C = 2πr = 12π ⇒ r = 6, so (1) is sufficient. From statement (2), A = πr² = 36π ⇒ r² = 36 ⇒ r = 6, so (2) is also sufficient. Each statement alone suffices.",
    badge: badge("Data Sufficiency — Geometry & Measurement"),
  },
  {
    id: qid("GMAT_DS_WordProblems_store_goal"),
    concept: "Data Sufficiency — Applications",
    difficulty: "medium",
    kind: "ds",
    stem:
      "Did a store meet its revenue goal of $5,000 last week?\nStatement (1): The store made $3,100 from Monday through Friday.\nStatement (2): The store's average daily revenue for the week was $760.",
    choices: DS_STANDARD_CHOICES,
    correctIndex: 1,
    explanation:
      "Statement (1) alone is insufficient; weekend revenue is unknown. Statement (2) implies total revenue of 7 × 760 = $5,320, so we can answer YES with certainty, making statement (2) sufficient alone. Statement (1) is not sufficient.",
    badge: badge("Data Sufficiency — Applications"),
  },
];

export function randomGmatQuestion(): GmatQuestion {
  if (!GMAT_QUESTIONS.length) {
    throw new Error("GMAT question bank is empty.");
  }
  const index = randomInt(GMAT_QUESTIONS.length);
  return GMAT_QUESTIONS[index]!;
}

export function pickRandomGmatQuant(concept?: GmatConcept | string): GmatQuestion {
  const canonical =
    typeof concept === "string"
      ? (concept as GmatConcept)
      : undefined;

  const source = (() => {
    if (canonical) {
      const filtered = GMAT_QUESTIONS.filter((q) => q.concept === canonical);
      if (filtered.length) return filtered;
    }
    return GMAT_QUESTIONS;
  })();

  if (!source.length) {
    return {
      id: "gmat-fallback",
      concept: "Number Properties & Arithmetic",
      difficulty: "easy",
      kind: "ps",
      stem: "Fallback: What is 2 + 2?",
      choices: ["3", "4", "5"],
      correctIndex: 1,
      explanation: "Basic check: 2 + 2 = 4.",
      badge: badge("Number Properties & Arithmetic"),
    };
  }

  const idx = (() => {
    if (source.length <= 1) return 0;
    try {
      return randomInt(source.length);
    } catch {
      return (Math.random() * source.length) | 0;
    }
  })();

  return source[idx];
}
