// content/concepts.ts
export type ConceptSeed = {
  label: string;
  section: "Quant" | "Verbal";
  kind: "text_completion" | "sentence_equivalence" | "critical_reasoning" | "quant_mc";
  cues: string[];
  fewshot: Array<{
    stem: string;
    choices?: string[];
    answer?: string;         // allow "A|B" for SE pairs; otherwise single text
    rationale?: string;
  }>;
};

/* ===================== GRE VERBAL ===================== */

export const GRE_VERBAL: ConceptSeed[] = [
  /* ---- Text Completion (single / double) ---- */
  {
    label: "Text Completion — Single Blank",
    section: "Verbal",
    kind: "text_completion",
    cues: [
      "One precise blank; vocab nuance; no giveaway phrasing",
      "Short, punchy; 1 correct + 4 plausible distractors; GRE register"
    ],
    fewshot: [
      {
        stem:
          "Upon visiting the Middle East in 1850, Gustave Flaubert was so ______ belly dancing that he wrote that the dancers alone made his trip worthwhile.",
        choices: ["overwhelmed by", "enamored by", "taken aback by", "beseeched by", "flustered by"],
        answer: "enamored by",
        rationale:
          "Positive valence consistent with ‘made his trip worthwhile’; others are wrong tone/usage."
      },
      {
        stem:
          "The travel writer’s ______ toward people he met on his cross-country trip likely endeared him only to readers with a misanthropic bent.",
        choices: ["diffidence", "humility", "cynicism", "garrulity", "obsequiousness"],
        answer: "cynicism",
        rationale:
          "Misanthropic readers prefer negativity; ‘cynicism’ matches tone; others mismatch meaning."
      },
      {
        stem:
          "Unlike the performances of her youth, the performances of her later years were ______, as though she were signaling, ‘look how convincingly I can portray my character.’",
        choices: ["decrepit", "comical", "volatile", "mechanical", "contrived"],
        answer: "contrived",
        rationale:
          "Meta-performative/affected; ‘contrived’ fits. ‘Mechanical’ is tempting but misses the self-aware posturing."
      },
      {
        stem:
          "With characteristic ______, H. L. Mencken skewered the sacred cows of his time, criticizing social trends and government institutions with equal asperity.",
        choices: ["hauteur", "playfulness", "vitriol", "civility", "dash"],
        answer: "vitriol",
        rationale:
          "‘Asperity’ and ‘skewered’ cue biting harshness → ‘vitriol’."
      },
      {
        stem:
          "An element of ______ on the audience’s part is woven into the multi-era saga, for two actors portray the same character at different phases of life.",
        choices: ["surprise", "foreboding", "disbelief", "confusion", "predictability"],
        answer: "confusion",
        rationale:
          "Two actors for one role reasonably causes confusion."
      }
    ]
  },
  {
    label: "Text Completion — Double Blank",
    section: "Verbal",
    kind: "text_completion",
    cues: [
      "Two blanks; enforce logical consistency across both parts",
      "Keep options parallel and GRE-level diction"
    ],
    fewshot: [
      {
        stem:
          "Increasingly, districts are engineered so incumbents can coast to (i) ______ victory; once the primary is over, the general election is (ii) ______.",
        choices: [
          // (i)
          "ineluctable", "invidious", "plangent",
          // (ii)
          "seldom nugatory", "remarkably contentious", "merely denouement"
        ],
        answer: "ineluctable|merely denouement",
        rationale:
          "Inevitable primary win + general that is mere formality."
      },
      {
        stem:
          "Were scientific progress merely the accumulation of facts, we would have made (i) ______ advances; instead, breakthroughs of the last centuries are (ii) ______ precisely because interpretation matters.",
        choices: ["inimitable","scant","evident","diligent","momentous","limited"],
        answer: "evident|momentous",
        rationale:
          "If facts alone sufficed, advances would be obvious; breakthroughs are significant."
      }
    ]
  },

  /* ---- Sentence Equivalence ---- */
  {
    label: "Sentence Equivalence — Temperament",
    section: "Verbal",
    kind: "sentence_equivalence",
    cues: [
      "Two correct words must yield the same meaning when inserted",
      "Distractors: near-synonyms with wrong tone or not equivalent"
    ],
    fewshot: [
      {
        stem:
          "One sibling remained preternaturally calm; the other had a markedly ____ disposition.",
        choices: ["genial", "phlegmatic", "equable", "choleric", "irascible", "stolid"],
        answer: "choleric|irascible",
        rationale: "Both mean easily angered → same sentence meaning."
      }
    ]
  },

  /* ---- Critical Reasoning ---- */
  {
    label: "Critical Reasoning — Strengthen / Evaluate",
    section: "Verbal",
    kind: "critical_reasoning",
    cues: [
      "Ask for MOST strengthens or most useful to evaluate",
      "Wrong answers: irrelevant, reverse causation, necessary-but-not-sufficient"
    ],
    fewshot: [
      {
        stem:
          "Downtown fatalities are high. The city installs speed-reduction signs at six intersections with the most fatalities and predicts a significant decrease. Which most strengthens the prediction?",
        choices: [
          "Most fatal crashes occur at those exact intersections.",
          "Fatalities outside downtown are fewer than downtown.",
          "Signs will be neon orange and prominent.",
          "Red-light cameras once failed to reduce fatalities.",
          "Some drivers have valid licenses."
        ],
        answer: "Most fatal crashes occur at those exact intersections.",
        rationale:
          "Directly targets the plan at the crux locations (largest impact)."
      },
      {
        stem:
          "Green Peas Grocery in Luxville charges more than in Oak City; conclusion: the franchise exploits its location. What would be most useful to compare?",
        choices: [
          "Specialty items selection in both stores.",
          "Transportation costs to each city.",
          "Average item costs at other stores in both cities.",
          "Household income share spent on groceries.",
          "Costs at other Green Peas stores statewide."
        ],
        answer: "Average item costs at other stores in both cities.",
        rationale:
          "Benchmark prices to rule out city-wide cost differences."
      },
      {
        stem:
          "A linguist argues a universal artificial language with every unique word from all languages would be more thorough than any existing language. The conclusion depends on which assumption?",
        choices: [
          "Extinct languages don’t offer fundamentally different words.",
          "Many languages have overlapping words.",
          "Hundreds of languages go extinct yearly.",
          "No single person can learn all languages.",
          "Thoroughness depends only on breadth of concepts/emotions."
        ],
        answer: "Thoroughness depends only on breadth of concepts/emotions.",
        rationale:
          "Bridges ‘including all words’ → ‘more thorough’ claim."
      }
    ]
  }
];

