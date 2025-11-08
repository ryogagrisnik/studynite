export type TopicStat = {
  topic: string;
  total: number;
  correct: number;
  incorrect: number;
  accuracy: number;
};

export type SectionKey = `${"GRE" | "GMAT"}::${"Quant" | "Verbal"}`;

export type SectionStat = {
  key: string;
  label: string;
  exam: "GRE" | "GMAT";
  section: "Quant" | "Verbal";
  total: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  topics: TopicStat[];
};

export type HistoryPoint = {
  date: string;
  total: number;
  correct: number;
};

export type DashboardData = {
  overallAccuracy: number;
  totalAttempts: number;
  dailyLimit: number | null;
  dailyUsed: number;
  unlimited: boolean;
  sections: SectionStat[];
  streak: {
    current: number;
    longest: number;
    lastActive: string | null;
  };
  history: HistoryPoint[];
  historyBySection: Record<SectionKey, HistoryPoint[]>;
  isEmailVerified: boolean;
  email: string | null;
};
