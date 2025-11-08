'use client';

import dynamic from 'next/dynamic';
import React from 'react';

/**
 * Bullet-proof shim:
 *  - Works if ./QuestionCard exports default OR named `QuestionCard`
 *  - Never throws “Attempted import error”
 *  - Gracefully falls back if the module isn’t present yet
 */
const Loaded = dynamic(
  async () => {
    try {
      const mod: any = await import('./QuestionCard').catch(() => ({}));
      return mod.default ?? mod.QuestionCard ?? Fallback;
    } catch {
      return Fallback;
    }
  },
  {
    ssr: false,
    loading: () => <div style={{ padding: 12 }}>Loading question…</div>,
  }
);

function Fallback(props: any) {
  return (
    <div style={{ color: '#b91c1c', padding: 12 }}>
      <strong>QuestionCard export missing.</strong>
      <div>
        Ensure <code>components/QuestionCard.tsx</code> exports either
        <code> export default QuestionCard </code> or
        <code> export const QuestionCard </code>.
      </div>
    </div>
  );
}

export default Loaded;
export const QuestionCard = Loaded;
