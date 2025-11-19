'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { QuestionPayload } from '@/lib/types/question';
// @ts-ignore
import renderMathInElement from 'katex/contrib/auto-render/auto-render';
import { renderMathToHtml } from '@/lib/math/renderMathToHtml';
import { normalizeLooseTex } from '@/lib/math/normalizeLooseTex';
import type { AttemptLogEvent } from './questionCardEvents';
import { useMathJax } from './useMathJax';

type Props = {
  q: QuestionPayload;
  onContinue?: () => void;
  onAttemptLogged?: (event: AttemptLogEvent) => void;
};

const ALWAYS_SHOW_EXPLANATIONS = (process.env.NEXT_PUBLIC_ALWAYS_SHOW_EXPLANATIONS || '').toLowerCase() === 'true';
type Status = 'idle' | 'correct' | 'incorrect';

function wrapLatex(latex: string, display = false): string {
  const trimmed = latex.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('\\(') || trimmed.startsWith('\\[')) return trimmed;
  if (trimmed.includes('\\begin')) return trimmed;
  if (/^\$\$.*\$\$$/.test(trimmed)) {
    const inner = trimmed.slice(2, -2).trim();
    return wrapLatex(inner, true);
  }
  if (/^\$.*\$$/.test(trimmed)) {
    const inner = trimmed.slice(1, -1).trim();
    return wrapLatex(inner, display);
  }
  if (trimmed.includes('\\begin')) return trimmed;
  if (display) return `\\[${trimmed}\\]`;
  return `\\(${trimmed}\\)`;
}

const INLINE_ALLOWED_TEXT_WORDS = new Set([
  'sin',
  'cos',
  'tan',
  'cot',
  'sec',
  'csc',
  'log',
  'ln',
  'mod',
  'max',
  'min',
  'det',
  'lim',
]);

function cleanInvalidInlineMathSegments(input: string): string {
  const inlinePattern = /\\\(([^)]*?)\\\)/g;
  return input.replace(inlinePattern, (match, inner) => {
    const plain = inner
      .replace(/\\[a-zA-Z]+/g, ' ')
      .replace(/[^A-Za-z]/g, ' ');
    const words = plain.match(/[A-Za-z]{3,}/g);
    if (
      words &&
      words.some((word: string) => !INLINE_ALLOWED_TEXT_WORDS.has(word.toLowerCase()))
    ) {
      return inner;
    }
    return match;
  });
}

function ensureMathMarkup(raw?: string | null, display = false): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.includes('<')) return trimmed;
  let candidate: string | undefined;
  if (trimmed.startsWith('\\(') || trimmed.startsWith('\\[')) {
    candidate = cleanInvalidInlineMathSegments(trimmed);
  } else if (trimmed.includes('\\begin')) {
    candidate = trimmed;
  } else if (/^\$\$.*\$\$$/.test(trimmed)) {
    candidate = cleanInvalidInlineMathSegments(wrapLatex(trimmed.slice(2, -2), true));
  } else if (/^\$.*\$$/.test(trimmed)) {
    candidate = cleanInvalidInlineMathSegments(wrapLatex(trimmed.slice(1, -1), display));
  } else if (trimmed.startsWith('\\')) {
    candidate = cleanInvalidInlineMathSegments(wrapLatex(trimmed, display));
  } else {
    candidate = cleanInvalidInlineMathSegments(trimmed);
  }
  if (!candidate) return candidate;
  const normal = normalizeLooseTex(candidate);
  return renderMathToHtml(normal) ?? normal;
}

function optionMarkup(option: QuestionPayload['options'][number], fallback: string): string {
  const html = typeof option.html === 'string' ? option.html.trim() : '';
  const latex = typeof option.latex === 'string' ? option.latex.trim() : '';
  if (html.length > 0) {
    const normalized = ensureMathMarkup(html);
    return normalized ?? html;
  }
  if (latex.length > 0) {
    const normalized = ensureMathMarkup(latex);
    return normalized ?? fallback;
  }
  return fallback;
}

