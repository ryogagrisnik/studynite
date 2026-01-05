import { MAX_QUESTION_SECONDS, MIN_QUESTION_SECONDS, QUESTION_SECONDS } from "./constants";

type TimerInput = {
  questionStartedAt?: Date | string | null;
  pauseStartedAt?: Date | string | null;
  pausedMs?: number | null;
  questionDurationSec?: number | null;
};

const toDate = (value?: Date | string | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function clampQuestionDurationSec(value?: number | null) {
  if (!Number.isFinite(value)) return QUESTION_SECONDS;
  return Math.min(MAX_QUESTION_SECONDS, Math.max(MIN_QUESTION_SECONDS, Math.floor(value as number)));
}

export function computeTimerState(input: TimerInput, now: Date = new Date()) {
  const start = toDate(input.questionStartedAt) ?? now;
  const pausedAt = toDate(input.pauseStartedAt);
  const pausedTotalMs = Math.max(0, input.pausedMs ?? 0);
  const durationSec = clampQuestionDurationSec(input.questionDurationSec);
  const effectiveNow = pausedAt ?? now;
  const elapsedMs = Math.max(0, effectiveNow.getTime() - start.getTime() - pausedTotalMs);
  const timeRemainingMs = Math.max(0, durationSec * 1000 - elapsedMs);
  return {
    durationSec,
    elapsedMs,
    timeRemainingMs,
    isPaused: Boolean(pausedAt),
  };
}
