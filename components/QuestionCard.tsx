'use client';
import React from 'react';
import type { QuestionPayload } from '@/lib/types/question';
import QuestionCardQuant from './QuestionCardQuant';
import QuestionCardVerbal from './QuestionCardVerbal';
import type { AttemptLogEvent } from './questionCardEvents';

/**
 * Unified QuestionCard wrapper.
 * It simply chooses between Quant and Verbal cards.
 * Both subcards expect one prop: `q: QuestionPayload`.
 */
type Props = {
  payload?: QuestionPayload;
  question?: QuestionPayload;
  onContinue?: () => void;
  onNext?: () => void;
  onAttemptLogged?: (event: AttemptLogEvent) => void;
};

export type { AttemptLogEvent } from './questionCardEvents';

export default function QuestionCard({
  payload,
  question,
  onContinue,
  onNext,
  onAttemptLogged,
}: Props) {
  const data = payload ?? question;
  if (!data) return null;

  const handleContinue = onContinue ?? onNext;

  if (data.section === 'Verbal') {
    return (
      <QuestionCardVerbal
        q={data}
        onContinue={handleContinue}
        onAttemptLogged={onAttemptLogged}
      />
    );
  }

  return (
    <QuestionCardQuant
      q={data}
      onContinue={handleContinue}
      onAttemptLogged={onAttemptLogged}
    />
  );
}