export default function QuestionCardVerbal({ q, onContinue, onAttemptLogged }: Props) {
  const [selected, setSelected] = useState<number[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [showExplanation, setShowExplanation] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const lastLoggedStatusRef = useRef<Status | null>(null);

  useEffect(() => {
    setSelected([]);
    setStatus('idle');
    setShowExplanation(false);
    startTimeRef.current = Date.now();
    lastLoggedStatusRef.current = null;
  }, [q.id]);

  const correctSet = useMemo(() => new Set(q.correct ?? []), [q.correct]);
  const multiAnswer = (q.correct ?? []).length > 1;
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const canSubmit = selected.length > 0 && status === 'idle';

  function toggleOption(idx: number) {
    if (status !== 'idle') return;
    setSelected((prev) => {
      if (multiAnswer) {
        return prev.includes(idx) ? prev.filter((n) => n !== idx) : [...prev, idx];
      }
      return prev.includes(idx) ? [] : [idx];
    });
  }

  function handleSubmit() {
    if (!canSubmit) return;
    const userCorrect = multiAnswer
      ? selected.length === correctSet.size && selected.every((idx) => correctSet.has(idx))
      : correctSet.has(selected[0]);
    setStatus(userCorrect ? 'correct' : 'incorrect');
    setShowExplanation(!userCorrect || ALWAYS_SHOW_EXPLANATIONS);
  }

  function handleContinue() {
    if (onContinue) onContinue();
  }

  const difficultyLabel = (q.difficulty ?? '').toLowerCase();
  const badgeTopic = q.badge?.match(/\(([^)]+)\)/)?.[1]?.trim();
  const topicDisplay = (q.topic ?? '').trim();
  const headerLabelParts = [q.exam ?? 'GRE', q.section ?? 'Verbal'].filter(Boolean);
  const headerLabel = headerLabelParts.join(' · ');
  const cardTitle = topicDisplay || badgeTopic || headerLabel;
  const showHeaderLabel =
    Boolean(headerLabel) &&
    headerLabel.toLowerCase() !== cardTitle.toLowerCase();
  const stemMarkupRaw =
    ensureMathMarkup(q.stemHTML) ??
    ensureMathMarkup(q.stemLatex) ??
    q.stemHTML?.trim() ??
    q.stemLatex?.trim() ??
    'No stem available';
  const stemMarkup =
    stemMarkupRaw && !stemMarkupRaw.startsWith('<') && !stemMarkupRaw.startsWith('\\')
      ? `<p>${stemMarkupRaw}</p>`
      : stemMarkupRaw;
  const explanationMarkup = ensureMathMarkup(q.explainHTML) ?? q.explainHTML ?? '';

  const cardRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!cardRef.current) return;
    try {
      renderMathInElement(cardRef.current, {
        delimiters: [
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
        ignoredClasses: ['mathjax-pending', 'mathjax-svg'],
      });
    } catch (err) {
      console.error('[QuestionCardVerbal] KaTeX render failed', err);
    }
  }, [q.id, status, showExplanation]);
  useMathJax(cardRef, [q.id, status, showExplanation]);

  useEffect(() => {
    if (status === 'idle') return;
    if (lastLoggedStatusRef.current === status) return;

    const durationMs = Math.max(0, Date.now() - startTimeRef.current);
    const picked = selected.length
      ? [...selected].sort((a, b) => a - b)
      : [];
    const answerLabel = picked.length
      ? picked.map((idx) => String.fromCharCode(65 + idx)).join(',')
      : 'none';

    const payload = {
      questionId: String(q.id),
      isCorrect: status === 'correct',
      userAnswer: answerLabel,
      timeMs: durationMs,
      conceptOverride: q.topic ?? undefined,
    };

    lastLoggedStatusRef.current = status;
    const questionId = String(q.id);
    const attemptStatus: 'correct' | 'incorrect' = status === 'correct' ? 'correct' : 'incorrect';
    onAttemptLogged?.({ questionId, status: attemptStatus, phase: 'start' });

    fetch('/api/attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`attempt ${res.status}`);
        }
        try {
          const data = await res.clone().json();
          if (data && typeof data.ok === 'boolean' && data.ok !== true) {
            throw new Error('Attempt was not accepted by the server.');
          }
        } catch {
          // Ignore JSON parse errors; empty body still counts as success.
        }
        onAttemptLogged?.({ questionId, status: attemptStatus, phase: 'success' });
      })
      .catch((err) => {
        console.debug('[QuestionCardVerbal] failed to log attempt', err);
        const message = err instanceof Error ? err.message : 'Failed to log attempt.';
        onAttemptLogged?.({ questionId, status: attemptStatus, phase: 'error', error: message });
      });
  }, [selected, status, q.id, q.topic, onAttemptLogged]);

  return (
    <div className="question-card-wrapper">
      <div ref={cardRef} className="question-card-body">
        <div className="card-head">
          <div className="card-meta">
            {showHeaderLabel && <span className="card-sub">{headerLabel}</span>}
            <h2 className="card-title">{cardTitle}</h2>
          </div>
          {difficultyLabel && (
            <span className={`diff diff-${difficultyLabel}`}>
              <span className="dot" />
              {difficultyLabel}
            </span>
          )}
        </div>

        <div className="stem">
          <div
            className="rich-text"
            dangerouslySetInnerHTML={{ __html: stemMarkup ?? '<p>No stem available</p>' }}
          />
        </div>

        {multiAnswer && <p className="note">Select all that apply.</p>}

        <ul className="options">
          {q.options.map((op, i) => {
            const isSelected = selectedSet.has(i);
            const isCorrect = status !== 'idle' && correctSet.has(i);
            const isWrongSelection =
              status === 'incorrect' && isSelected && !correctSet.has(i);
            const optionClass = [
              'option',
              'choice-button',
              isSelected ? 'selected' : '',
              isCorrect ? 'correct' : '',
              isWrongSelection ? 'incorrect' : '',
              status !== 'idle' ? 'locked' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <li key={i}>
                <button
                  type="button"
                  className={optionClass}
                  onClick={() => toggleOption(i)}
                  disabled={status !== 'idle'}
                >
                  <span className="option-index">{String.fromCharCode(65 + i)}</span>
                  <span
                    className="option-text rich-text"
                    dangerouslySetInnerHTML={{
                      __html: optionMarkup(op, `Option ${i + 1}`),
                    }}
                  />
                </button>
              </li>
            );
          })}
        </ul>

        <div className="actions">
          <button
            type="button"
            className="submit"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            Submit Answer
          </button>
          {status !== 'idle' && q.explainHTML && (
            <button
              type="button"
              className="explain"
              onClick={() => setShowExplanation((prev) => !prev)}
            >
              {showExplanation ? 'Hide Explanation' : 'Show Explanation'}
            </button>
          )}
          {status === 'correct' && onContinue ? (
            <button type="button" className="continue" onClick={handleContinue}>
              Next Question
            </button>
          ) : null}
        </div>

        {status !== 'idle' && (
          <div className={`result ${status}`} role="status" aria-live="polite">
            <span>{status === 'correct' ? 'Correct!' : 'Incorrect.'}</span>
          </div>
        )}

        {explanationMarkup && showExplanation && (
          <div className="explanation">
            <div
              className="rich-text"
              dangerouslySetInnerHTML={{ __html: explanationMarkup }}
            />
          </div>
        )}
      </div>

      <style jsx>{`
        .question-card-wrapper {
          position: relative;
          width: 100%;
          margin: 0 auto;
          max-width: 840px;
        }
        .question-card-body {
          position: relative;
          border-radius: 26px;
          border: 1px solid rgba(196, 181, 253, 0.45);
          background: #ffffff;
          box-shadow: 0 18px 44px rgba(124, 58, 237, 0.12);
          padding: clamp(24px, 4vw, 32px);
        }
        .card-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }
        .card-sub {
          display: inline-block;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 12px;
          font-weight: 700;
          color: #7c3aed;
        }
        .card-title {
          margin: 6px 0 0;
          font-size: 24px;
          font-weight: 800;
          color: #312e81;
        }
        .diff {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .diff .dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: currentColor;
          opacity: 0.8;
        }
        .diff-hard { background:#fee2e2; color:#b91c1c; border:1px solid #fecaca; }
        .diff-medium { background:#ede9fe; color:#5b21b6; border:1px solid #ddd6fe; }
        .diff-easy { background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; }
        .stem {
          margin: 20px 0;
          font-size: 17px;
          line-height: 1.7;
          color: #312e81;
        }
        .note {
          margin: 4px 0 14px;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: #7c3aed;
        }
        .options {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 12px;
        }
        .option {
          width: 100%;
          text-align: left;
          padding: 14px 18px;
          border-radius: 16px;
          border: 1px solid transparent;
          background: #fff;
          display: flex;
          align-items: center;
          gap: 14px;
          cursor: pointer;
          transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
          box-shadow: 0 10px 24px rgba(59, 7, 100, 0.08);
        }
        .choice-button {
          background: rgba(255,255,255,0.96);
        }
        .option:hover:not(:disabled) {
          transform: translateY(-1px);
          background: #ede9fe;
          border-color: rgba(124, 58, 237, 0.35);
        }
        .option.selected {
          border-color: rgba(124, 58, 237, 0.55);
          background: #f3e8ff;
        }
        .option.correct {
          border-color: rgba(34, 197, 94, 0.55);
          background: #ecfdf5;
        }
        .option.incorrect {
          border-color: rgba(239, 68, 68, 0.35);
          background: #fef2f2;
        }
        .option.locked { cursor: default; opacity: 0.7; }
        .choice-button:hover:not(:disabled) {
          box-shadow:0 18px 30px rgba(124,58,237,0.18);
        }
        .option-index {
          display:inline-flex;
          align-items:center;
          justify-content:center;
          width:36px;
          height:36px;
          border-radius:999px;
          background:#fff;
          border:1px solid rgba(124, 58, 237, 0.4);
          font-weight:700;
          font-size:15px;
          color:#7c3aed;
          flex-shrink:0;
          box-shadow:0 8px 18px rgba(124, 58, 237, 0.18);
        }
        .option-text {
          display: inline-block;
          color:#1f2937;
          font-size:16px;
        }
        .actions {
          margin-top: 18px;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .submit {
          background: linear-gradient(135deg,#a855f7,#7c3aed);
          color: white;
          font-weight: 700;
          border: none;
          padding: 10px 22px;
          border-radius: 999px;
          cursor: pointer;
          box-shadow: 0 12px 26px rgba(124, 58, 237, 0.35);
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow:0 14px 32px rgba(124,58,237,0.45); }
        .submit:disabled { opacity: 0.4; cursor: not-allowed; }
        .explain, .continue {
          background: #fff;
          color: #7c3aed;
          border: 1px solid rgba(124, 58, 237, 0.35);
          padding: 10px 20px;
          font-weight: 600;
          border-radius: 999px;
          cursor: pointer;
          transition: background 0.18s ease, color 0.18s ease;
        }
        .explain:hover, .continue:hover { background:#ede9fe; }
        .result {
          margin-top: 14px;
          font-weight: 700;
          display: inline-flex;
          gap: 12px;
          align-items: center;
          padding:8px 16px;
          border-radius:999px;
          background: #fff;
          border:1px solid rgba(196, 181, 253, 0.35);
          color:#5b21b6;
        }
        .result.correct { color: #15803d; border-color: rgba(34, 197, 94, 0.35); }
        .result.incorrect { color: #b91c1c; border-color: rgba(239, 68, 68, 0.35); }
        .explanation {
          border-radius: 18px;
          background: #fff;
          border: 1px solid rgba(196, 181, 253, 0.4);
          padding: 20px;
          margin-top: 18px;
          font-size: 16px;
          line-height: 1.8;
          box-shadow: inset 0 0 0 1px rgba(237, 233, 254, 0.6);
        }
        .explanation :global(.katex){ font-size: 1.12em; line-height: 1.6; }
        .explanation :global(.katex-display){
          margin: 14px 0;
          padding: 12px 14px;
          border-radius: 12px;
          background: #eef2ff;
          border: 1px solid rgba(79,70,229,0.15);
        }
        .rich-text :global(p) { margin: 0 0 0.75rem; }
        .rich-text :global(ul),
        .rich-text :global(ol) { margin: 0.5rem 0 0.5rem 1.25rem; }
        .rich-text :global(li + li) { margin-top: 0.35rem; }
        .rich-text :global(strong) { font-weight: 700; }
        .rich-text :global(em) { font-style: italic; }
        .rich-text :global(code) {
          background: rgba(167, 139, 250, 0.12);
          padding: 0.1rem 0.3rem;
          border-radius: 6px;
          font-size: 0.9em;
        }
      `}</style>
    </div>
  );
}
