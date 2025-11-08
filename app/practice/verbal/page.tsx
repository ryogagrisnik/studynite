// app/practice/verbal/page.tsx
'use client';

import { useEffect, useState } from 'react';
import QuestionCardVerbal from '@/components/QuestionCardVerbal';
import { getNextGreVerbal } from '@/lib/client/getNextGreVerbal';

type Mode = 'random' | 'concept';
type Concept = 'TC' | 'SE' | 'RC';

export default function GreVerbalPracticePage() {
  const [mode, setMode] = useState<Mode>('random');
  const [concept, setConcept] = useState<Concept | undefined>(undefined);

  const [q, setQ] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const question = await getNextGreVerbal({ mode, concept });
      setQ(question);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load question');
      setQ(null);
    } finally {
      setLoading(false);
    }
  }

  // initial + whenever mode/concept changes
  useEffect(() => { load(); }, [mode, concept]);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">GRE Verbal Practice</h1>

      {/* Controls (inline so this page works standalone) */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="text-sm">Study:</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.currentTarget.value as Mode)}
            className="border rounded px-2 py-1"
          >
            <option value="random">Random</option>
            <option value="concept">By Concept</option>
          </select>
        </label>

        {mode === 'concept' && (
          <label className="flex items-center gap-2">
            <span className="text-sm">Concept:</span>
            <select
              value={concept ?? 'TC'}
              onChange={(e) => setConcept(e.currentTarget.value as Concept)}
              className="border rounded px-2 py-1"
            >
              <option value="TC">Text Completion (TC)</option>
              <option value="SE">Sentence Equivalence (SE)</option>
              <option value="RC">Reading Comprehension (RC)</option>
            </select>
          </label>
        )}
      </div>

      {/* Card */}
      <div key={`${mode}-${concept ?? 'any'}`}>
        {loading && <div>Loading…</div>}
        {err && <div className="text-red-600 text-sm">{err}</div>}
        {!loading && !err && q && <QuestionCardVerbal q={q} />}
      </div>

      <div className="flex items-center gap-3">
        <button className="border px-3 py-1 rounded" onClick={load}>Next</button>
      </div>
    </div>
  );
}
