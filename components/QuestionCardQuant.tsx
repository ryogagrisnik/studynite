'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { QuestionPayload } from '@/lib/types/question';
// @ts-ignore - auto-render lacks bundled types
import renderMathInElement from 'katex/contrib/auto-render/auto-render';
import { renderMathToHtml } from '@/lib/math/renderMathToHtml';
import { normalizeLooseTex } from '@/lib/math/normalizeLooseTex';
import type { AttemptLogEvent } from './questionCardEvents';
import { useMathJax } from './useMathJax';

type Status = 'idle' | 'correct' | 'incorrect';

type Props = {
  q: QuestionPayload;
  onContinue?: () => void;
  onAttemptLogged?: (event: AttemptLogEvent) => void;
};

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
  if (display) return `\\[${trimmed}\\]`;
  return `\\(${trimmed}\\)`;
}

function sanitizeLooseMath(raw: string): string {
  let text = raw.trim();
  if (!text) return text;

const replacements: Array<[RegExp, string | ((...groups: string[]) => string)]> = [
    [/\brac\s*\{/gi, '\\frac{'],
    [/\\+frac/g, '\\frac'],
    [/\\+sqrt/g, '\\sqrt'],
    [/\bsqrt\s*\{/gi, '\\sqrt{'],
    [/\\+pi\b/gi, '\\pi'],
    [/\bpi\b/gi, '\\pi'],
    [/\\+theta\b/gi, '\\theta'],
    [/\btheta\b/gi, '\\theta'],
    [/\\+times/g, '\\times'],
    [/\btimes\b/g, '\\times'],
    [/\\+cdot/g, '\\cdot'],
    [/\bcdot\b/g, '\\cdot'],
    [/\\+div/g, '\\div'],
    [/\bdiv\b/g, '\\div'],
    [/\\+pm/g, '\\pm'],
    [/\bpm\b/g, '\\pm'],
    [/\\+leq/g, '\\leq'],
    [/\bleq\b/g, '\\leq'],
    [/\\+geq/g, '\\geq'],
    [/\bgeq\b/g, '\\geq'],
    [/\\+neq/g, '\\neq'],
    [/\bneq\b/g, '\\neq'],
    [/\\+approx/g, '\\approx'],
    [/\bapprox\b/g, '\\approx'],
    [/√\s*\(/g, '\\sqrt('],
    [/([A-Za-z0-9])\s*\^\s*\(([^)]+)\)/g, (_m, base, inner) => `${base}^{${inner.trim()}}`],
    [/([A-Za-z0-9])\s*\^\s*([0-9]+)/g, (_m, base, exponent) => `${base}^{${exponent}}`],
    [/([A-Za-z0-9])\s*_\s*\(([^)]+)\)/g, (_m, base, inner) => `${base}_{${inner.trim()}}`],
    [/([A-Za-z0-9])\s*_\s*([0-9]+)/g, (_m, base, lower) => `${base}_{${lower}}`],
    [/°/g, '^{\\circ}'],
  ];

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement as any);
  }

  text = text.replace(/\bC\s*\(\s*([^)]+)\s*\)/g, (_m, inner) => `\\binom{${inner.replace(/\s*,\s*/, '}{')}}`);
  text = text.replace(/\(\s*(\d+)\s*\/\s*(\d+)\s*\)/g, (_m, num, den) => `\\frac{${num}}{${den}}`);

  return text.trim();
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
    const sanitized = sanitizeLooseMath(trimmed);
    if (!sanitized) return sanitized;
    if (/\\/.test(sanitized) || /[\^_]/.test(sanitized)) {
      candidate = cleanInvalidInlineMathSegments(wrapLatex(sanitized, display));
    } else {
      candidate = cleanInvalidInlineMathSegments(sanitized);
    }
  }
  if (!candidate) return candidate;
  const normal = normalizeLooseTex(candidate);
  return renderMathToHtml(normal) ?? normal;
}

function toHtml(option: QuestionPayload['options'][number], fallback: string): string {
  if (!option) return fallback;
  const html = typeof option.html === 'string' ? option.html.trim() : '';
  const latex = typeof option.latex === 'string' ? option.latex.trim() : '';
  if (html.length > 0) {
    const normalized = ensureMathMarkup(html);
    return normalized ?? html;
  }
  if (latex.length > 0) {
    const wrapped = ensureMathMarkup(latex);
    return wrapped ?? fallback;
  }
  return fallback;
}

