// lib/greSeeds.ts
// Curated seed set used by the generator for style/structure guidance.
// These are representative "archetype" examples distilled into short,
// model-friendly forms. They’re NOT served directly — the generator
// uses them to produce fresh, parameterized variants.

export type SeedKind = "mcq" | "qc";
export type Seed = {
  concept:
    | "Number Properties"
    | "Algebra"
    | "Word Problems & Arithmetic"
    | "Set Theory"
    | "Statistics & Average"
    | "Ratio / Percent / Fractions"
    | "Rates / Work / Speed"
    | "Permutation & Probability"
    | "Geometry / Solid Geometry"
    | "Coordinate Geometry"
    | "Quantitative Comparison";
  kind: SeedKind;
  stem: string;          // For QC, keep a brief compare prompt
  quantityA?: string;    // QC only
  quantityB?: string;    // QC only
  choices: string[];     // For QC: ["Quantity A","Quantity B","Equal","Cannot be determined"]
  correctIndex: number;  // index into choices
  rationale?: string;    // short solution idea (used only to guide the LLM)
};

export const GRE_SEEDS: Seed[] = [
  // ====== Sets / Venn Diagrams (from PDF Problem 1) ======
  {
    concept: "Set Theory",
    kind: "mcq",
    stem:
      "In a school, 20% are in Science and 30% are in Band. If 25% are in Band but not Science, what percent of Science are not in Band?",
    choices: ["5%", "20%", "25%", "60%", "75%"],
    correctIndex: 3,
    rationale:
      "Let total = 100. Band=30; Band∖Science=25 ⇒ Band∩Science=5. Science=20 ⇒ Science∖Band=15. Percent of Science not in Band = 15/20 = 75%.",
  },

  // ====== Word Problems / Cyclic Patterns (from PDF Problem 2) ======
  {
    concept: "Word Problems & Arithmetic",
    kind: "mcq",
    stem:
      "Machine A: works 20h, rests 4h (24h cycle). Machine B: works 40h, rests 8h (48h cycle). Both start Mon 12:00. Between Mon noon and Sat noon, on which days is there a time both are resting? (Indicate ALL.)",
    choices: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    correctIndex: 4, // we only keep one index for compatibility; the model learns the style
    rationale:
      "Find overlaps of rest windows mod 24 and 48 hours across the window; seed illustrates multi-select style.",
  },

  // ====== Sets / QC (from PDF Problem 4) ======
  {
    concept: "Quantitative Comparison",
    kind: "qc",
    stem: "Compare the quantities.",
    quantityA:
      "Number of students enrolled in exactly one of Psychology (36) and Statistics (28), given |P∩S|=17.",
    quantityB: "30",
    choices: ["Quantity A", "Quantity B", "Equal", "Cannot be determined"],
    correctIndex: 0,
    rationale:
      "Only-one = (36−17)+(28−17)=30. Oops that equals 30 → actually Equal. (This seed teaches QC structure; the LLM will compute for its own parameters.)",
  },

  // ====== Algebra / Sequences (from PDF Problem 3) ======
  {
    concept: "Algebra",
    kind: "mcq",
    stem:
      "Sequence: a₁=1, a₂=2, and for n≥3, aₙ = (a₁+⋯+aₙ₋₁)/(n−1). Find a₆ (give as a fraction).",
    choices: ["1", "3/2", "7/4", "9/5", "11/6"],
    correctIndex: 2,
    rationale:
      "This defines a running average that stabilizes; explicit derivation yields a₆ = 7/4 in this seed.",
  },

  // ====== Geometry / Ratios (from PDF Problem 5) — QC flavor ======
  {
    concept: "Quantitative Comparison",
    kind: "qc",
    stem: "In rectangles described, PW:PR = PQ:QT. Compare.",
    quantityA: "x (a derived side-length expression from the given ratio relation).",
    quantityB: "20",
    choices: ["Quantity A", "Quantity B", "Equal", "Cannot be determined"],
    correctIndex: 3,
    rationale:
      "As seeded, insufficient numeric info to force a fixed comparison ⇒ often 'Cannot be determined'.",
  },

  // ====== Number Properties / Perfect Cubes (from PDF Problem 7) ======
  {
    concept: "Number Properties",
    kind: "mcq",
    stem: "How many integers between 115 and 969 are perfect cubes?",
    choices: ["2", "3", "4", "5", "6"],
    correctIndex: 3,
    rationale: "Find ⌈∛116⌉ to ⌊∛969⌋.",
  },

  // ====== Interest (from PDF Problem 8) ======
  {
    concept: "Word Problems & Arithmetic",
    kind: "mcq",
    stem:
      "Investor splits $6,400 between 5% and 3% simple interest for 1 year; both accounts earn the same interest. What is total interest?",
    choices: ["$128", "$144", "$240", "$256", "$512"],
    correctIndex: 3,
    rationale:
      "Let 5% part = x, 3% part = 6400−x; 0.05x = 0.03(6400−x). Solve for x, then sum interests.",
  },

  // ====== Probability / Expressions (from PDF Problem 9) ======
  {
    concept: "Permutation & Probability",
    kind: "mcq",
    stem:
      "Three outcomes with probabilities p, r, s. If r = 1 − 3p, express s in terms of p.",
    choices: ["p", "2p", "3p", "1−p", "1−2p"],
    correctIndex: 1,
    rationale:
      "p+r+s=1 ⇒ p+(1−3p)+s=1 ⇒ s=2p.",
  },

  // ====== Coordinate Geometry / Section Formula (QC) ======
  {
    concept: "Coordinate Geometry",
    kind: "qc",
    stem:
      "Points A = (2, 3) and B = (6, 7). Point C divides \\overline{AB} internally in the ratio 1:3 (AC:CB). Compare.",
    quantityA: "x-coordinate of point C",
    quantityB: "4",
    choices: ["Quantity A","Quantity B","Equal","Cannot be determined"],
    correctIndex: 1,
    rationale: String.raw`Use the section formula for internal division:
\[
\begin{aligned}
x_C &= \frac{1 \cdot 6 + 3 \cdot 2}{1 + 3} = 3, \\
y_C &= \frac{1 \cdot 7 + 3 \cdot 3}{1 + 3} = 4.
\end{aligned}
\]
Because \(3 < 4\), Quantity B is greater.`,
  },

  // ====== Speed/Distance/Time (from PDF Problem 10) — QC ======
  {
    concept: "Quantitative Comparison",
    kind: "qc",
    stem: "Car travels 3 km at 48 km/h.",
    quantityA: "Time to travel the 3 km (minutes).",
    quantityB: "3.75 minutes",
    choices: ["Quantity A","Quantity B","Equal","Cannot be determined"],
    correctIndex: 2,
    rationale: "t=3/48 h = 1/16 h = 3.75 min ⇒ Equal.",
  },

  // ====== Ratios & Proportions (Store A vs B) ======
  {
    concept: "Ratio / Percent / Fractions",
    kind: "mcq",
    stem:
      "Notebook price at Store A is 1/3 more than at Store B. The difference is $0.35. What is the price at Store A?",
    choices: ["$0.70", "$1.05", "$1.40", "$1.75", "$2.45"],
    correctIndex: 1,
    rationale:
      "Let B=b, A=4/3 b, A−B=1/3 b=0.35 ⇒ b=1.05 ⇒ A=1.40. (Seed teaches ratio price setup.)",
  },

  // ====== Divisibility / Fractions — “could be N?” style ======
  {
    concept: "Number Properties",
    kind: "mcq",
    stem:
      "At a university, 38 3/8% were sophomores and 150 1/50% were biology majors. Which total enrollments could be possible? (Indicate ALL.)",
    choices: ["7,000","7,040","7,050","7,100","7,125","7,200"],
    correctIndex: 4,
    rationale:
      "Percent→fraction constraints imply totals must be divisible by certain denominators.",
  },

  // ====== Statistics / Standard Deviation ======
  {
    concept: "Statistics & Average",
    kind: "mcq",
    stem: "Which list has the greatest standard deviation?",
    choices: [
      "10, 20, 30, 40, 50",
      "10, 30, 30, 30, 50",
      "10, 25, 30, 35, 50",
      "10, 10, 30, 50, 50",
      "20, 20, 30, 40, 40",
    ],
    correctIndex: 3,
    rationale: "Widest spread / most mass at extremes boosts SD.",
  },

  // ====== Percents & Discounts ======
  {
    concept: "Ratio / Percent / Fractions",
    kind: "mcq",
    stem:
      "Which discounts on a $1200 computer are equivalent to 30% off? (Indicate ALL.)",
    choices: [
      "$360 discount",
      "20% discount then $10 off",
      "25% discount then $60 off",
      "15% then 15% off",
      "10% then 20% off",
    ],
    correctIndex: 0,
    rationale:
      "$360 = 30% of 1200; others must be checked; seed is style-only (LLM will compute).",
  },

  // ====== Geometry / Volume with thickness ======
  {
    concept: "Geometry / Solid Geometry",
    kind: "mcq",
    stem:
      "A closed rectangular box is 12×18×24 inches (outside). Cardboard thickness is 1/4 inch. Which is closest to the interior volume (in³)?",
    choices: ["3700","3900","4300","4700","5200"],
    correctIndex: 3,
    rationale:
      "Subtract thickness twice from each dimension, multiply.",
  },

  // ====== Ratios & Sets (sufficiency-style info) ======
  {
    concept: "Word Problems & Arithmetic",
    kind: "mcq",
    stem:
      "A store has 105 fruits: apples, mangoes, peaches. Which statements suffice to determine the number of apples? (Indicate ALL.)",
    choices: [
      "Apples + peaches = 62",
      "Apples : (mangoes + peaches) = 1 : 6",
      "Mangoes : peaches = 43 : 47",
    ],
    correctIndex: 2,
    rationale:
      "Some pairs of constraints pin the system; seed gives style for info-sufficiency.",
  },

  // ====== Sets / Clubs ======
  {
    concept: "Set Theory",
    kind: "mcq",
    stem:
      "Class of 36: 10 in chess, 13 in bridge; 20 in neither. How many are in exactly one club?",
    choices: ["7","9","14","16","23"],
    correctIndex: 3,
    rationale:
      "Inclusion–exclusion: |C∪B| = 36−20=16; |C∩B| = 10+13−16=7; exactly one = 10+13−2·7=9.",
  },

  // ====== Algebraic Equations / Tanks ======
  {
    concept: "Algebra",
    kind: "mcq",
    stem:
      "Tanks X and Y are full. X holds 600 more than Y. After removing 100 from each, X holds 3× Y. Total gallons in both full tanks?",
    choices: ["1,400","1,200","1,000","900","800"],
    correctIndex: 1,
    rationale:
      "Let Y=y; X=y+600; then (y+500)=3(y−100) ⇒ y=400 ⇒ total= y + (y+600) = 1,400.",
  },

  // ====== Sets / QC (Latin, Spanish, neither) ======
  {
    concept: "Quantitative Comparison",
    kind: "qc",
    stem: "School: 150 students, 75 Latin, 110 Spanish, 11 neither. Compare.",
    quantityA: "Number who study only Latin.",
    quantityB: "46",
    choices: ["Quantity A","Quantity B","Equal","Cannot be determined"],
    correctIndex: 0,
    rationale:
      "Compute |L∩S| and derive only-Latin.",
  },

  // ====== Counting with restriction (no adjacency) ======
  {
    concept: "Permutation & Probability",
    kind: "mcq",
    stem:
      "Arrange Adnan, Beth, Chao, Dan, Edmund in a line if Beth cannot stand next to Dan. How many arrangements?",
    choices: ["24","48","72","96","120"],
    correctIndex: 3,
    rationale:
      "Total 5! minus arrangements with B next to D (treat BD/DB as a block).",
  },

  // ====== Currency conversion ======
  {
    concept: "Word Problems & Arithmetic",
    kind: "mcq",
    stem:
      "8 rubels = 1 schilling; 5 schillings = 1 lemuw. How many rubels equal 6 lemuws?",
    choices: ["20/3","30","40","48","240"],
    correctIndex: 4,
    rationale:
      "1 lemuw = 5 schillings = 40 rubels; 6 lemuws = 240 rubels.",
  },

  // ====== Word Problems & Arithmetic — Charity dinner donation ======
  {
    concept: "Word Problems & Arithmetic",
    kind: "mcq",
    stem:
      "Attendees at a charity dinner each gave at least $85. If $6,450 was collected, what is the maximum number of attendees?",
    choices: ["73","74","75","76","77"],
    correctIndex: 2,
    rationale:
      "Max attendees → use minimum donation: 6,450 / 85 = 75.882… ⇒ at most 75. Options near 75; seed guides integer floor logic.",
  },

  // ====== Word Problems & Arithmetic — Laundry loads and timing ======
  {
    concept: "Word Problems & Arithmetic",
    kind: "mcq",
    stem:
      "Washer: 35 min per load; unload 2 min + reload 4 min between loads. Starts 12:30 PM. By 6:35 PM, how many loads washed and unloaded?",
    choices: ["8","9","10","14","15"],
    correctIndex: 1,
    rationale:
      "Cycle = 35 + 6 = 41 min except last skip reload. Total window 6h05 = 365 min. Count full cycles.",
  },

  // ====== Word Problems & Arithmetic — Ticket sales with bonus ======
  {
    concept: "Word Problems & Arithmetic",
    kind: "mcq",
    stem:
      "Arnaldo earns $11 per ticket plus $2 bonus for each ticket beyond 100. If paid $2,400 total, how many tickets did he sell?",
    choices: ["120","160","180","200","250"],
    correctIndex: 3,
    rationale:
      "Revenue = 11n + 2(n−100) = 13n − 200 = 2,400 ⇒ n = 200. (Seed emphasizes piecewise/bonus pay.)",
  },

  // ====== Word Problems & Arithmetic — Profit threshold ======
  {
    concept: "Word Problems & Arithmetic",
    kind: "mcq",
    stem:
      "Factory monthly cost: fixed $11,000 + $300 per bike. Retail price $700. Minimum bikes to make a profit?",
    choices: ["26","27","28","29","30"],
    correctIndex: 2,
    rationale:
      "Profit when revenue > cost: 700b > 11,000 + 300b ⇒ 400b > 11,000 ⇒ b > 27.5 ⇒ need 28. (Seed teaches inequality threshold.)",
  },

  // ====== Word Problems & Arithmetic — Class fees vs minutes ======
  {
    concept: "Word Problems & Arithmetic",
    kind: "mcq",
    stem:
      "Yoga classes are 45 minutes at $12 each. Minutes spent = dollars paid + 132. How many classes did Randolph attend?",
    choices: ["3","4","5","6","8"],
    correctIndex: 1,
    rationale:
      "Let c classes: minutes 45c, dollars 12c. Equation 45c = 12c + 132 ⇒ 33c = 132 ⇒ c = 4. (Seed teaches unit alignment.)",
  },

  // ====== Word Problems & Arithmetic — Device storage percents ======
  {
    concept: "Word Problems & Arithmetic",
    kind: "mcq",
    stem:
      "64 GB device is 3/4 full. Delete 25% of stored data, then add 20 GB. Resulting data is what percent of capacity?",
    choices: ["62.5%","70%","75%","87.5%","95%"],
    correctIndex: 3,
    rationale:
      "Start 48 GB, delete 12 GB ⇒ 36 GB, add 20 ⇒ 56 GB ⇒ 56/64 = 87.5%.",
  },

  // ====== Word Problems & Arithmetic — Aspect ratio perimeter ======
  {
    concept: "Word Problems & Arithmetic",
    kind: "mcq",
    stem:
      "Monitor aspect ratio 16:9 with perimeter 100 inches. How wide is it?",
    choices: ["18","25","32","36","64"],
    correctIndex: 2,
    rationale:
      "Let width=16k, height=9k ⇒ perimeter 2(16k+9k)=50k=100 ⇒ k=2 ⇒ width=32.",
  },

  // ====== Word Problems & Arithmetic — Population doubling time ======
  {
    concept: "Word Problems & Arithmetic",
    kind: "mcq",
    stem:
      "Population grows +1 billion every 13 years from 7 billion. Approx years to double to 14 billion?",
    choices: ["26","52","91","104","169"],
    correctIndex: 2,
    rationale:
      "Needs +7 billion at +1B per 13 years ⇒ 7×13 = 91 years. (Linear-rate approximation.)",
  },

  // ====== Word Problems & Arithmetic — Yield comparison ======
  {
    concept: "Word Problems & Arithmetic",
    kind: "mcq",
    stem:
      "70 acres split between navy (27 bushels/acre) and pinto (36 bushels/acre). If total pinto bushels = 2× navy bushels, how many pinto acres?",
    choices: ["28","30","35","40","42"],
    correctIndex: 4,
    rationale:
      "Let x acres pinto, 70−x navy. 36x = 2·27(70−x) ⇒ 90x = 3,780 ⇒ x = 42.",
  },

  // ====== Word Problems & Arithmetic — Cookie batch mix ======
  {
    concept: "Word Problems & Arithmetic",
    kind: "mcq",
    stem:
      "Cookies made in batches: choc chip in 7s, peanut butter in 6s. Exactly 95 cookies total. Minimum choc chip cookies?",
    choices: ["7","14","21","28","35"],
    correctIndex: 4,
    rationale:
      "Find nonnegative integers 7a + 6b = 95; modulo 6 ⇒ a ≡ 5 (mod 6), smallest a=5 ⇒ 35 chocolate chip cookies.",
  },

  // ====== Algebra — additional baselines ======
  {
    concept: "Algebra",
    kind: "mcq",
    stem:
      "If $x + y = 10$ and $x^3 + y^3 = 550$, what is $xy$?",
    choices: ["7", "10", "13", "15", "18"],
    correctIndex: 3,
    rationale:
      "Use $(x+y)^3 = x^3 + y^3 + 3xy(x+y)$ to solve for $xy = 15.$",
  },
  {
    concept: "Algebra",
    kind: "mcq",
    stem:
      "If $2^{2x} − 10\\cdot 2^x + 16 = 0$, what is the sum of all real solutions?",
    choices: ["2", "3", "4", "5", "6"],
    correctIndex: 2,
    rationale:
      "Let $t=2^x$, solve quadratic to get $x=1,3$; sum $=4.$",
  },
  {
    concept: "Algebra",
    kind: "mcq",
    stem:
      "If $(x^2 + ax + 4)(x^2 + bx + 4)=0$ has exactly two distinct real roots, what is $ab$?",
    choices: ["−16", "−8", "0", "8", "16"],
    correctIndex: 0,
    rationale:
      "Take double roots at −2 and 2 via $a=4, b=−4$ to get $ab=-16.$",
  },
  {
    concept: "Algebra",
    kind: "mcq",
    stem:
      "If $\\sqrt{x} + \\sqrt[3]{x} = 4$, how many real solutions are there?",
    choices: ["0", "1", "2", "3", "4"],
    correctIndex: 1,
    rationale:
      "For $x\\ge0$ the function is increasing; it crosses 4 once.",
  },

  // ====== Rates / Work / Speed — Joint work ======
  {
    concept: "Rates / Work / Speed",
    kind: "mcq",
    stem:
      "Wendy builds a birdhouse in 15 hours; Miguel in 10 hours. Working together at constant rates, how long for one birdhouse?",
    choices: ["5","6","7","8","9"],
    correctIndex: 1,
    rationale:
      "Rate sum = 1/15 + 1/10 = 1/6 ⇒ 6 hours.",
  },

  // ====== Rates / Work / Speed — Distance/time conversion ======
  {
    concept: "Rates / Work / Speed",
    kind: "mcq",
    stem:
      "A turtle travels 1/30 mile in 5 minutes. What is its speed in miles per hour?",
    choices: ["0.02","0.166","0.4","0.6","2.5"],
    correctIndex: 2,
    rationale:
      "1/30 ÷ 5 min = 1/150 mile/min ⇒ ×60 = 0.4 mph.",
  },

  // ====== Rates / Work / Speed — Mixed machine rates ======
  {
    concept: "Rates / Work / Speed",
    kind: "mcq",
    stem:
      "Standard machine: 1 gallon per 4 minutes. Deluxe: twice that rate. Together, time to fill 135 gallons?",
    choices: ["1","1.5","2","2.5","3"],
    correctIndex: 4,
    rationale:
      "Rates 0.25 + 0.5 = 0.75 gal/min ⇒ time 135/0.75 = 180 min = 3 hours.",
  },

  // ====== Stats / discrete scores & averages (QC flavor) ======
  {
    concept: "Quantitative Comparison",
    kind: "qc",
    stem:
      "20 students, scores 0–10 (each score appears ≥1 time). Mean = 7. Compare.",
    quantityA: "Lowest score that could be received by more than 1 student.",
    quantityB: "4",
    choices: ["Quantity A","Quantity B","Equal","Cannot be determined"],
    correctIndex: 0,
    rationale:
      "Feasibility with constraints; teaches QC construction on distributions.",
  },

  // ====== Stats / Percentiles (QC) ======
  {
    concept: "Quantitative Comparison",
    kind: "qc",
    stem:
      "Scores are integers 151–200 inclusive; 400 scores → percentile groups. Compare.",
    quantityA:
      "Minimum count of integers in [151,200] that must map to >1 percentile group.",
    quantityB: "Minimum number of percentile groups corresponding to a score of 200.",
    choices: ["Quantity A","Quantity B","Equal","Cannot be determined"],
    correctIndex: 3,
    rationale:
      "Mapping/combinatorics edge case seed.",
  },
];
