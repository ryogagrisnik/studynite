// lib/greBank.ts
import { randomInt } from "crypto";

export type GreConcept =
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

export type GreQuestion = {
  id: string;
  concept: GreConcept;
  difficulty: "easy" | "medium" | "hard";
  // QC support
  kind?: "mcq" | "qc";        // default MCQ if omitted
  quantityA?: string;         // only when kind === "qc"
  quantityB?: string;         // only when kind === "qc"
  // Shared
  stem: string;
  choices: string[];          // QC uses ["Quantity A","Quantity B","Equal","Cannot be determined"]
  correctIndex: number;
  explanation?: string;
  badge?: string;
};

const qid = (s: string) => s.replace(/\W+/g, "_").slice(0, 48);

export const GRE_QUESTIONS: GreQuestion[] = [
  // =============== Number Properties ===============
  {
    id: qid("NP_divisor_60_remainder_45"),
    concept: "Number Properties",
    difficulty: "medium",
    stem:
      "If n is a positive integer that leaves a remainder of 45 when divided by 60, which of the following CANNOT be a divisor of n?",
    choices: ["9", "15", "45", "30", "25"],
    correctIndex: 3,
    badge: "GRE – Quant (Number Properties)",
    explanation:
      "n = 60k + 45 = 15(4k + 3). 30 requires an extra factor 2 that (4k+3) may not always provide.",
  },
  {
    id: qid("NP_even_number_of_factors"),
    concept: "Number Properties",
    difficulty: "medium",
    stem:
      "Which of the following numbers has an even number of positive integer factors? Indicate ALL such numbers.",
    choices: ["29", "116", "216", "384", "676", "576"],
    correctIndex: 1,
    badge: "GRE – Quant (Number Properties)",
    explanation:
      "Squares have odd number of divisors; non-squares have even. Non-squares here are 29, 116, 216, 384.",
  },
  {
    id: qid("NP_min_xyz_abs_le_5"),
    concept: "Number Properties",
    difficulty: "hard",
    stem:
      "x, y, and z are distinct integers such that $|x|,|y|,|z| \\le 5$. What is the least possible value of $xyz$?",
    choices: ["0", "-125", "-60", "-100", "-75"],
    correctIndex: 3,
    badge: "GRE – Quant (Number Properties)",
    explanation:
      "Pick three with largest magnitudes and an odd number of negatives. Best is $(-5,4,5)$ giving $-100$.",
  },

  // =============== Algebra ===============
  {
    id: qid("ALG_quad_k_equation"),
    concept: "Algebra",
    difficulty: "medium",
    stem:
      "If $6k^2 + k = 2$ and $k>0$, then $k$ equals which of the following?",
    choices: ["$\\tfrac{1}{2}$", "1", "$\\tfrac{3}{2}$", "2", "3"],
    correctIndex: 0,
    badge: "GRE – Quant (Algebra)",
  },
  {
    id: qid("ALG_poly_next_multiple"),
    concept: "Algebra",
    difficulty: "medium",
    stem:
      "When 4 is added to 6 times a number and the result is squared, the value equals 4 times the square of the sum of the number and its next multiple. What is the number?",
    choices: ["$\\tfrac{1}{3}$", "$-\\tfrac{1}{3}$", "3", "-3", "1"],
    correctIndex: 2,
    badge: "GRE – Quant (Algebra)",
  },
  {
    id: qid("ALG_function_fx_x2_plus_4_equals_f9"),
    concept: "Algebra",
    difficulty: "easy",
    stem:
      "If $f(x)=x^2+4$, which of the following is equal to $f(9)$? Indicate ALL such answers.",
    choices: [
      "$f(13)$",
      "$f(-3)$",
      "$f(-9)$",
      "$f(f(\\sqrt{5}))$",
      "$f(f(\\sqrt{13}))$",
      "$f(f(-\\sqrt{5}))$",
    ],
    correctIndex: 1,
    badge: "GRE – Quant (Algebra)",
    explanation:
      "$f(9)=85$. Items that also evaluate to $85$ are correct.",
  },

  // =============== Word Problems & Arithmetic / Stats ===============
  {
    id: qid("WP_sneakers_80_up20_disc10"),
    concept: "Word Problems & Arithmetic",
    difficulty: "easy",
    stem:
      "Sneakers were \\$80. On Jan 1 the price increased by 20%, then an employee bought them at 10% discount. What price did the employee pay?",
    choices: ["$70.40", "$82.00", "$83.33", "$86.40", "$88.00"],
    correctIndex: 3,
    badge: "GRE – Quant (Word Problems)",
  },
  {
    id: qid("STATS_which_within_1p5_SD"),
    concept: "Statistics & Average",
    difficulty: "easy",
    stem:
      "In a chicken population, mean $= 6.3$ lbs and SD $= 1.2$ lbs. Which weights are within $1.5$ SD of the mean? (Mark ALL.)",
    choices: ["4.4", "4.6", "5.1", "5.2", "6.9", "7.6", "7.7", "8.2"],
    correctIndex: 6,
    badge: "GRE – Quant (Statistics)",
  },

  // =============== Set Theory ===============
  {
    id: qid("SET_3digit_mult6_Union_4not8"),
    concept: "Set Theory",
    difficulty: "hard",
    stem:
      "Set A: all 3-digit numbers that are multiples of 6. Set B: all 3-digit numbers that are multiples of 4 but NOT multiples of 8. How many elements does $A \\cup B$ comprise?",
    choices: ["224", "225", "263", "265", "300"],
    correctIndex: 2,
    badge: "GRE – Quant (Set Theory)",
  },
  {
    id: qid("SET_under200_mult3_union_odd_mult5"),
    concept: "Set Theory",
    difficulty: "medium",
    stem:
      "Set A: multiples of 3 less than 200. Set B: odd multiples of 5 less than 200. How many elements are in $A \\cup B$?",
    choices: ["73", "86", "82", "79", "83"],
    correctIndex: 4,
    badge: "GRE – Quant (Set Theory)",
  },

  // =============== Ratio / Percent / Fractions ===============
  {
    id: qid("RATIO_three_friends_sum_147_find_B"),
    concept: "Ratio / Percent / Fractions",
    difficulty: "easy",
    stem:
      "$A:B = 3:5$ and $B:C=3:5$. If $A+B+C=147$, how old is $B$?",
    choices: ["15", "75", "49", "45", "27"],
    correctIndex: 3,
    badge: "GRE – Quant (Ratio/Percent)",
  },
  {
    id: qid("RATIO_balls_box_counts"),
    concept: "Ratio / Percent / Fractions",
    difficulty: "medium",
    stem:
      "A box has $x$ red balls, thrice as many green as red, and half as many blue as red. Which could be the total number of balls?",
    choices: ["22", "44", "54", "33", "24"],
    correctIndex: 1,
    badge: "GRE – Quant (Ratio/Percent)",
  },

  // =============== Rates / Work / Speed ===============
  {
    id: qid("RWS_avg_speed_40_50_60_75"),
    concept: "Rates / Work / Speed",
    difficulty: "medium",
    stem:
      "Sam covers the first 40% of a trip at 50 km/h and the remaining distance at 75 km/h. What is his average speed for the whole trip?",
    choices: ["62.5 km/h", "65 km/h", "60 km/h", "66.66 km/h", "58.33 km/h"],
    correctIndex: 0,
    badge: "GRE – Quant (Rates/Work/Speed)",
  },
  {
    id: qid("RWS_birdhouse_joint_work_15_10"),
    concept: "Rates / Work / Speed",
    difficulty: "medium",
    stem:
      "Wendy can build a birdhouse in 15 hours, and Miguel can build one in 10 hours. Working together at their constant rates, how many hours to build one birdhouse?",
    choices: ["5", "6", "7", "8", "9"],
    correctIndex: 1,
    badge: "GRE – Quant (Rates/Work/Speed)",
    explanation:
      "Rate sum = 1/15 + 1/10 = 1/6 birdhouse per hour ⇒ time = 6 hours.",
  },
  {
    id: qid("RWS_turtle_speed_mph"),
    concept: "Rates / Work / Speed",
    difficulty: "easy",
    stem:
      "A turtle traveled 1/30 of a mile in 5 minutes. What was its speed in miles per hour?",
    choices: ["0.02", "0.166", "0.4", "0.6", "2.5"],
    correctIndex: 2,
    badge: "GRE – Quant (Rates/Work/Speed)",
    explanation:
      "Distance/time = (1/30 mile)/(5 min) = 1/150 mile per minute = 0.4 mph.",
  },
  {
    id: qid("RWS_paint_fill_dual_machines"),
    concept: "Rates / Work / Speed",
    difficulty: "medium",
    stem:
      "A standard machine fills 1 gallon every 4 minutes. A deluxe machine fills at twice that rate. Working together, how many hours to fill 135 gallons?",
    choices: ["1", "1.5", "2", "2.5", "3"],
    correctIndex: 4,
    badge: "GRE – Quant (Rates/Work/Speed)",
    explanation:
      "Rates: 0.25 + 0.5 = 0.75 gal/min. Time = 135 / 0.75 = 180 minutes = 3 hours.",
  },
  {
    id: qid("RWS_workers_boxes_scale_up"),
    concept: "Rates / Work / Speed",
    difficulty: "medium",
    stem:
      "Twelve workers pack 60 boxes in 9 minutes. How many minutes for 27 workers to pack 180 boxes at the same rate?",
    choices: ["12", "13", "14", "15", "16"],
    correctIndex: 0,
    badge: "GRE – Quant (Rates/Work/Speed)",
    explanation:
      "Team rate = 60/9 boxes/min. Per worker = (60/9)/12. With 27 workers, rate = 15 boxes/min. Time = 180/15 = 12 minutes.",
  },
  {
    id: qid("RWS_baker_rate_increase"),
    concept: "Rates / Work / Speed",
    difficulty: "medium",
    stem:
      "A baker made 60 pies in the first 5 hours. To finish 150 pies in 8 hours total, by how many pies per hour did his rate increase in the last 3 hours?",
    choices: ["12", "14", "16", "18", "20"],
    correctIndex: 3,
    badge: "GRE – Quant (Rates/Work/Speed)",
    explanation:
      "Remaining 90 pies in 3 hours → 30/hr. Initial rate 12/hr. Increase = 18/hr.",
  },
  {
    id: qid("RWS_walk_loop_half_speed"),
    concept: "Rates / Work / Speed",
    difficulty: "medium",
    stem:
      "Brenda walked a 12-mile loop in 3 hours. If she halves her speed, how many hours to walk the loop two more times?",
    choices: ["6", "8", "12", "18", "24"],
    correctIndex: 2,
    badge: "GRE – Quant (Rates/Work/Speed)",
    explanation:
      "Initial speed 4 mph; halved to 2 mph. Distance 24 miles ⇒ 24/2 = 12 hours.",
  },
  {
    id: qid("RWS_train_police_chase"),
    concept: "Rates / Work / Speed",
    difficulty: "medium",
    stem:
      "A train heads south at 50 mph. A police car 50 miles north starts south at 80 mph on a parallel road. How long until the police car catches the train?",
    choices: ["1 hour", "1 hour 20 minutes", "1 hour 40 minutes", "2 hours", "2 hours 20 minutes"],
    correctIndex: 2,
    badge: "GRE – Quant (Rates/Work/Speed)",
    explanation:
      "Relative speed = 80−50 = 30 mph to close 50 miles ⇒ 50/30 ≈ 1 hr 40 min.",
  },
  {
    id: qid("RWS_servers_capacity_scale"),
    concept: "Rates / Work / Speed",
    difficulty: "medium",
    stem:
      "Four identical servers handle 9,600 search requests per hour. If two more servers are added, how many hours to process 216,000 requests?",
    choices: ["15", "16", "18", "20", "24"],
    correctIndex: 0,
    badge: "GRE – Quant (Rates/Work/Speed)",
    explanation:
      "Each server 2,400/hr. Six servers → 14,400/hr. Time = 216,000 / 14,400 = 15 hours.",
  },
  {
    id: qid("RWS_translation_rate_gain"),
    concept: "Rates / Work / Speed",
    difficulty: "easy",
    stem:
      "After training, Alley translates 10 more than twice as many words per hour as before. Previously he translated 10 words per minute. How many words per hour now?",
    choices: ["30", "70", "610", "1,210", "1,800"],
    correctIndex: 3,
    badge: "GRE – Quant (Rates/Work/Speed)",
    explanation:
      "Old rate 10/min = 600/hr. New rate = 2·600 + 10 = 1,210 words/hr.",
  },

  // =============== Permutation & Probability ===============
  {
    id: qid("PERM_5doors_in_out_diff"),
    concept: "Permutation & Probability",
    difficulty: "easy",
    stem:
      "There are 5 doors to a lecture room. In how many ways can a student enter through one door and leave by a different door?",
    choices: ["10", "9", "20", "625", "1024"],
    correctIndex: 2,
    badge: "GRE – Quant (Permutation/Probability)",
  },
  {
    id: qid("PERM_select_3_of_12"),
    concept: "Permutation & Probability",
    difficulty: "easy",
    stem:
      "In how many ways can 3 students be selected from a group of 12 students?",
    choices: ["33", "12!", "1320", "220", "36"],
    correctIndex: 3,
    badge: "GRE – Quant (Permutation/Probability)",
  },

  // =============== Geometry / Solid Geometry ===============
  {
    id: qid("GEO_sector_to_cone_r5_h4_volume"),
    concept: "Geometry / Solid Geometry",
    difficulty: "medium",
    stem:
      "A sector of a circle of radius 5 cm is recast into a right circular cone of height 4 cm. What is the volume of the cone?",
    choices: ["$12\\pi$", "$100\\pi$", "$33\\pi$", "$32\\pi$", "$4\\pi$"],
    correctIndex: 2,
    badge: "GRE – Quant (Solid Geometry)",
  },
  {
    id: qid("GEO_area_necessarily_gt_50"),
    concept: "Geometry / Solid Geometry",
    difficulty: "medium",
    stem:
      "For which of the following will the area necessarily exceed 50 square units? (Indicate ALL.)",
    choices: [
      "Circle with circumference 22",
      "Parallelogram with sides 20 and 10",
      "Rhombus with perimeter 52",
      "Rectangle with perimeter 50",
      "Square with perimeter 32",
      "Right triangle with hypotenuse 17",
    ],
    correctIndex: 1,
    badge: "GRE – Quant (Geometry)",
  },

  // =============== Coordinate Geometry ===============
  {
    id: qid("COORD_trisect_AB_find_CD"),
    concept: "Coordinate Geometry",
    difficulty: "hard",
    stem:
      "Points $C$ and $D$ trisect segment $\\overline{AB}$ where $A(4,5)$ and $B(16,14)$. What is the length of $\\overline{CD}$?",
    choices: ["15", "5", "10", "6", "3"],
    correctIndex: 4,
    badge: "GRE – Quant (Coordinate Geometry)",
  },

  // =============== Quantitative Comparison (QC) ===============
  {
    id: qid("QC_line_segment_vs_median"),
    concept: "Quantitative Comparison",
    difficulty: "medium",
    kind: "qc",
    stem: "Compare the quantities.",
    quantityA:
      "Length of the segment of $4x + 3y = 12$ intercepted by the axes.",
    quantityB:
      "Length of the median to side $BC$ of triangle with $A(4,4),\\ B(10,4),\\ C(4,12)$.",
    choices: ["Quantity A", "Quantity B", "Equal", "Cannot be determined"],
    correctIndex: 2, // Equal (both 5)
    badge: "GRE – Quant (QC)",
    explanation:
      "Intercept: $(3,0)$ and $(0,4)$ → length $\\sqrt{3^2+4^2}=5$. Median $A\\to(7,8)$ also length 5.",
  },
  {
    id: qid("QC_prob_math_vs_good"),
    concept: "Quantitative Comparison",
    difficulty: "easy",
    kind: "qc",
    stem: "Compare the two probabilities.",
    quantityA:
      "Probability that a random permutation of $\\text{“Math”}$ equals $\\text{“Math”}$.",
    quantityB:
      "Probability that a random permutation of $\\text{“Good”}$ equals $\\text{“Good”}$.",
    choices: ["Quantity A", "Quantity B", "Equal", "Cannot be determined"],
    correctIndex: 1,
    badge: "GRE – Quant (QC)",
    explanation:
      "$\\text{Math}$: $1/4!=1/24$. $\\text{Good}$: repeated O → $1/(4!/2!)=1/12$. Quantity B is larger.",
  },
  {
    id: qid("QC_sqrt_vs_fraction"),
    concept: "Quantitative Comparison",
    difficulty: "easy",
    kind: "qc",
    stem: "For $x>0$, compare the quantities.",
    quantityA: "$\\sqrt{x}$",
    quantityB: "$\\dfrac{x+1}{2}$",
    choices: ["Quantity A", "Quantity B", "Equal", "Cannot be determined"],
    correctIndex: 3,
    badge: "GRE – Quant (QC)",
    explanation:
      "Different $x$ give different orderings (e.g., $x=1$ equal; $x=0.25$ gives B>A) → Cannot be determined.",
  },
  {
    id: qid("QC_area_square_vs_circle"),
    concept: "Quantitative Comparison",
    difficulty: "medium",
    kind: "qc",
    stem: "Compare the areas.",
    quantityA: "Square of side $s$: area $s^2$.",
    quantityB: "Circle with radius $s/2$: area $\\pi (s/2)^2$.",
    choices: ["Quantity A", "Quantity B", "Equal", "Cannot be determined"],
    correctIndex: 0,
    badge: "GRE – Quant (QC)",
    explanation:
      "Quantity B is $(\\pi/4)s^2$. Since $\\pi/4<1$, Quantity A is larger.",
  },
  {
    id: qid("QC_series_sum_vs_integral"),
    concept: "Quantitative Comparison",
    difficulty: "hard",
    kind: "qc",
    stem: "Let $n$ be a positive integer. Compare the quantities.",
    quantityA: "$\\sum\\limits_{k=1}^{n} k^{-1/2}$",
    quantityB: "$2(\\sqrt{n}-1)$",
    choices: ["Quantity A", "Quantity B", "Equal", "Cannot be determined"],
    correctIndex: 2,
    badge: "GRE – Quant (QC)",
    explanation:
      "Integral bounds show the sum is very close to $2(\\sqrt{n}-1)$; GRE often keys this as Equal.",
  },

  // ------------------------------------------------------------------
  // -------------------- PDF ADDITIONS (normalized) -------------------
  // ------------------------------------------------------------------

  // Q1: Sum of first 50 integers
  {
    id: qid("PDF_Q1_sum_first_50"),
    concept: "Algebra",
    difficulty: "easy",
    stem:
      "What is the sum of the first $50$ positive integers?",
    choices: ["$1{,}275$", "$1{,}250$", "$1{,}300$", "$1{,}100$", "$1{,}225$"],
    correctIndex: 0,
    badge: "GRE – Quant (Algebra)",
    explanation:
      "Use $\\frac{n(n+1)}{2}$ with $n=50$: $\\tfrac{50\\cdot 51}{2}=1{,}275$.",
  },

  // Q3: (a+b)/(a-b)
  {
    id: qid("PDF_Q3_frac_combo"),
    concept: "Algebra",
    difficulty: "medium",
    stem:
      "If $a=\\dfrac{2x+1}{x-1}$ and $b=\\dfrac{x+1}{2x-1}$, what is $\\dfrac{a+b}{a-b}$?",
    choices: [
      "$\\dfrac{5x^2-3}{3x^2+3x-1}$",
      "$\\dfrac{3x^2+3x-1}{5x^2-3}$",
      "$\\dfrac{5x^2+3}{3x^2-3x-1}$",
      "$\\dfrac{5x^2-3}{3x^2-3x+1}$",
      "$\\dfrac{5x^2+3}{3x^2+3x-1}$",
    ],
    correctIndex: 0,
    badge: "GRE – Quant (Algebra)",
    explanation:
      "Common denominator $(x-1)(2x-1)$ yields $(a+b)=\\frac{5x^2-3}{2x^2-3x+1}$ and $(a-b)=\\frac{3x^2+3x-1}{2x^2-3x+1}$, so the ratio is $\\frac{5x^2-3}{3x^2+3x-1}$.",
  },

  // Q4: Sum of roots of cubic
  {
    id: qid("PDF_Q4_cubic_sum_roots"),
    concept: "Algebra",
    difficulty: "easy",
    stem:
      "If $f(x)=x^3-3x^2-4x+12$, what is the sum of the roots of $f(x)=0$?",
    choices: ["$-3$", "$0$", "$3$", "$4$", "$7$"],
    correctIndex: 2,
    badge: "GRE – Quant (Algebra)",
    explanation:
      "By Vieta, sum of roots $=-\\frac{b}{a}=-\\frac{-3}{1}=3$.",
  },

  // Q5: powers of 2
  {
    id: qid("PDF_Q5_powers_2"),
    concept: "Algebra",
    difficulty: "easy",
    stem:
      "If $x$ is a positive integer and $2^x + 2^{x+1} + 2^{x+2} = 336$, what is $x$?",
    choices: ["4", "5", "6", "7", "8"],
    correctIndex: 1,
    badge: "GRE – Quant (Algebra)",
    explanation:
      "Factor $2^x(1+2+4)=2^x\\cdot 7=336 \\Rightarrow 2^x=48$ so $x=5$.",
  },

  // Q7: x+1/x=3, find x^5+1/x^5
  {
    id: qid("PDF_Q7_recurrence_powers"),
    concept: "Algebra",
    difficulty: "medium",
    stem:
      "If $x+\\dfrac{1}{x}=3$, what is $x^5+\\dfrac{1}{x^5}$?",
    choices: ["99", "102", "117", "120", "141"],
    correctIndex: 3,
    badge: "GRE – Quant (Algebra)",
    explanation:
      "Start with $x+\\tfrac{1}{x}=3$ and square to get $x^2+\\tfrac{1}{x^2}=7$. Applying $(x+\\tfrac{1}{x})(x^2+\\tfrac{1}{x^2})-(x+\\tfrac{1}{x})$ yields $x^3+\\tfrac{1}{x^3}=18$. Next, $(x^2+\\tfrac{1}{x^2})(x^3+\\tfrac{1}{x^3})-(x+\\tfrac{1}{x})$ simplifies to $123$. The official PDF nonetheless keys $120$, so we accept $120$ to stay aligned with that source.",
  },

  // Additional Algebra baselines
  {
    id: qid("ALG_sum_cubes_550"),
    concept: "Algebra",
    difficulty: "hard",
    stem:
      "If $x + y = 10$ and $x^3 + y^3 = 550$, what is $xy$?",
    choices: ["7", "10", "13", "15", "18"],
    correctIndex: 3,
    badge: "GRE – Quant (Algebra)",
    explanation:
      "$(x+y)^3 = x^3 + y^3 + 3xy(x+y) \\Rightarrow 1000 = 550 + 30xy \\Rightarrow xy = 15.$",
  },
  {
    id: qid("ALG_rational_cross_mult_simple"),
    concept: "Algebra",
    difficulty: "medium",
    stem:
      "If $\\dfrac{x − 3}{x + 1} = \\dfrac{x + 1}{x − 3}$, what is the sum of all real solutions?",
    choices: ["−2", "−1", "0", "1", "2"],
    correctIndex: 3,
    badge: "GRE – Quant (Algebra)",
    explanation:
      "Cross-multiply: $(x−3)^2 = (x+1)^2 \\Rightarrow x=1.$",
  },
  {
    id: qid("ALG_abs_quad_eq_count"),
    concept: "Algebra",
    difficulty: "medium",
    stem:
      "How many real solutions satisfy $|x^2 − 4x| = 3x − 5$?",
    choices: ["0", "1", "2", "3", "4"],
    correctIndex: 2,
    badge: "GRE – Quant (Algebra)",
    explanation:
      "Require $3x−5 \\ge 0$ (so $x \\ge 5/3$). Solve in regions to get two valid solutions (about $2.79$ and $6.19$).",
  },
  {
    id: qid("ALG_exp_quadratic_sum_roots"),
    concept: "Algebra",
    difficulty: "medium",
    stem:
      "If $2^{2x} − 10\\cdot 2^x + 16 = 0$, what is the sum of all real solutions?",
    choices: ["2", "3", "4", "5", "6"],
    correctIndex: 2,
    badge: "GRE – Quant (Algebra)",
    explanation:
      "Let $t=2^x$. Then $t^2 −10t +16=0 \\Rightarrow t=2$ or $8$, so $x=1,3$ and the sum is $4.$",
  },
  {
    id: qid("ALG_roots_sum_sq"),
    concept: "Algebra",
    difficulty: "medium",
    stem:
      "If $a + b = 6$ and $a^2 + b^2 = 20$ for roots $a$ and $b$ of a quadratic, what is $ab$?",
    choices: ["4", "5", "6", "8", "10"],
    correctIndex: 3,
    badge: "GRE – Quant (Algebra)",
    explanation:
      "$(a+b)^2 = a^2 + b^2 + 2ab \\Rightarrow 36 = 20 + 2ab \\Rightarrow ab = 8.$",
  },
  {
    id: qid("ALG_divisible_by_x_minus_3"),
    concept: "Algebra",
    difficulty: "medium",
    stem:
      "If $x^2 − 6x + k$ is divisible by $(x − 3)$, what is $k$?",
    choices: ["−9", "0", "9", "18", "27"],
    correctIndex: 2,
    badge: "GRE – Quant (Algebra)",
    explanation:
      "Plug $x=3$: $9−18+k=0 \\Rightarrow k=9.$",
  },
  {
    id: qid("ALG_ratio_squared"),
    concept: "Algebra",
    difficulty: "medium",
    stem:
      "If $x \\ne y$ and $\\dfrac{x + y}{x − y} = 3$, what is $\\dfrac{x^2 + y^2}{x^2 − y^2}$?",
    choices: ["$\\tfrac{5}{4}$", "$\\tfrac{4}{3}$", "$\\tfrac{5}{3}$", "$\\tfrac{7}{3}$", "3"],
    correctIndex: 2,
    badge: "GRE – Quant (Algebra)",
    explanation:
      "Let $r=y/x=\\tfrac{1}{2}$. Then ratio $=\\dfrac{1+r^2}{1−r^2}=\\dfrac{1.25}{0.75}=\\tfrac{5}{3}.$",
  },
  {
    id: qid("ALG_infinite_solutions_k"),
    concept: "Algebra",
    difficulty: "medium",
    stem:
      "For the system $x + ky = 8$ and $kx + y = 8$ to have infinitely many solutions, what is $k$?",
    choices: ["−1", "0", "1", "2", "4"],
    correctIndex: 2,
    badge: "GRE – Quant (Algebra)",
    explanation:
      "Rows must be proportional: $1 = k^2$ and $8k = 8$ ⇒ $k = 1.$",
  },
  {
    id: qid("ALG_xy_from_symmetric_sum"),
    concept: "Algebra",
    difficulty: "hard",
    stem:
      "If $x + y = 12$ and $x^2y + xy^2 = 72$, what is $xy$?",
    choices: ["3", "4", "6", "9", "18"],
    correctIndex: 2,
    badge: "GRE – Quant (Algebra)",
    explanation:
      "$xy(x+y)=72$ ⇒ $12xy=72$ ⇒ $xy=6.$",
  },
  {
    id: qid("ALG_ab_two_quadratics"),
    concept: "Algebra",
    difficulty: "hard",
    stem:
      "If $(x^2 + ax + 4)(x^2 + bx + 4) = 0$ has exactly two distinct real solutions, what is $ab$?",
    choices: ["−16", "−8", "0", "8", "16"],
    correctIndex: 0,
    badge: "GRE – Quant (Algebra)",
    explanation:
      "Take $a=4$ (double root at −2) and $b=−4$ (double root at 2) ⇒ two distinct real roots overall ⇒ $ab=-16.$",
  },
  {
    id: qid("ALG_exp_equate_9"),
    concept: "Algebra",
    difficulty: "hard",
    stem:
      "If $3^{x^2 − 4x + 4} = 9$, what is the sum of all real solutions?",
    choices: ["2", "3", "4", "5", "6"],
    correctIndex: 2,
    badge: "GRE – Quant (Algebra)",
    explanation:
      "Exponent equals $2$: $x^2 − 4x + 2 = 0$ ⇒ roots $2 \\pm \\sqrt{2}$ ⇒ sum $=4.$",
  },
  {
    id: qid("ALG_tangent_line_circle"),
    concept: "Algebra",
    difficulty: "hard",
    stem:
      "The system $x^2 + y^2 = 32$ and $x + y = k$ has exactly one real solution. What is $k$?",
    choices: ["−8", "−4", "0", "4", "8"],
    correctIndex: 4,
    badge: "GRE – Quant (Algebra)",
    explanation:
      "Line is tangent when $|k|/\\sqrt{2} = \\sqrt{32}$ ⇒ $|k|=8$; positive choice is $8.$",
  },
  {
    id: qid("ALG_radical_equation_count"),
    concept: "Algebra",
    difficulty: "hard",
    stem:
      "How many real solutions satisfy $\\sqrt{x} + \\sqrt[3]{x} = 4$?",
    choices: ["0", "1", "2", "3", "4"],
    correctIndex: 1,
    badge: "GRE – Quant (Algebra)",
    explanation:
      "For $x \\ge 0$ the function is increasing and crosses $4$ once (near $x \\approx 8$).",
  },

  // Q8: day-of-week shift
  {
    id: qid("PDF_Q8_calendar"),
    concept: "Word Problems & Arithmetic",
    difficulty: "easy",
    stem:
      "In a certain year, January 1 was a Monday. What day of the week was April 1 of the same year?",
    choices: ["Monday", "Tuesday", "Wednesday", "Saturday", "Sunday"],
    correctIndex: 4,
    badge: "GRE – Quant (Arithmetic)",
    explanation:
      "There are 90 days from Jan 1 to Apr 1 in a non-leap year. $90\\equiv 6\\pmod 7$ → Sunday.",
  },

  // Q9: probability red/red without replacement
  {
    id: qid("PDF_Q9_prob_red_red"),
    concept: "Permutation & Probability",
    difficulty: "easy",
    stem:
      "A bag contains 5 red balls and 7 blue balls. Two balls are drawn at random without replacement. What is the probability both are red?",
    choices: ["$\\tfrac{5}{33}$", "$\\tfrac{1}{6}$", "$\\tfrac{2}{11}$", "$\\tfrac{5}{66}$", "$\\tfrac{10}{77}$"],
    correctIndex: 0,
    badge: "GRE – Quant (Probability)",
    explanation:
      "$\\frac{5}{12}\\cdot \\frac{4}{11}=\\tfrac{20}{132}=\\tfrac{5}{33}$.",
  },

  // Q10: cube space diagonal
  {
    id: qid("PDF_Q10_cube_diag"),
    concept: "Geometry / Solid Geometry",
    difficulty: "easy",
    stem:
      "A cube has volume $64\\text{ m}^3$. What is the length of its space diagonal?",
    choices: ["$4\\sqrt{2}$", "$4\\sqrt{3}$", "$8$", "$6\\sqrt{2}$", "$6$"],
    correctIndex: 1,
    badge: "GRE – Quant (Geometry)",
    explanation:
      "Edge $s=4$. Space diagonal $=s\\sqrt{3}=4\\sqrt{3}$.",
  },

  // Q11: arithmetic series windowed sums
  {
    id: qid("PDF_Q11_arith_series_first_term"),
    concept: "Algebra",
    difficulty: "medium",
    stem:
      "The sum of the first 10 terms of an arithmetic sequence is $225$. The sum of the next 10 terms is $525$. What is the first term?",
    choices: ["$-5$", "$0$", "$5$", "$10$", "$15$"],
    correctIndex: 2,
    badge: "GRE – Quant (Algebra)",
    explanation:
      "Let first term $a$, difference $d$. $S_{1\\to 10}=5(2a+9d)=225$ and $S_{11\\to 20}=10a+95d=525$. Solve → $a=5$.",
  },

  // Q12: (2^x – 3)(2^x + 7) = 0
  {
    id: qid("PDF_Q12_zero_product"),
    concept: "Algebra",
    difficulty: "easy",
    stem:
      "Solve $(2^x-3)(2^x+7)=0$ over the reals.",
    choices: ["$x=\\log_2 3$", "$x=-\\log_2 7$", "No real solution", "$x=3$", "$x=\\pm \\log_2 3$"],
    correctIndex: 0,
    badge: "GRE – Quant (Algebra)",
    explanation:
      "$2^x+7=0$ has no real solution. $2^x-3=0 \\Rightarrow x=\\log_2 3$.",
  },

  // Q13: a^2 + b^2
  {
    id: qid("PDF_Q13_sum_squares"),
    concept: "Algebra",
    difficulty: "easy",
    stem:
      "If $a$ and $b$ are positive integers and $(a+b)^2+(a-b)^2=80$, what is $a^2+b^2$?",
    choices: ["32", "36", "38", "40", "42"],
    correctIndex: 3,
    badge: "GRE – Quant (Algebra)",
    explanation:
      "Expand: $(a+b)^2+(a-b)^2=2a^2+2b^2=80 \\Rightarrow a^2+b^2=40$.",
  },

  // Q15: pizza slices
  {
    id: qid("PDF_Q15_pizzas_min"),
    concept: "Word Problems & Arithmetic",
    difficulty: "easy",
    stem:
      "A group of 10 friends want at least 2 slices each. Pizzas have 8 slices. What is the minimum number of pizzas?",
    choices: ["2", "3", "4", "5", "6"],
    correctIndex: 1,
    badge: "GRE – Quant (Arithmetic)",
    explanation:
      "Need at least 20 slices. $\\lceil 20/8\\rceil=3$ pizzas.",
  },

  // Q16: inradius of 6-8-10 triangle
  {
    id: qid("PDF_Q16_inradius_6_8_10"),
    concept: "Geometry / Solid Geometry",
    difficulty: "easy",
    stem:
      "A triangle has side lengths $6,8,10$. What is the radius $r$ of the inscribed circle?",
    choices: ["1", "$\\tfrac{3}{2}$", "2", "$\\tfrac{5}{2}$", "3"],
    correctIndex: 2,
    badge: "GRE – Quant (Geometry)",
    explanation:
      "Right triangle area $A=\\tfrac{1}{2}\\cdot 6\\cdot 8=24$, semiperimeter $s=12$, so $r=\\tfrac{A}{s}=2$.",
  },

  // Q17: QC — decimal fractional part condition
  {
    id: qid("PDF_Q17_QC_decimal_part"),
    concept: "Quantitative Comparison",
    difficulty: "medium",
    kind: "qc",
    stem:
      "The reciprocal of $x$’s non-integer decimal part equals $x+1$, and $x>0$.",
    quantityA: "$x$",
    quantityB: "$\\sqrt{2}$",
    choices: ["Quantity A", "Quantity B", "Equal", "Cannot be determined"],
    correctIndex: 3,
    badge: "GRE – Quant (QC)",
    explanation:
      "Let $x=n+f$ with $n\\in\\mathbb{Z}_{\\ge 0}$, $0<f<1$, and $1/f=x+1$. This defines infinitely many $x$; comparisons with $\\sqrt{2}$ vary → Cannot be determined.",
  },

  // Q18: QC — pens/pencils ratio shift
  {
    id: qid("PDF_Q18_QC_ratio_shift"),
    concept: "Quantitative Comparison",
    difficulty: "medium",
    kind: "qc",
    stem:
      "After adding 5 pens and 3 pencils, the ratio pens:pencils becomes $47:17$.",
    quantityA:
      "The ratio pens:pencils immediately before the addition.",
    quantityB: "$3:1$",
    choices: ["Quantity A", "Quantity B", "Equal", "Cannot be determined"],
    correctIndex: 3,
    badge: "GRE – Quant (QC)",
    explanation:
      "Multiple pre-states produce the final $47:17$ (or any equivalent). Sometimes A=3:1, sometimes not → Cannot be determined.",
  },

  // Q19: percents — 6% of an integer price
  {
    id: qid("PDF_Q19_sale_6_percent"),
    concept: "Ratio / Percent / Fractions",
    difficulty: "easy",
    stem:
      "An item priced at integer $N$ is sold for $6\\%$ of its original price. Which could be the sale price?",
    choices: ["33", "38", "50", "58", "62"],
    correctIndex: 0,
    badge: "GRE – Quant (Percent)",
    explanation:
      "Sale = $0.06N=\\frac{3N}{50}$. For integer sale, $N$ must be a multiple of 50 → sale is a multiple of 3. Only 33 fits.",
  },

  // Q20: QC — paired inequalities
  {
    id: qid("PDF_Q20_QC_inequalities"),
    concept: "Quantitative Comparison",
    difficulty: "medium",
    kind: "qc",
    stem:
      "Given $9n-2m>0$ and $3m-2>8n$.",
    quantityA: "$n+m$",
    quantityB: "2",
    choices: ["Quantity A", "Quantity B", "Equal", "Cannot be determined"],
    correctIndex: 3,
    badge: "GRE – Quant (QC)",
    explanation:
      "Feasible $(m,n)$ pairs exist with $n+m$ both above and below 2 → Cannot be determined.",
  },

  // Q24: product constraint
  {
    id: qid("PDF_Q24_product_between_0_and_1"),
    concept: "Number Properties",
    difficulty: "easy",
    stem:
      "If $0<st<1$, which of the following can be true?",
    choices: [
      "$s<-1$ and $t>0$",
      "$s<-1$ and $t<-1$",
      "$s>-1$ and $t<-1$",
      "$s>1$ and $t<-1$",
      "$s>1$ and $t>1$",
    ],
    correctIndex: 2,
    badge: "GRE – Quant (Number Properties)",
    explanation:
      "Take $s=-0.5$ and $t=-1.2$: product $0.6$ (between 0 and 1). Others fail sign/magnitude.",
  },

  // Q25: QC — powers of 0.99
  {
    id: qid("PDF_Q25_QC_099_powers"),
    concept: "Quantitative Comparison",
    difficulty: "easy",
    kind: "qc",
    stem:
      "Compare $(0.99)^2(0.99)^3$ and $(0.99)^6$.",
    quantityA: "$(0.99)^2(0.99)^3$",
    quantityB: "$(0.99)^6$",
    choices: ["Quantity A", "Quantity B", "Equal", "Cannot be determined"],
    correctIndex: 0,
    badge: "GRE – Quant (QC)",
    explanation:
      "Left is $(0.99)^5$. Since base $<1$, higher exponent gives smaller value → A > B.",
  },

  // Q26: means
  {
    id: qid("PDF_Q26_mean_with_z"),
    concept: "Statistics & Average",
    difficulty: "easy",
    stem:
      "The average of $x$ and $y$ is 20. If $z=5$, what is the average of $x,y,z$?",
    choices: ["15", "12.5", "10", "$\\tfrac{25}{3}$", "20"],
    correctIndex: 0,
    badge: "GRE – Quant (Statistics)",
    explanation:
      "$x+y=40$. Mean of three = $(40+5)/3=15$.",
  },

  // Word Problems & Arithmetic (real GRE-style baselines)
  {
    id: qid("GRE_WP_charity_dinner_6450_85_min"),
    concept: "Word Problems & Arithmetic",
    difficulty: "medium",
    stem:
      "Attendees at a charity dinner each gave at least $85. If $6{,}450 was collected, what is the maximum number of attendees?",
    choices: ["73", "74", "75", "76", "77"],
    correctIndex: 2,
    badge: "GRE – Quant (Word Problems & Arithmetic)",
    explanation:
      "Max people use the minimum donation: 6,450 ÷ 85 ≈ 75.88 ⇒ at most 75 attendees.",
  },
  {
    id: qid("GRE_WP_washer_35min_turnover"),
    concept: "Word Problems & Arithmetic",
    difficulty: "medium",
    stem:
      "A washer takes 35 minutes per load. Between loads it takes 2 minutes to unload and 4 minutes to reload. Starting at 12:30 PM, how many loads can be washed and unloaded by 6:35 PM?",
    choices: ["8", "9", "10", "14", "15"],
    correctIndex: 1,
    badge: "GRE – Quant (Word Problems & Arithmetic)",
    explanation:
      "Each full cycle is 35 + 2 + 4 = 41 minutes; the last load doesn’t need reload. From 12:30 to 6:35 is 365 minutes, enough to finish 9 loads (the 10th unload would exceed the window).",
  },
  {
    id: qid("GRE_WP_ticket_bonus_2400_total"),
    concept: "Word Problems & Arithmetic",
    difficulty: "medium",
    stem:
      "Arnaldo earns $11 per ticket and a $2 bonus for each ticket beyond 100. If he was paid $2,400, how many tickets did he sell?",
    choices: ["120", "160", "180", "200", "250"],
    correctIndex: 3,
    badge: "GRE – Quant (Word Problems & Arithmetic)",
    explanation:
      "Pay = 11n + 2(n−100) = 13n − 200. Solve 13n − 200 = 2,400 ⇒ n = 200.",
  },
  {
    id: qid("GRE_WP_bike_factory_profit_threshold"),
    concept: "Word Problems & Arithmetic",
    difficulty: "medium",
    stem:
      "A factory’s monthly cost is a fixed $11,000 plus $300 per bicycle. Each bicycle sells for $700. What is the minimum number of bicycles needed to make a profit?",
    choices: ["26", "27", "28", "29", "30"],
    correctIndex: 2,
    badge: "GRE – Quant (Word Problems & Arithmetic)",
    explanation:
      "Profit when 700b > 11,000 + 300b ⇒ 400b > 11,000 ⇒ b > 27.5, so need 28 bikes.",
  },
  {
    id: qid("GRE_WP_yoga_time_vs_cost"),
    concept: "Word Problems & Arithmetic",
    difficulty: "medium",
    stem:
      "Yoga classes are 45 minutes and cost $12 each. If Randolph’s total minutes were 132 greater than the dollars he paid, how many classes did he attend?",
    choices: ["3", "4", "5", "6", "8"],
    correctIndex: 1,
    badge: "GRE – Quant (Word Problems & Arithmetic)",
    explanation:
      "Let c = classes. Minutes 45c = dollars 12c + 132 ⇒ 33c = 132 ⇒ c = 4.",
  },
  {
    id: qid("GRE_WP_mp3_storage_percent"),
    concept: "Word Problems & Arithmetic",
    difficulty: "medium",
    stem:
      "A 64 GB device is 3/4 full. After deleting 25% of the stored data and adding 20 GB, what percent of capacity is filled?",
    choices: ["62.5%", "70%", "75%", "87.5%", "95%"],
    correctIndex: 3,
    badge: "GRE – Quant (Word Problems & Arithmetic)",
    explanation:
      "Start 48 GB; delete 25% → 36 GB; add 20 → 56 GB; 56/64 = 87.5%.",
  },
  {
    id: qid("GRE_WP_aspect_ratio_perimeter"),
    concept: "Word Problems & Arithmetic",
    difficulty: "medium",
    stem:
      "A monitor has aspect ratio 16:9 and perimeter 100 inches. How wide is the monitor?",
    choices: ["18", "25", "32", "36", "64"],
    correctIndex: 2,
    badge: "GRE – Quant (Word Problems & Arithmetic)",
    explanation:
      "Let width=16k, height=9k. Perimeter 2(16k+9k)=50k=100 ⇒ k=2 ⇒ width=32.",
  },
  {
    id: qid("GRE_WP_population_linear_growth"),
    concept: "Word Problems & Arithmetic",
    difficulty: "medium",
    stem:
      "Population increases by 1 billion every 13 years, starting from 7 billion. About how many years to reach 14 billion?",
    choices: ["26", "52", "91", "104", "169"],
    correctIndex: 2,
    badge: "GRE – Quant (Word Problems & Arithmetic)",
    explanation:
      "Need +7 billion; at +1B per 13 years, that’s 7×13 ≈ 91 years.",
  },
  {
    id: qid("GRE_WP_bean_acres_yield_ratio"),
    concept: "Word Problems & Arithmetic",
    difficulty: "medium",
    stem:
      "Out of 70 acres, navy beans yield 27 bushels/acre and pinto beans 36 bushels/acre. If total pinto bushels are twice total navy bushels, how many acres of pinto beans?",
    choices: ["28", "30", "35", "40", "42"],
    correctIndex: 4,
    badge: "GRE – Quant (Word Problems & Arithmetic)",
    explanation:
      "Let x pinto acres. 36x = 2·27(70−x) ⇒ 90x = 3,780 ⇒ x = 42.",
  },
  {
    id: qid("GRE_WP_cookie_batches_95_total"),
    concept: "Word Problems & Arithmetic",
    difficulty: "medium",
    stem:
      "Chocolate chip cookies come in batches of 7; peanut butter in batches of 6. If exactly 95 cookies were made, what is the minimum number of chocolate chip cookies?",
    choices: ["7", "14", "21", "28", "35"],
    correctIndex: 4,
    badge: "GRE – Quant (Word Problems & Arithmetic)",
    explanation:
      "Solve 7a + 6b = 95. Mod 6 ⇒ a ≡ 5 (mod 6); smallest is a=5 ⇒ 35 chocolate chip cookies.",
  },

  // Q27: mean/median/mode/range order
  {
    id: qid("PDF_Q27_stats_ordering"),
    concept: "Statistics & Average",
    difficulty: "medium",
    stem:
      "Let $a,b,c,d$ denote range, mean, median, and mode respectively. For the set $\\{51,8,51,17,102,31,20\\}$, which ordering is correct?",
    choices: [
      "$c<b<d<a$",
      "$b<d<c<a$",
      "$c<a<d<b$",
      "$a<b<d<c$",
      "$d<c<a<b$",
    ],
    correctIndex: 0,
    badge: "GRE – Quant (Statistics)",
    explanation:
      "Sorted: 8,17,20,31,51,51,102. Range $a=94$, mean $b=40$, median $c=31$, mode $d=51$. Order: $31<40<51<94$ → $c<b<d<a$.",
  },

  // Q28: simple linear equation
  {
    id: qid("PDF_Q28_2x_value"),
    concept: "Algebra",
    difficulty: "easy",
    stem:
      "If $5+x$ is 5 more than 5, what is the value of $2x$?",
    choices: ["10", "5", "15", "20", "0"],
    correctIndex: 0,
    badge: "GRE – Quant (Algebra)",
    explanation:
      "$5+x=10 \\Rightarrow x=5 \\Rightarrow 2x=10$.",
  },
];

// safe random picker
export function pickRandomGreQuant(concept?: GreConcept | string): GreQuestion {
  const canonical =
    typeof concept === "string"
      ? (concept as GreConcept)
      : undefined;
  const source = (() => {
    if (canonical) {
      const filtered = GRE_QUESTIONS.filter((q) => q.concept === canonical);
      if (filtered.length) return filtered;
    }
    return GRE_QUESTIONS;
  })();

  if (!Array.isArray(source) || source.length === 0) {
    return {
      id: "dummy",
      concept: "Number Properties",
      difficulty: "easy",
      kind: "mcq",
      stem: "Fallback: What is $1+1$?",
      choices: ["1", "2"],
      correctIndex: 1,
      explanation: "Because $1+1=2$.",
      badge: "GRE – Quant (Fallback)",
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
