'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import QuestionCard, { AttemptLogEvent } from '@/components/QuestionCard';
import type { QuestionPayload } from '@/lib/types/question';
import {
  applyAttemptLogEvent,
  clearAttempt,
  markAttemptSuccess,
  shouldDequeue,
  type AttemptLogMap,
} from '@/lib/missedAttemptLog';

type MissedAttempt = {
  id: string;
  question: QuestionPayload;
  lastMissedAt: string;
  exam: string;
  section: string;
  topic?: string | null;
  attempts: number;
};

type GroupKey = string;

type MissedGroup = {
  key: GroupKey;
  label: string;
  items: MissedAttempt[];
};

const PILL_OPTIONS = [
  { value: 'exam', label: 'By Exam' },
  { value: 'section', label: 'By Section' },
  { value: 'topic', label: 'By Topic' },
] as const;

type ViewMode = (typeof PILL_OPTIONS)[number]['value'];

export default function MissedPage() {
  const [view, setView] = useState<ViewMode>('topic');
  const [loading, setLoading] = useState(true);
  const [missed, setMissed] = useState<MissedAttempt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [trackingUnavailable, setTrackingUnavailable] = useState(false);
  const [activeGroupKey, setActiveGroupKey] = useState<GroupKey | null>(null);
  const [attemptLogMap, setAttemptLogMap] = useState<AttemptLogMap>({});
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [clearError, setClearError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      setTrackingUnavailable(false);
      setLocked(false);
      try {
        const res = await fetch('/api/missed');
        if (res.status === 401) {
          if (!isMounted) return;
          setLocked(true);
          setMissed([]);
          setTrackingUnavailable(false);
          setError(null);
          return;
        }
        if (!res.ok) throw new Error(`missed ${res.status}`);
        const payload = await res.json();
        if (!isMounted) return;
        setTrackingUnavailable(Boolean(payload?.missingTable));
        setMissed(payload?.missed ?? []);
      } catch (err: any) {
        if (!isMounted) return;
        setTrackingUnavailable(false);
        setError(err?.message ?? 'Failed to load missed questions.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  const grouped = useMemo(() => groupMissed(missed, view), [missed, view]);

  useEffect(() => {
    if (grouped.length === 0) {
      setActiveGroupKey(null);
      return;
    }
    if (!activeGroupKey || !grouped.some((group) => group.key === activeGroupKey)) {
      setActiveGroupKey(grouped[0]!.key);
    }
  }, [grouped, activeGroupKey]);

  const activeGroup =
    grouped.find((group) => group.key === activeGroupKey) ?? (grouped.length ? grouped[0] : null);
  const currentAttempt = activeGroup?.items[0] ?? null;
  const hasAnyMissed = missed.length > 0;
  const remainingInActiveGroup = activeGroup?.items.length ?? 0;
  const activeGroupLabel = activeGroup?.label ?? 'this group';

  const updateAttemptLog = useCallback((event: AttemptLogEvent) => {
    setAttemptLogMap((prev) => {
      const { map, error: attemptError } = applyAttemptLogEvent(prev, event);
      if (event.phase === 'start') {
        setClearError(null);
      } else if (attemptError) {
        setClearError(attemptError);
      } else if (event.phase === 'success') {
        setClearError(null);
      }
      return map;
    });
  }, []);

  const removeQuestionFromState = useCallback((questionId: string) => {
    setMissed((prev) => prev.filter((item) => item.id !== questionId));
    setAttemptLogMap((prev) => clearAttempt(prev, questionId));
    setClearError(null);
    setClearingId(null);
  }, []);

  const confirmAttemptAndClear = useCallback(
    async (attempt: MissedAttempt) => {
      const questionId = String(attempt.id);
      setClearError(null);

      if (shouldDequeue(attemptLogMap, questionId)) {
        removeQuestionFromState(questionId);
        return;
      }

      setClearingId(questionId);
      try {
        const res = await fetch('/api/attempt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId,
            userAnswer: 'review-advance',
            isCorrect: true,
            timeMs: 0,
            conceptOverride: attempt.question.topic ?? undefined,
          }),
        });
        if (!res.ok) {
          throw new Error(`attempt ${res.status}`);
        }
        try {
          const data = await res.clone().json();
          if (data && typeof data.ok === 'boolean' && data.ok !== true) {
            throw new Error('Server did not confirm the attempt.');
          }
        } catch {
          // Ignore JSON parsing issues for empty bodies.
        }
        setAttemptLogMap((prev) => markAttemptSuccess(prev, questionId));
        removeQuestionFromState(questionId);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message || 'Failed to confirm attempt.'
            : 'Failed to confirm attempt.';
        setAttemptLogMap((prev) => applyAttemptLogEvent(prev, {
          questionId,
          status: 'correct',
          phase: 'error',
          error: message,
        }).map);
        setClearError(message);
      } finally {
        setClearingId((current) => (current === questionId ? null : current));
      }
    },
    [attemptLogMap, removeQuestionFromState]
  );

  const handleAdvanceClick = useCallback(() => {
    if (!currentAttempt) return;
    if (clearingId === currentAttempt.id) return;
    void confirmAttemptAndClear(currentAttempt);
  }, [clearingId, confirmAttemptAndClear, currentAttempt]);

  const handleRetry = useCallback(() => {
    if (!currentAttempt) return;
    if (clearingId === currentAttempt.id) return;
    void confirmAttemptAndClear(currentAttempt);
  }, [clearingId, confirmAttemptAndClear, currentAttempt]);

  return (
    <div className="page-shell">
      <div className="page">
        <header className="header">
          <div>
            <h1 className="title">Review Your Misses</h1>
            <p className="subtitle">
              Tackle the questions you missed, grouped by concept. Learn fast, master faster.
            </p>
          </div>
          <Link href="/practice" className="cta">
            Jump to Practice
          </Link>
        </header>

        <section className="pill-row" role="radiogroup" aria-label="Group missed questions">
          {PILL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={['pill', view === opt.value ? 'pill--active' : ''].join(' ')}
              onClick={() => setView(opt.value)}
              role="radio"
              aria-checked={view === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </section>

        {loading && (
          <div className="card card--empty" role="status" aria-live="polite">
            Fetching your missed questions…
          </div>
        )}

        {!loading && error && (
          <div className="card card--error" role="alert">
            <strong>We couldn’t load your missed questions.</strong>
            <span>{error}</span>
            <button type="button" onClick={() => location.reload()} className="retry">
              Try again
            </button>
          </div>
        )}

        {!loading && !error && !locked && trackingUnavailable && (
          <div className="card card--warning" role="status">
            <h2>Missed-question tracking isn’t ready yet.</h2>
            <p>
              Apply the latest database migration (the one that adds the <code>MissedQuestion</code> table)
              and refresh this page to start saving misses for review.
            </p>
            <p>
              Once the table exists, any new incorrect attempt will land here automatically.
            </p>
          </div>
        )}

        {!loading && !error && locked && (
          <div className="card card--locked" role="status">
            <h2>Missed review is a Pro feature.</h2>
            <p>
              Sign in and upgrade to unlock your saved misses. You can still tackle 15 practice questions a day for free—no login required.
            </p>
            <div className="card__actions">
              <Link href="/pricing" className="card__cta">
                View plans
              </Link>
              <Link href="/practice" className="card__link">
                Back to Practice
              </Link>
            </div>
          </div>
        )}

        {!loading && !error && !locked && !trackingUnavailable && !hasAnyMissed && (
          <div className="card card--empty" role="status">
            <h2>Practice more to queue missed questions.</h2>
            <p>
              You’re all caught up on missed questions. Jump into <Link href="/practice">practice</Link> to add new
              attempts, then come back to review them one by one.
            </p>
          </div>
        )}

        {!loading && !error && !locked && !trackingUnavailable && hasAnyMissed && (
          <>
            <section className="group-selector" role="tablist" aria-label="Choose review group">
              {grouped.map((group) => {
                const isActive = group.key === (activeGroup?.key ?? null);
                return (
                  <button
                    key={group.key}
                    type="button"
                    className={['group-chip', isActive ? 'group-chip--active' : ''].join(' ')}
                    onClick={() => setActiveGroupKey(group.key)}
                    aria-pressed={isActive}
                  >
                    <span className="group-chip__label">{group.label}</span>
                    <span className="group-chip__count">
                      {group.items.length} {group.items.length === 1 ? 'question' : 'questions'}
                    </span>
                  </button>
                );
              })}
            </section>

            <section className="review-stage">
              {currentAttempt ? (
                <>
                  <div className="review-meta">
                    <div className="review-meta__info">
                      <span className="review-meta__label">{activeGroupLabel}</span>
                      <span className="review-meta__detail">
                        Last missed {timeAgo(currentAttempt.lastMissedAt)} · Missed {currentAttempt.attempts}×
                      </span>
                    </div>
                    <div className="review-meta__actions">
                      <span className="review-meta__count">
                        {remainingInActiveGroup} {remainingInActiveGroup === 1 ? 'question left' : 'questions left'}
                      </span>
                      {activeGroup && (
                        <button
                          type="button"
                          className="review-meta__link"
                          onClick={() => practiceGroup(activeGroup)}
                        >
                          Open in Practice
                        </button>
                      )}
                    </div>
                  </div>
                  <QuestionCard
                    question={currentAttempt.question}
                    onContinue={handleAdvanceClick}
                    onAttemptLogged={updateAttemptLog}
                  />
                  {(clearingId === currentAttempt.id || clearError) && (
                    <div
                      className={`review-alert ${
                        clearError ? 'review-alert--error' : 'review-alert--pending'
                      }`}
                      role={clearError ? 'alert' : 'status'}
                    >
                      {clearError ? (
                        <div className="review-alert__row">
                          <span>{clearError}</span>
                          <button
                            type="button"
                            className="review-alert__retry"
                            onClick={handleRetry}
                          >
                            Try again
                          </button>
                        </div>
                      ) : (
                        'Saving your result…'
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="card card--empty" role="status">
                  <h2>All clear in {activeGroupLabel}.</h2>
                  <p>
                    Pick another group above or head back to <Link href="/practice">practice</Link> to add more misses.
                  </p>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <style jsx>{`
        .page-shell {
          padding: clamp(28px, 5vw, 48px) 16px clamp(80px, 10vw, 120px);
        }
        .page {
          max-width: 1080px;
          margin: 0 auto;
          display: grid;
          gap: clamp(24px, 5vw, 40px);
        }
        .header {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 18px;
          align-items: center;
        }
        .title {
          margin: 0;
          font-size: clamp(34px, 5vw, 46px);
          font-weight: 800;
          color: #431407;
        }
        .subtitle {
          margin: 8px 0 0;
          font-size: 16px;
          line-height: 1.6;
          color: rgba(67, 20, 7, 0.76);
          max-width: 540px;
        }
        .cta {
          border-radius: 999px;
          padding: 10px 22px;
          background: linear-gradient(135deg, #f97316, #fb923c);
          color: #fff;
          font-weight: 700;
          text-decoration: none;
          box-shadow: 0 12px 28px rgba(249, 115, 22, 0.28);
          transition: transform 0.16s ease, box-shadow 0.16s ease;
        }
        .cta:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 34px rgba(249, 115, 22, 0.36);
        }
        .pill-row {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          background: #fff6ed;
          padding: 6px;
          gap: 6px;
        }
        .pill {
          border: none;
          border-radius: 999px;
          padding: 8px 18px;
          font-size: 13px;
          font-weight: 600;
          color: #9a3412;
          background: transparent;
          cursor: pointer;
          transition: background 0.16s ease, color 0.16s ease, transform 0.16s ease;
        }
        .pill:hover {
          background: rgba(249, 177, 84, 0.25);
          transform: translateY(-1px);
        }
        .pill--active {
          background: #f97316;
          color: #fff;
          box-shadow: 0 10px 20px rgba(249, 115, 22, 0.32);
        }
        .card {
          border-radius: 24px;
          border: 1px solid rgba(249, 177, 84, 0.24);
          background: #fffaf3;
          padding: clamp(24px, 4vw, 30px);
          box-shadow: 0 18px 42px rgba(249, 177, 84, 0.16);
          display: grid;
          gap: 8px;
          color: #431407;
        }
        .card--empty {
          text-align: center;
          justify-items: center;
        }
        .card--error {
          background: #fef2f2;
          border-color: rgba(239, 68, 68, 0.36);
          box-shadow: 0 20px 42px rgba(239, 68, 68, 0.18);
        }
        .card--warning {
          background: #fff7ed;
          border-color: rgba(234, 88, 12, 0.34);
          box-shadow: 0 18px 40px rgba(234, 88, 12, 0.16);
        }
        .card--locked {
          background: #fdf4ff;
          border-color: rgba(168, 85, 247, 0.3);
          box-shadow: 0 18px 42px rgba(168, 85, 247, 0.18);
          text-align: left;
        }
        .card__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 8px;
        }
        .card__cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 9px 20px;
          font-weight: 600;
          color: #fff;
          background: linear-gradient(135deg, #a855f7, #6366f1);
          text-decoration: none;
          box-shadow: 0 12px 28px rgba(99, 102, 241, 0.26);
          transition: transform 0.16s ease, box-shadow 0.16s ease;
        }
        .card__cta:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 32px rgba(99, 102, 241, 0.32);
        }
        .card__link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 8px 18px;
          font-weight: 600;
          color: #7c3aed;
          border: 1px solid rgba(124, 58, 237, 0.32);
          background: #fff;
          text-decoration: none;
          transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
        }
        .card__link:hover {
          transform: translateY(-1px);
          background: #faf5ff;
          box-shadow: 0 12px 26px rgba(168, 85, 247, 0.16);
        }
        .retry {
          border-radius: 999px;
          border: none;
          padding: 8px 18px;
          font-weight: 600;
          color: #fff;
          background: linear-gradient(135deg, #ef4444, #f97316);
          cursor: pointer;
          box-shadow: 0 12px 28px rgba(249, 115, 22, 0.24);
        }
        .group-selector {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          padding: 14px;
          border-radius: 24px;
          background: #fff6ed;
        }
        .group-chip {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          min-width: 180px;
          padding: 12px 18px;
          border-radius: 18px;
          border: 1px solid rgba(249, 177, 84, 0.24);
          background: rgba(255, 255, 255, 0.82);
          color: #9a3412;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.16s ease, background 0.16s ease, box-shadow 0.16s ease, border 0.16s ease;
        }
        .group-chip:hover {
          transform: translateY(-1px);
          background: #ffffff;
          border-color: rgba(249, 177, 84, 0.4);
          box-shadow: 0 12px 28px rgba(249, 177, 84, 0.18);
        }
        .group-chip--active {
          background: #f97316;
          color: #fff;
          border-color: transparent;
          box-shadow: 0 16px 34px rgba(249, 115, 22, 0.3);
        }
        .group-chip__label {
          font-size: 15px;
          line-height: 1.3;
        }
        .group-chip__count {
          font-size: 12px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(154, 52, 18, 0.72);
        }
        .group-chip--active .group-chip__count {
          color: rgba(255, 255, 255, 0.78);
        }
        .review-stage {
          display: grid;
          gap: clamp(18px, 4vw, 28px);
          width: 100%;
          max-width: 820px;
          margin: 0 auto;
        }
        .review-meta {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 12px 18px;
          align-items: center;
          padding: 16px 22px;
          border-radius: 20px;
          background: #fff4e6;
          border: 1px solid rgba(249, 177, 84, 0.26);
          color: #431407;
          box-shadow: 0 18px 40px rgba(249, 177, 84, 0.16);
        }
        .review-meta__info {
          display: grid;
          gap: 4px;
        }
        .review-meta__label {
          font-size: 16px;
          font-weight: 700;
        }
        .review-meta__detail {
          font-size: 13px;
          color: rgba(67, 20, 7, 0.7);
        }
        .review-meta__actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .review-meta__count {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(67, 20, 7, 0.72);
        }
        .review-meta__link {
          border: none;
          border-radius: 999px;
          padding: 8px 18px;
          font-weight: 600;
          color: #f97316;
          background: #fff;
          border: 1px solid rgba(249, 115, 22, 0.32);
          cursor: pointer;
          transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
          box-shadow: 0 12px 28px rgba(249, 115, 22, 0.24);
        }
        .review-meta__link:hover {
          transform: translateY(-1px);
          background: #fff7ed;
          box-shadow: 0 16px 32px rgba(249, 115, 22, 0.32);
        }
        .review-alert {
          margin-top: -6px;
          border-radius: 16px;
          padding: 12px 16px;
          font-size: 14px;
          font-weight: 500;
        }
        .review-alert__row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .review-alert--pending {
          background: #fff6ed;
          border: 1px solid rgba(249, 177, 84, 0.32);
          color: rgba(67, 20, 7, 0.78);
        }
        .review-alert--error {
          background: #fef2f2;
          border: 1px solid rgba(239, 68, 68, 0.32);
          color: #7f1d1d;
        }
        .review-alert__retry {
          border: none;
          border-radius: 999px;
          padding: 6px 16px;
          font-weight: 600;
          font-size: 13px;
          color: #fff;
          background: linear-gradient(135deg, #ef4444, #f97316);
          cursor: pointer;
          box-shadow: 0 10px 22px rgba(239, 68, 68, 0.22);
          transition: transform 0.16s ease, box-shadow 0.16s ease;
        }
        .review-alert__retry:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 28px rgba(239, 68, 68, 0.28);
        }
        @media (max-width: 720px) {
          .group-selector {
            padding: 12px;
          }
          .group-chip {
            min-width: 160px;
            padding: 10px 16px;
          }
          .review-meta {
            padding: 14px 18px;
          }
        }
      `}</style>
    </div>
  );
}

function groupMissed(list: MissedAttempt[], mode: ViewMode): MissedGroup[] {
  const map = new Map<GroupKey, MissedGroup>();
  for (const item of list) {
    const { key, label } = groupSignature(item, mode);

    if (!map.has(key)) {
      map.set(key, { key, label, items: [] });
    }
    map.get(key)!.items.push(item);
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - date);
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 4) return `${diffWeek}w ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  const diffYear = Math.floor(diffDay / 365);
  return `${diffYear}y ago`;
}

function practiceGroup(group: MissedGroup): void {
  const params = new URLSearchParams();
  params.set('mode', 'review');
  params.set('group', group.key);
  params.set('label', group.label);
  window.location.href = `/practice?${params.toString()}`;
}

function groupSignature(item: MissedAttempt, mode: ViewMode): { key: string; label: string } {
  const exam = (item.exam || 'GRE').trim() || 'GRE';
  const section = (item.section || 'Quant').trim() || 'Quant';
  const topicLabel = item.topic?.trim() || 'General Practice';

  if (mode === 'exam') {
    return {
      key: `exam|${encodeURIComponent(exam)}`,
      label: exam,
    };
  }

  if (mode === 'section') {
    return {
      key: `section|${encodeURIComponent(exam)}|${encodeURIComponent(section)}`,
      label: `${exam} · ${section}`,
    };
  }

  const topicKey = item.topic == null ? '__general__' : encodeURIComponent(item.topic);
  return {
    key: `topic|${encodeURIComponent(exam)}|${encodeURIComponent(section)}|${topicKey}`,
    label: topicLabel,
  };
}
