export type Exam = 'GRE'|'GMAT';
export type Section = 'Quant'|'Verbal';
export type Difficulty = 'easy'|'medium'|'hard';
export type QType = 'single'|'multi'|'numeric'|'tc'|'se'|'rc';

export type Question = {
  id: string;
  exam: Exam;
  section: Section;
  type: QType;
  stem: string;
  choices?: string[];
  correct?: number[];  // indexes for single/multi/tc/se
  answer?: { value:number; tolerance?: number }; // numeric
  passage?: string; // RC
  explanation: string;
  eli5?: string;
  topic?: string;
  difficulty?: Difficulty;
};
