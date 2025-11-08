import type { AttemptLogEvent } from '@/components/questionCardEvents';

export type AttemptLogPhase = 'pending' | 'success' | 'error';

export type AttemptLogState = {
  phase: AttemptLogPhase;
  status: 'correct' | 'incorrect';
  error?: string;
};

export type AttemptLogMap = Record<string, AttemptLogState>;

export function createAttemptLogMap(initial?: AttemptLogMap): AttemptLogMap {
  return initial ? { ...initial } : {};
}

export function applyAttemptLogEvent(
  prev: AttemptLogMap,
  event: AttemptLogEvent
): { map: AttemptLogMap; error: string | null } {
  const phase: AttemptLogPhase = event.phase === 'start' ? 'pending' : event.phase;
  const next: AttemptLogMap = {
    ...prev,
    [event.questionId]: {
      phase,
      status: event.status,
      ...(phase === 'error' && event.error ? { error: event.error } : {}),
    },
  };
  const errorMessage =
    phase === 'error' ? event.error ?? 'Attempt failed. Please try again.' : null;
  return { map: next, error: errorMessage };
}

export function markAttemptSuccess(
  prev: AttemptLogMap,
  questionId: string,
  status: AttemptLogState['status'] = 'correct'
): AttemptLogMap {
  return {
    ...prev,
    [questionId]: {
      phase: 'success',
      status,
    },
  };
}

export function clearAttempt(prev: AttemptLogMap, questionId: string): AttemptLogMap {
  const next = { ...prev };
  delete next[questionId];
  return next;
}

export function shouldDequeue(map: AttemptLogMap, questionId: string): boolean {
  return map[questionId]?.phase === 'success';
}