function useAutoRender(deps: React.DependencyList) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      renderMathInElement(ref.current, {
        delimiters: [
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
        ignoredClasses: ['mathjax-pending', 'mathjax-svg'],
      });
    } catch (err) {
      console.error('[QuestionCardQuant] KaTeX render failed', err);
    }
  }, deps);
  useMathJax(ref, deps);
  return ref;
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

export default function QuestionCardQuant({ q, onContinue, onAttemptLogged }: Props) {
  const [selected, setSelected] = useState<number[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [showExplanation, setShowExplanation] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const lastLoggedStatusRef = useRef<Status | null>(null);

  // reset when question changes
  useEffect(() => {
    setSelected([]);
    setStatus('idle');
    setShowExplanation(false);
    startTimeRef.current = Date.now();
    lastLoggedStatusRef.current = null;
  }, [q.id]);

  const correctSet = useMemo(() => new Set(q.correct ?? []), [q.correct]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const multiAnswer = (q.correct ?? []).length > 1;

  const options = q.options ?? [];
  const quantityA = typeof q.quantityA === 'string' ? q.quantityA : undefined;
  const quantityB = typeof q.quantityB === 'string' ? q.quantityB : undefined;
  const isQuantComparison =
    q.kind === 'qc' || Boolean(quantityA || quantityB || (q.topic ?? '').toLowerCase().includes('quantitative comparison'));
  const stemMarkupRaw =
    ensureMathMarkup(q.stemHTML) ??
    ensureMathMarkup(q.stemLatex) ??
    q.stemHTML?.trim() ??
    q.stemLatex?.trim() ??
    'Question prompt unavailable.';
  const stemMarkup =
    stemMarkupRaw && !stemMarkupRaw.startsWith('<') && !stemMarkupRaw.startsWith('\\')
      ? `<p>${stemMarkupRaw}</p>`
      : stemMarkupRaw;
  const quantityAHtml = ensureMathMarkup(quantityA, true);
  const quantityBHtml = ensureMathMarkup(quantityB, true);
  const explanationMarkup = ensureMathMarkup(q.explainHTML) ?? q.explainHTML ?? '';

  function toggleOption(idx: number) {
    if (!multiAnswer) {
      const nextSelected = [idx];
      setSelected(nextSelected);
      const isCorrect = correctSet.has(idx);
      setStatus(isCorrect ? 'correct' : 'incorrect');
      setShowExplanation(false);
      return;
    }

    setSelected((prev) => {
      const exists = prev.includes(idx);
      const next = exists ? prev.filter((n) => n !== idx) : [...prev, idx];
      return next;
    });
    setStatus('idle');
    setShowExplanation(false);
  }

  function handleSubmit() {
    if (!multiAnswer || selected.length === 0) return;
    const userCorrect =
      selected.length === correctSet.size &&
      selected.every((idx) => correctSet.has(idx));
    setStatus(userCorrect ? 'correct' : 'incorrect');
    setShowExplanation(false);
  }

  function handleContinue() {
    if (onContinue) onContinue();
  }

  const canSubmit = multiAnswer && selected.length > 0 && status !== 'correct';
  const showResult = status !== 'idle';
  const disableOptions = status === 'correct';

  const difficultyLabel = (q.difficulty ?? '').toLowerCase();
  const difficultyDisplay =
    difficultyLabel === 'hard'
      ? 'Hard'
      : difficultyLabel === 'easy'
      ? 'Easy'
      : difficultyLabel === 'medium'
      ? 'Medium'
      : null;
  const difficultyTone =
    difficultyLabel === 'hard'
      ? 'diff-badge diff-badge--hard'
      : difficultyLabel === 'easy'
      ? 'diff-badge diff-badge--easy'
      : 'diff-badge diff-badge--medium';

  const badgeTopic = q.badge?.match(/\(([^)]+)\)/)?.[1]?.trim();
  const topicDisplay = (q.topic ?? '').trim();
  const headerLabelParts = [q.exam ?? 'GRE', q.section ?? 'Quant'].filter(Boolean);
  const headerLabel = headerLabelParts.join(' · ');
  const cardTitle = topicDisplay || badgeTopic || headerLabel;
  const showHeaderLabel =
    Boolean(headerLabel) &&
    headerLabel.toLowerCase() !== cardTitle.toLowerCase();

  const cardRef = useAutoRender([q.id, status, showExplanation]);

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
        console.debug('[QuestionCardQuant] failed to log attempt', err);
        const message = err instanceof Error ? err.message : 'Failed to log attempt.';
        onAttemptLogged?.({ questionId, status: attemptStatus, phase: 'error', error: message });
      });
  }, [selected, status, q.id, q.topic, onAttemptLogged]);

  return (
    <div className="question-card-wrapper">
      <div ref={cardRef} className="question-card-body">
        <div className="card-section card-section--header">
          <div className="card-header">
            <div className="card-meta">
              {showHeaderLabel && <span className="card-topic">{headerLabel}</span>}
              <h2 className="card-title">{cardTitle}</h2>
            </div>
            {difficultyDisplay && (
              <span className={difficultyTone}>
                <span className="diff-dot" />
                {difficultyDisplay}
              </span>
            )}
          </div>

          <div className="card-stem rich-text">
            <div dangerouslySetInnerHTML={{ __html: stemMarkup ?? '<p>Question prompt unavailable.</p>' }} />
          </div>
        </div>

      {isQuantComparison && (quantityA || quantityB) && (
        <div className="card-section card-section--comparison">
          <div className="comparison-grid">
            <div className="comparison-panel">
              <div className="comparison-label">Quantity A</div>
              <div className="comparison-copy rich-text">
                <div dangerouslySetInnerHTML={{ __html: quantityAHtml ?? '—' }} />
              </div>
            </div>
            <div className="comparison-panel">
              <div className="comparison-label">Quantity B</div>
              <div className="comparison-copy rich-text">
                <div dangerouslySetInnerHTML={{ __html: quantityBHtml ?? '—' }} />
              </div>
            </div>
          </div>
        </div>
      )}

        {!!options.length && (
          <div className="card-section card-section--options">
            {multiAnswer && (
              <div className="multi-label">Select all that apply</div>
            )}
            <ul className="option-list">
              {options.map((op, i) => {
                const isSelected = selectedSet.has(i);
                const isCorrectOption = status === 'correct' && correctSet.has(i);
                const isWrongSelection =
                  status === 'incorrect' && isSelected && !correctSet.has(i);

                let stateClasses = 'option-button--idle';
                if (isSelected) stateClasses = 'option-button--selected';
                if (isCorrectOption) stateClasses = 'option-button--correct';
                if (isWrongSelection) stateClasses = 'option-button--incorrect';

                return (
                  <li key={op.id ?? i}>
                    <button
                      type="button"
                      onClick={() => toggleOption(i)}
                      disabled={disableOptions}
                      className={['option-button', stateClasses].join(' ')}
                    >
                      <span className="option-bullet">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="option-copy rich-text">
                        <span
                          dangerouslySetInnerHTML={{
                            __html: toHtml(op, `Option ${i + 1}`),
                          }}
                        />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="card-section card-section--actions">
          <div className="action-buttons">
            {multiAnswer && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="action-btn action-btn--primary"
              >
                Submit Answer
              </button>
            )}
            {status === 'correct' && onContinue && (
              <button
                type="button"
                onClick={handleContinue}
                className="action-btn action-btn--secondary"
              >
                Next Question
              </button>
            )}
            {showResult && explanationMarkup && (
              <button
                type="button"
                onClick={() => setShowExplanation((prev) => !prev)}
                className="action-btn action-btn--ghost"
              >
                {showExplanation ? 'Hide Explanation' : 'Show Explanation'}
              </button>
            )}
          </div>

          {showResult && (
            <div
              className={`result-bubble result-bubble--${status}`}
              role="status"
              aria-live="polite"
            >
              {status === 'correct'
                ? 'Correct! Nice work.'
                : 'Incorrect. Review the explanation below.'}
            </div>
          )}
        </div>

        {showResult && showExplanation && explanationMarkup && (
          <div className="card-section card-section--explanation">
            <div className="rich-text explanation-box">
              <div dangerouslySetInnerHTML={{ __html: explanationMarkup }} />
            </div>
          </div>
        )}
      </div>
      <style jsx>{`
        .question-card-wrapper {
          position: relative;
          width: 100%;
          margin: 0 auto;
          max-width: 780px;
        }
        .question-card-body {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
          border-radius: 24px;
          border: 1px solid rgba(249, 177, 84, 0.28);
          background: #ffffff;
          box-shadow: 0 18px 46px rgba(249, 177, 84, 0.16);
          overflow: hidden;
        }
        .card-section {
          width: 100%;
          padding: clamp(20px, 4vw, 28px) clamp(22px, 4.5vw, 32px);
        }
        .card-section + .card-section {
          border-top: 1px solid rgba(249, 177, 84, 0.16);
        }
        .card-section--header {
          padding-bottom: clamp(16px, 3.6vw, 22px);
          display: grid;
          gap: clamp(14px, 3vw, 20px);
        }
        .card-section--comparison {
          padding-top: clamp(10px, 3.4vw, 18px);
        }
        .card-section--options {
          padding-top: clamp(16px, 4vw, 24px);
        }
        .card-section--actions {
          padding-top: clamp(14px, 3.6vw, 20px);
          display: flex;
          flex-direction: column;
        }
        .card-header {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }
        .card-meta {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .card-topic {
          display: inline-block;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 12px;
          font-weight: 700;
          color: #ea580c;
        }
        .card-title {
          margin: 0;
          font-size: clamp(21px, 3.2vw, 26px);
          font-weight: 800;
          color: #431407;
        }
        .diff-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 14px;
          padding: 6px 14px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          border: 1px solid transparent;
        }
        .diff-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: currentColor;
          opacity: 0.75;
        }
        .diff-badge--hard {
          background: rgba(254, 226, 226, 0.9);
          color: #b91c1c;
          border-color: rgba(254, 202, 202, 0.8);
        }
        .diff-badge--medium {
          background: rgba(253, 230, 138, 0.32);
          color: #b45309;
          border-color: rgba(253, 224, 71, 0.6);
        }
        .diff-badge--easy {
          background: rgba(187, 247, 208, 0.8);
          color: #047857;
          border-color: rgba(167, 243, 208, 0.7);
        }
        .card-stem {
          margin: 0;
          padding: 0;
          font-size: 16px;
          line-height: 1.7;
          color: #4a1f07;
        }
        .comparison-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          background: #fffaf3;
          border-radius: 18px;
          border: 1px solid rgba(249, 177, 84, 0.26);
          padding: clamp(16px, 3.6vw, 22px);
        }
        .comparison-panel {
          border-radius: 14px;
          border: 1px solid rgba(249, 177, 84, 0.22);
          background: #ffffff;
          box-shadow: 0 8px 20px rgba(249, 177, 84, 0.12);
          padding: 16px;
        }
        .comparison-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          font-weight: 700;
          color: #ea580c;
        }
        .comparison-copy {
          margin-top: 12px;
          font-size: 15px;
          color: #431407;
          line-height: 1.6;
        }
        .multi-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 12px;
          border: 1px solid rgba(249, 177, 84, 0.28);
          background: #fff2e0;
          color: #9a3412;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          padding: 6px 16px;
          margin-bottom: 16px;
        }
        .multi-label::before {
          content: '';
          width: 5px;
          height: 5px;
          border-radius: 999px;
          background: currentColor;
          opacity: 0.6;
        }
        .option-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 14px;
        }
        .option-button {
          width: 100%;
          display: flex;
          align-items: flex-start;
          gap: 16px;
          text-align: left;
          border-radius: 18px;
          border: 1px solid transparent;
          padding: 16px 20px;
          background: #ffffff;
          box-shadow: 0 10px 24px rgba(249, 177, 84, 0.12);
          transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background 0.16s ease;
          cursor: pointer;
          font-size: 15px;
          line-height: 1.55;
          color: #431407;
        }
        .option-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 14px 28px rgba(249, 177, 84, 0.18);
        }
        .option-button:focus-visible {
          outline: 0;
          box-shadow: 0 0 0 2px rgba(249, 177, 84, 0.4), 0 14px 32px rgba(249, 177, 84, 0.2);
        }
        .option-button:disabled {
          cursor: default;
          opacity: 0.68;
        }
        .option-button--idle {
          border-color: rgba(249, 177, 84, 0.18);
        }
        .option-button--selected {
          border-color: rgba(249, 115, 22, 0.34);
          background: #fff4e5;
        }
        .option-button--correct {
          border-color: rgba(16, 185, 129, 0.4);
          background: #ecfdf5;
          box-shadow: 0 12px 26px rgba(16, 185, 129, 0.18);
        }
        .option-button--incorrect {
          border-color: rgba(239, 68, 68, 0.34);
          background: #fef2f2;
        }
        .option-bullet {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 34px;
          width: 34px;
          border-radius: 999px;
          border: 1px solid rgba(249, 115, 22, 0.3);
          background: #fff4e5;
          color: #f97316;
          font-weight: 700;
          font-size: 0.95rem;
          box-shadow: 0 8px 16px rgba(249, 177, 84, 0.22);
          flex-shrink: 0;
          margin-top: 2px;
        }
        .option-copy {
          flex: 1;
          min-width: 0;
        }
        .option-copy :global(p) {
          margin: 0 0 0.65rem;
        }
        .option-copy :global(p:last-child) {
          margin-bottom: 0;
        }
        .action-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
        }
        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 16px;
          padding: 9px 20px;
          font-weight: 600;
          font-size: 0.92rem;
          border: 1px solid transparent;
          cursor: pointer;
          transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease, color 0.16s ease, border-color 0.16s ease;
        }
        .action-btn--primary {
          background: #f97316;
          color: #fff;
          box-shadow: 0 12px 26px rgba(249, 115, 22, 0.3);
        }
        .action-btn--primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 16px 30px rgba(249, 115, 22, 0.36);
        }
        .action-btn--primary:disabled {
          opacity: 0.42;
          cursor: not-allowed;
        }
        .action-btn--secondary {
          background: #fff6ed;
          color: #f97316;
          border-color: rgba(249, 115, 22, 0.36);
          box-shadow: 0 8px 18px rgba(249, 177, 84, 0.16);
        }
        .action-btn--secondary:hover {
          background: #ffeee0;
          transform: translateY(-1px);
        }
        .action-btn--ghost {
          background: #ffffff;
          color: #b45309;
          border-color: rgba(249, 177, 84, 0.3);
        }
        .action-btn--ghost:hover {
          background: #fff2e0;
        }
        .result-bubble {
          margin-top: 18px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          border-radius: 999px;
          padding: 9px 18px;
          font-weight: 600;
          font-size: 0.95rem;
          background: #fffdf9;
          border: 1px solid rgba(249, 177, 84, 0.3);
          color: #5f370e;
          box-shadow: 0 8px 20px rgba(249, 177, 84, 0.14);
        }
        .result-bubble--correct {
          color: #0f766e;
          border-color: rgba(16, 185, 129, 0.4);
        }
        .result-bubble--incorrect {
          color: #b91c1c;
          border-color: rgba(239, 68, 68, 0.4);
        }
        .card-section--explanation {
          padding-top: clamp(12px, 4vw, 22px);
        }
        .explanation-box {
          border-radius: 18px;
          border: 1px solid rgba(249, 177, 84, 0.24);
          background: #fffaf3;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
          padding: clamp(18px, 3.8vw, 26px);
          font-size: 16px;
          line-height: 1.8;
          color: #431407;
        }
        .explanation-box :global(.katex){ font-size: 1.14em; line-height: 1.6; }
        .explanation-box :global(.katex-display){
          margin: 14px 0;
          padding: 12px 14px;
          border-radius: 12px;
          background: #f3f4f6;
          border: 1px solid rgba(0,0,0,0.06);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.6);
        }
        .rich-text {
          word-break: break-word;
        }
        .rich-text :global(p) {
          margin: 0 0 0.75rem;
        }
        .rich-text :global(ul),
        .rich-text :global(ol) {
          margin: 0.5rem 0 0.5rem 1.25rem;
        }
        .rich-text :global(li + li) {
          margin-top: 0.35rem;
        }
        .rich-text :global(strong) {
          font-weight: 700;
        }
        .rich-text :global(em) {
          font-style: italic;
        }
        .rich-text :global(code) {
          background: rgba(251, 191, 36, 0.12);
          padding: 0.1rem 0.3rem;
          border-radius: 6px;
          font-size: 0.9em;
        }
        .rich-text :global(.math-block) {
          margin: 0 0 1rem;
          text-align: center;
          font-size: 1.04em;
        }
        .rich-text :global(.math-block:last-child) {
          margin-bottom: 0;
        }
        @media (max-width: 640px) {
          .card-section {
            padding: 20px 18px;
          }
          .card-stem {
            padding: 20px;
          }
          .action-buttons {
            flex-direction: column;
            align-items: stretch;
          }
          .action-btn {
            justify-content: center;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