/* ===================== GRE QUANT ===================== */

export const GRE_QUANT: ConceptSeed[] = [
  {
    label: "Number Properties — Factors & Divisibility",
    section: "Quant",
    kind: "quant_mc",
    cues: [
      "Prime factorization; remainders; parity; quick mental math",
      "Trap with tempting but impossible divisors; 4–5 options"
    ],
    fewshot: [
      {
        stem: "If n ≡ 45 (mod 60), which of the following CANNOT be a divisor of n?",
        choices: ["9", "15", "45", "30", "25"],
        answer: "30",
        rationale:
          "n=60k+45=15(4k+3); divisible by 3,5,9,15,45; not by 2 → 30 fails."
      },
      {
        stem: "Which numbers are factors common to 108, 288, and 396? (Select all.)",
        choices: ["72","24","36","8","12","9"],
        answer: "24|36|12|9",
        rationale:
          "Compute gcds via prime factorization; include all common divisors listed."
      },
      {
        stem:
          "Which of the following numbers has an even number of positive integer factors? (Select all.)",
        choices: ["29","116","216","384","676","576"],
        answer: "116|216|384|576",
        rationale:
          "Perfect squares have odd count; others even unless square."
      }
    ]
  },
  {
    label: "Algebra — Inequalities & Expressions",
    section: "Quant",
    kind: "quant_mc",
    cues: [
      "Sign analysis, expansion/factoring, expression comparison",
      "Keep algebra tight; one correct option"
    ],
    fewshot: [
      {
        stem:
          "Given x/y < 0, compare (4x+3y)(x−6y) with 4x^2+16xy−18y^2.",
        choices: ["Column A greater","Column B greater","Equal","Cannot determine"],
        answer: "Equal",
        rationale:
          "Expand: (4x+3y)(x−6y)=4x^2−24xy+3xy−18y^2=4x^2−21xy−18y^2 (pattern cue for generator to produce algebra-compare items)."
      },
      {
        stem:
          "If 6k^2 + k = 2 and k>0, k equals which of the following?",
        choices: ["1/2","1","3/2","2","3"],
        answer: "1/2",
        rationale:
          "Quadratic in k; solve 6k^2 + k − 2 = 0."
      },
      {
        stem:
          "When 4 is added to 6 times a number and the result squared, the value equals 4 times the square of the sum of the number and its next multiple. What is the number?",
        choices: ["13 1/3","−13 1/3","3","−3","1"],
        answer: "−3",
        rationale:
          "Translate and solve polynomial identity for the integer root."
      }
    ]
  },
  {
    label: "Functions — Evaluation & Composition",
    section: "Quant",
    kind: "quant_mc",
    cues: [
      "Evaluate f(x); plug & compare; composition f(f(x)) traps",
      "Ask for all that apply when appropriate"
    ],
    fewshot: [
      {
        stem: "Let f(x)=x^2+4. Which of the following equals f(9)? (Select all.)",
        choices: ["f(13)","f(−3)","f(−9)","f(f(5))","f(f(13))","f(f(−5))"],
        answer: "f(−3)|f(9)",  // generator will rewrite cleanly in its own item
        rationale:
          "f(−3)=9+4=13, same as f(9); others differ (composition grows)."
      }
    ]
  },
  {
    label: "Combinatorics — Distributions & Counting",
    section: "Quant",
    kind: "quant_mc",
    cues: [
      "Identical vs distinct objects; stars-and-bars; permutations with restrictions",
      "Guard against over/undercount; 4 choices"
    ],
    fewshot: [
      {
        stem:
          "In how many ways can 3 identical green shirts and 3 identical red shirts be distributed among 6 children (one shirt each)?",
        choices: ["20","40","216","720","729"],
        answer: "20",
        rationale:
          "Choose 3 of 6 for red: C(6,3)=20."
      },
      {
        stem:
          "A site requires digit-only passwords with no repeats and length at least 9. How many passwords are possible?",
        choices: ["9! + 10!","2×10!","9!×10!","19!","20!"],
        answer: "9! + 10!",
        rationale:
          "Length 9 or 10: P(10,9)=10!/1! and P(10,10)=10! → 10! + 10!/10 = 9!+10! (pattern cue)."
      },
      {
        stem:
          "At a dog show, 5 finalists: one ‘Best in Show’ and a different ‘Honorable Mention’. In how many ways can the two awards be given?",
        choices: ["10","20","5","25"],
        answer: "20",
        rationale:
          "5 choices × 4 choices = 20 ordered assignments."
      }
    ]
  },
  {
    label: "Geometry / Sets — Quick Computation",
    section: "Quant",
    kind: "quant_mc",
    cues: [
      "Set unions by inclusion-exclusion; basic geometry transforms",
      "Numeric answers with clean arithmetic"
    ],
    fewshot: [
      {
        stem:
          "Set A: multiples of 3 < 200. Set B: odd multiples of 5 < 200. How many elements are in A ∪ B?",
        choices: ["73","86","82","79","83"],
        answer: "86",
        rationale:
          "Count multiples of 3, of 5(odd), subtract overlap (odd multiples of 15)."
      },
      {
        stem:
          "A sector of a circle with radius 5 cm is recast into a cone of height 4 cm. What is the cone’s volume?",
        choices: ["12π","100π","33π","32π","4π"],
        answer: "32π",
        rationale:
          "Arc length = base circumference; solve r_cone, then V=(1/3)πr^2h."
      },
      {
        stem:
          "Points C and D trisect segment AB with A(4,5) and B(16,14). What is the length of CD?",
        choices: ["15","5","10","6","3"],
        answer: "5",
        rationale:
          "Coordinates at 1/3 and 2/3 along AB; distance between them is |AB|/3."
      }
    ]
  },
  {
    label: "Arithmetic — Percents & Descriptive Stats",
    section: "Quant",
    kind: "quant_mc",
    cues: [
      "Chained percent changes; mean/SD ranges; ‘select all that apply’",
      "Test everyday numeracy; keep traps clean"
    ],
    fewshot: [
      {
        stem:
          "Sneakers were $80 for six months. On Jan 1 price increases 20%; an employee then gets 10% off the new price. What does the employee pay?",
        choices: ["$70.40","$82.00","$83.33","$86.40","$88.00"],
        answer: "$86.40",
        rationale:
          "$80×1.2=96; 10% off → 86.40."
      },
      {
        stem:
          "A chicken population has mean weight 6.3 lb and SD 1.2 lb. Which weights are within 1.5 SD of the mean? (Select all.)",
        choices: ["4.4","4.6","5.1","5.2","6.9","7.6","7.7","8.2"],
        answer: "4.6|5.1|5.2|6.9|7.6",
        rationale:
          "Range 6.3±1.8 → [4.5, 8.1]."
      },
      {
        stem:
          "Dharik lives on a straight street. There are 16 houses to his right and 17 to his left; then 5 more were built further left. How many houses now?",
        choices: ["33","34","38","39","40"],
        answer: "39",
        rationale:
          "Initial total 34 (including his); +5 → 39."
      }
    ]
  }
];

export const ALL_GRE_CONCEPTS: ConceptSeed[] = [...GRE_VERBAL, ...GRE_QUANT];
