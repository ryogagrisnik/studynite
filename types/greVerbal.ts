export type VerbalSection =
  | 'Text Completion'
  | 'Sentence Equivalence'
  | 'Reading Comprehension';

export type GreFormat = 'TC' | 'SE' | 'RC';

export type GreTC = {
  exam: 'GRE';
  section: VerbalSection;     // 'Text Completion'
  format: 'TC';
  stem: string;
  choices?: string[];         // single-blank
  blanks?: Array<{ options: string[] }>; // multi-blank (1–3)
};

export type GreSE = {
  exam: 'GRE';
  section: VerbalSection;     // 'Sentence Equivalence'
  format: 'SE';
  stem: string;
  choices: string[];          // select exactly two
};

export type GreRC = {
  exam: 'GRE';
  section: VerbalSection;     // 'Reading Comprehension'
  format: 'RC';
  passage: string;            // short passage only
  stem: string;
  choices: string[];
};

export type GreVerbalQuestion = GreTC | GreSE | GreRC;
