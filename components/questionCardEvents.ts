export type AttemptLogEvent = {
  questionId: string;
  status: 'correct' | 'incorrect';
  phase: 'start' | 'success' | 'error';
  error?: string;
};
