'use client';
import { useState } from 'react';

type Props = {
  onChange: (mode: 'random' | 'concept', concept?: 'TC' | 'SE' | 'RC') => void;
};

export default function VerbalModePicker({ onChange }: Props) {
  const [mode, setMode] = useState<'random' | 'concept'>('random');
  const [concept, setConcept] = useState<'TC' | 'SE' | 'RC'>('TC');

  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-1">
        <input
          type="radio"
          name="verbal-mode"
          checked={mode === 'random'}
          onChange={() => { setMode('random'); onChange('random'); }}
        />
        <span>Random practice</span>
      </label>

      <label className="flex items-center gap-1">
        <input
          type="radio"
          name="verbal-mode"
          checked={mode === 'concept'}
          onChange={() => { setMode('concept'); onChange('concept', concept); }}
        />
        <span>Study by concept</span>
      </label>

      {mode === 'concept' && (
        <select
          value={concept}
          onChange={(e) => {
            const c = e.currentTarget.value as 'TC' | 'SE' | 'RC';
            setConcept(c);
            onChange('concept', c);
          }}
          className="border rounded px-2 py-1"
        >
          <option value="TC">Text Completion (TC)</option>
          <option value="SE">Sentence Equivalence (SE)</option>
          <option value="RC">Reading Comprehension (RC)</option>
        </select>
      )}
    </div>
  );
}
