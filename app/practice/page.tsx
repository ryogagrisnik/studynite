'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QuestionCard from '@/components/QuestionCard';
import { normalizeQuestionPayload } from '@/lib/normalizeQuestionPayload';
import type { QuestionPayload } from '@/lib/types/question';

type Exam = 'GRE' | 'GMAT';
type Section = 'Quant' | 'Verbal';

// GRE Verbal controls
type VerbalMode = 'random' | 'concept';         // UI term; mapped to API 'random' | 'topic'
type Concept = 'TC' | 'SE' | 'RC';

// GRE Quant controls
type QuantMode = 'random' | 'topic';
const GRE_QUANT_TOPICS: { value: string; label: string }[] = [
  { value: 'Number Properties', label: 'Number Properties' },
  { value: 'Algebra', label: 'Algebra & Inequalities' },
  { value: 'Word Problems & Arithmetic', label: 'Word Problems & Arithmetic' },
  { value: 'Set Theory', label: 'Set Theory' },
  { value: 'Statistics & Average', label: 'Statistics & Averages' },
  { value: 'Ratio / Percent / Fractions', label: 'Ratios & Percents' },
  { value: 'Rates / Work / Speed', label: 'Rates / Work / Speed' },
  { value: 'Permutation & Probability', label: 'Counting & Probability' },
  { value: 'Geometry / Solid Geometry', label: 'Geometry' },
  { value: 'Coordinate Geometry', label: 'Coordinate Geometry' },
  { value: 'Quantitative Comparison', label: 'Quantitative Comparison' },
];
const GMAT_QUANT_TOPICS: { value: string; label: string }[] = [
  { value: 'Number Properties & Arithmetic', label: 'Number Properties & Arithmetic' },
  { value: 'Algebraic Equations & Inequalities', label: 'Algebraic Equations & Inequalities' },
  { value: 'Exponentials & Functions', label: 'Exponentials & Functions' },
  { value: 'Word Problems & Rates', label: 'Word Problems & Rates' },
  { value: 'Counting & Probability', label: 'Counting & Probability' },
  { value: 'Data Analysis & Sets', label: 'Data Analysis & Sets' },
  { value: 'Geometry & Coordinate Geometry', label: 'Geometry & Coordinate Geometry' },
  { value: 'Data Sufficiency — Algebra & Number', label: 'Data Sufficiency · Algebra & Number' },
  { value: 'Data Sufficiency — Geometry & Measurement', label: 'Data Sufficiency · Geometry & Measurement' },
  { value: 'Data Sufficiency — Applications', label: 'Data Sufficiency · Applications' },
];

export default function PracticePage() {
  const [exam, setExam] = useState<Exam>('GRE');
  const [section, setSection] = useState<Section>('Quant');

  // Verbal controls
  const [vMode, setVMode] = useState<VerbalMode>('random'); // UI pill: random | concept
  const [concept, setConcept] = useState<Concept | undefined>(undefined);

  // Quant controls
  const [qMode, setQMode] = useState<QuantMode>('random');  // UI pill: random | topic
  const [qTopic, setQTopic] = useState<string>(GRE_QUANT_TOPICS[0].value);

  const [payload, setPayload] = useState<QuestionPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [cooldownMessage, setCooldownMessage] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const reviewModeRaw = (searchParams.get('mode') ?? '').toLowerCase();
  const reviewGroupParam = searchParams.get('group');
  const reviewLabelParam = searchParams.get('label');
  const reviewModeActive = reviewModeRaw === 'review' && Boolean(reviewGroupParam);
  const reviewGroupKey = reviewModeActive ? reviewGroupParam : null;
  const reviewLabel = reviewModeActive ? reviewLabelParam : null;
  const DEFAULT_DAILY_LIMIT = Number(process.env.NEXT_PUBLIC_DAILY_LIMIT ?? '15');
  const [reviewMeta, setReviewMeta] = useState<{ attempts: number; lastMissedAt: string } | null>(null);
  const [reviewUnavailable, setReviewUnavailable] = useState(false);
  const [reviewLocked, setReviewLocked] = useState(false);
  const [quotaUsed, setQuotaUsed] = useState(0);
  const [quotaLimit, setQuotaLimit] = useState(DEFAULT_DAILY_LIMIT);
  const [quotaUnlimited, setQuotaUnlimited] = useState(false);
  const [quotaLocked, setQuotaLocked] = useState(false);
  const [nextUnlockAt, setNextUnlockAt] = useState<string | null>(null);

  const reqIdRef = useRef(0);
  const lastReviewQuestionRef = useRef<QuestionPayload['id'] | null>(null);

  const isGRE = (exam || '').toUpperCase() === 'GRE';
  const isVerbal = (section || '').toLowerCase() === 'verbal';
  const CLIENT_MIN_INTERVAL_SECONDS = Math.max(
    1,
    Number(process.env.NEXT_PUBLIC_NEXT_QUESTION_MIN_INTERVAL_SECONDS ?? '5')
  );
  const CLIENT_COOLDOWN_MS = CLIENT_MIN_INTERVAL_SECONDS * 1000;
  const quantTopics = useMemo(
    () => (exam === 'GMAT' ? GMAT_QUANT_TOPICS : GRE_QUANT_TOPICS),
    [exam]
  );

  useEffect(() => {
    if (exam === 'GMAT' && section === 'Verbal') {
      setSection('Quant');
    }
  }, [exam, section]);

  useEffect(() => {
    if (!quantTopics.some((topic) => topic.value === qTopic)) {
      const fallback = quantTopics[0]?.value;
      if (fallback && fallback !== qTopic) setQTopic(fallback);
    }
  }, [quantTopics, qTopic]);

  type PracticeMode = 'random' | 'topic' | 'review';
  type PracticeEventMeta = {
    exam?: Exam;
    section?: Section;
    mode: PracticeMode;
    topic?: string | null;
    groupKey?: string | null;
  };

  function trackPracticeEvent(detail: {
    result: 'success' | 'error';
    message?: string | null;
    questionId?: QuestionPayload['id'];
    meta: PracticeEventMeta;
  }) {
    try {
      const body = JSON.stringify({
        ...detail.meta,
        result: detail.result,
        questionId: detail.questionId ?? null,
        message: detail.message ?? null,
        timestamp: new Date().toISOString(),
        source: 'practice-page',
      });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon('/api/events/practice', blob);
        return;
      }
      void fetch('/api/events/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      });
    } catch (e) {
      console.debug('[PracticePage] analytics track failed', e);
    }
  }

  const exitReviewMode = useCallback(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('mode');
    url.searchParams.delete('group');
    url.searchParams.delete('label');
    const query = url.searchParams.toString();
    const target = query.length > 0 ? `${url.pathname}?${query}` : url.pathname;
    window.location.replace(target);
  }, []);

  useEffect(() => {
    if (cooldownUntil === null) {
      setCooldownRemaining(0);
      return;
    }
    let cancelled = false;
    const update = () => {
      if (cancelled) return;
      const diff = cooldownUntil - Date.now();
      if (diff <= 0) {
        setCooldownRemaining(0);
        setCooldownUntil(null);
        return;
      }
      setCooldownRemaining(Math.ceil(diff / 1000));
    };
    update();
    const id = window.setInterval(update, 500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [cooldownUntil]);

  useEffect(() => {
    if (!reviewModeActive) {
      setReviewMeta(null);
      lastReviewQuestionRef.current = null;
      setReviewUnavailable(false);
      setReviewLocked(false);
    }
  }, [reviewModeActive]);

  async function load(opts?: { bypassCooldown?: boolean }) {
    const bypassCooldown = opts?.bypassCooldown ?? false;
    const isReview = Boolean(reviewModeActive && reviewGroupKey);

    if (isReview && reviewLocked) {
      setLoading(false);
      setErr(null);
      setEmpty(false);
      return;
    }

    if (!isReview && !bypassCooldown && cooldownUntil && cooldownUntil > Date.now()) {
      const seconds = Math.max(1, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownMessage(`Please wait ${seconds}s before requesting another question.`);
      return;
    }

    setCooldownMessage(null);
    try {
      const statsRes = await fetch('/api/quota', { cache: 'no-store' });
      if (statsRes.ok) {
        const stats = await statsRes.json().catch(() => null);
        if (stats) {
          const isUnlimited = Boolean(stats.isUnlimited);
          setQuotaUnlimited(isUnlimited);
          if (typeof stats.limit === 'number') setQuotaLimit(stats.limit);
          if (typeof stats.used === 'number') setQuotaUsed(isUnlimited ? 0 : stats.used);
          if (typeof stats.nextUnlockAt === 'string') setNextUnlockAt(stats.nextUnlockAt);
          if (!isUnlimited) {
            const limit = typeof stats.limit === 'number' ? stats.limit : quotaLimit;
            const used = typeof stats.used === 'number' ? stats.used : quotaUsed;
            if (!isReview && used >= limit) {
              setQuotaLocked(true);
              setLoading(false);
              setErr(null);
              setPayload(null);
              setEmpty(false);
              return;
            }
            setQuotaLocked(false);
          } else {
            setQuotaLocked(false);
            setNextUnlockAt(null);
          }
        }
      }
    } catch (qErr) {
      console.debug('[PracticePage] failed to load quota stats', qErr);
    }

    if (!isReview && quotaLocked) {
      setLoading(false);
      setErr(null);
      setPayload(null);
      setEmpty(false);
      return;
    }

    const reqId = ++reqIdRef.current;
    setLoading(true);
    setErr(null);
    setEmpty(false);
    if (isReview) {
      setCooldownUntil(null);
      setCooldownRemaining(0);
      const excludeQuestionId =
        typeof lastReviewQuestionRef.current === 'string' || typeof lastReviewQuestionRef.current === 'number'
          ? String(lastReviewQuestionRef.current)
          : undefined;
      try {
        const res = await fetch('/api/missed/practice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupKey: reviewGroupKey,
            ...(excludeQuestionId ? { excludeQuestionId } : {}),
          }),
        });

        if (reqId !== reqIdRef.current) return;

        if (res.status === 401) {
          setReviewLocked(true);
          setPayload(null);
          setEmpty(false);
          setReviewMeta(null);
          lastReviewQuestionRef.current = null;
          setReviewUnavailable(false);
          setErr(null);
          return;
        }

        if (!res.ok) {
          let msg = `missed/practice ${res.status}`;
          try {
            const j = await res.json();
            if (j?.message) msg = `${msg}: ${j.message}`;
          } catch {}
          throw new Error(msg);
        }

        const raw = await res.json();
        if (reqId !== reqIdRef.current) return;

        if (raw?.missingTable) {
          setReviewUnavailable(true);
          setPayload(null);
          setEmpty(false);
          setReviewMeta(null);
          lastReviewQuestionRef.current = null;
          return;
        }

        if (raw?.empty) {
          setPayload(null);
          setEmpty(true);
          setReviewMeta(null);
          lastReviewQuestionRef.current = null;
          trackPracticeEvent({
            result: 'error',
            message: 'empty-review-group',
            meta: {
              mode: 'review',
              groupKey: reviewGroupKey ?? null,
            },
          });
          return;
        }

        if (typeof raw?.isUnlimited === 'boolean') setQuotaUnlimited(raw.isUnlimited);
        if (typeof raw?.limit === 'number') setQuotaLimit(raw.limit);
        if (typeof raw?.nextUnlockAt === 'string') setNextUnlockAt(raw.nextUnlockAt);
        if (!raw?.isUnlimited && typeof raw?.limit === 'number' && typeof raw?.used === 'number') {
          setQuotaUsed(raw.used);
          if (raw.used >= raw.limit) {
            setQuotaLocked(true);
          } else {
            setQuotaLocked(false);
          }
        } else if (raw?.isUnlimited) {
          setQuotaLocked(false);
          setQuotaUsed(0);
        }
        const normalized = normalizeQuestionPayload(raw);
        if (!normalized || !Array.isArray(normalized.options) || normalized.options.length === 0) {
          setPayload(null);
          setEmpty(true);
          setReviewMeta(null);
          trackPracticeEvent({
            result: 'error',
            message: 'Empty question payload',
            meta: {
              mode: 'review',
              groupKey: reviewGroupKey ?? null,
            },
          });
          return;
        }

        setQuotaUsed(raw?.used ?? quotaUsed);
        setPayload(normalized);
        setEmpty(false);
        setReviewMeta(raw?.review ?? null);
        setReviewUnavailable(false);
        lastReviewQuestionRef.current = normalized.id;
        trackPracticeEvent({
          result: 'success',
          questionId: normalized.id,
          meta: {
            mode: 'review',
            exam: normalized.exam as Exam | undefined,
            section: normalized.section as Section | undefined,
            topic: normalized.topic ?? null,
            groupKey: reviewGroupKey ?? null,
          },
        });
      } catch (e: any) {
        if (reqId !== reqIdRef.current) return;
        if (typeof e?.message === 'string' && e.message.startsWith('missed/practice 401')) {
          setReviewLocked(true);
          setErr(null);
        } else {
          setErr(e?.message || 'Failed to load review question');
        }
        setPayload(null);
        setEmpty(false);
        setReviewMeta(null);
        trackPracticeEvent({
          result: 'error',
          message: e?.message ?? 'unknown-error',
          meta: {
            mode: 'review',
            groupKey: reviewGroupKey ?? null,
          },
        });
      } finally {
        if (reqId === reqIdRef.current) setLoading(false);
      }
      return;
    }

    // Determine canonical API mode + topic up front so analytics share a single view
    let requestMode: PracticeMode = 'random';
    let requestTopic: string | undefined = undefined;

    if (isGRE && isVerbal) {
      requestMode = vMode === 'concept' ? 'topic' : 'random';
      requestTopic = requestMode === 'topic' ? (concept ?? 'TC') : undefined;
    } else {
      requestMode = qMode === 'topic' ? 'topic' : 'random';
      requestTopic = requestMode === 'topic' ? qTopic : undefined;
    }

    const requestMeta: PracticeEventMeta = {
      exam: 'GRE' as const,
      section: (isVerbal ? 'Verbal' : 'Quant') as Section,
      mode: requestMode,
      topic: requestMode === 'topic' ? requestTopic ?? null : null,
      groupKey: null,
    };

    setReviewUnavailable(false);
    lastReviewQuestionRef.current = null;

    try {
      // Determine canonical API mode + topic
      const body = {
        exam: requestMeta.exam,
        section: requestMeta.section,
        mode: requestMeta.mode,
        ...(requestMeta.topic ? { topic: requestMeta.topic } : {}),
      };

      const res = await fetch('/api/next-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      let raw: any = null;
      try {
        raw = await res.json();
      } catch {
        raw = null;
      }

      if (!res.ok) {
        if (res.status === 429) {
          if (raw?.quotaExceeded) {
            setQuotaUnlimited(false);
            if (typeof raw.limit === 'number') setQuotaLimit(raw.limit);
            if (typeof raw.used === 'number') setQuotaUsed(raw.used);
            if (typeof raw.nextUnlockAt === 'string') setNextUnlockAt(raw.nextUnlockAt);
            setQuotaLocked(true);
            setLoading(false);
            setErr(null);
            setPayload(null);
            setEmpty(false);
            return;
          }
          let retryAfterSec: number | undefined;
          if (raw && typeof raw.retryAfter === 'number') retryAfterSec = raw.retryAfter;
          if (raw && typeof raw.retryAfter === 'string') {
            const parsed = Number(raw.retryAfter);
            if (Number.isFinite(parsed)) retryAfterSec = parsed;
          }
          const retryMs = Math.max(
            CLIENT_COOLDOWN_MS,
            (retryAfterSec && Number.isFinite(retryAfterSec) ? retryAfterSec : CLIENT_MIN_INTERVAL_SECONDS) * 1000
          );
          const until = Date.now() + retryMs;
          setCooldownUntil(until);
          const seconds = Math.max(1, Math.ceil(retryMs / 1000));
          setCooldownMessage(`Please wait ${seconds}s before requesting another question.`);
          return;
        }
        let msg = `next-question ${res.status}`;
        if (raw) {
          try {
            if (raw.message) msg = `${msg}: ${raw.message}`;
            if (raw.issues?.[0]?.path && raw.issues?.[0]?.message) {
              msg = `${msg} (${raw.issues[0].path.join('.')}: ${raw.issues[0].message})`;
            }
          } catch {}
        }
        throw new Error(msg);
      }

      if (!raw) throw new Error('Invalid question payload');

      if (reqId !== reqIdRef.current) return;
      const normalized = normalizeQuestionPayload(raw);
      if (!normalized || !Array.isArray(normalized.options) || normalized.options.length === 0) {
        setPayload(null);
        setEmpty(true);
        trackPracticeEvent({
          result: 'error',
          message: 'Empty question payload',
          meta: requestMeta,
        });
        return;
      }
      if (typeof raw?.isUnlimited === 'boolean') setQuotaUnlimited(raw.isUnlimited);
      if (typeof raw?.limit === 'number') setQuotaLimit(raw.limit);
      if (typeof raw?.nextUnlockAt === 'string') setNextUnlockAt(raw.nextUnlockAt);
      if (!raw?.isUnlimited && typeof raw?.used === 'number') {
        setQuotaUsed(raw.used);
        if (typeof raw.limit === 'number' && raw.used >= raw.limit) {
          setQuotaLocked(true);
        } else {
          setQuotaLocked(false);
        }
      } else if (raw?.isUnlimited) {
        setQuotaLocked(false);
        setQuotaUsed(0);
      } else {
        setQuotaLocked(false);
      }
      setPayload(normalized);
      setEmpty(false);
      setReviewMeta(null);
      setCooldownUntil(Date.now() + CLIENT_COOLDOWN_MS);
      setCooldownMessage(null);
      trackPracticeEvent({
        result: 'success',
        questionId: normalized.id,
        meta: requestMeta,
      });
    } catch (e: any) {
      if (reqId !== reqIdRef.current) return;
      setErr(e?.message || 'Failed to load question');
      setPayload(null);
      setEmpty(false);
      setCooldownUntil(null);
      if (!bypassCooldown) setCooldownMessage(null);
      trackPracticeEvent({
        result: 'error',
        message: e?.message ?? 'unknown-error',
        meta: requestMeta,
      });
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }

  // initial + dependencies
  useEffect(() => {
    if (reviewModeActive) {
      load({ bypassCooldown: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewModeActive, reviewGroupKey]);

  useEffect(() => {
    if (reviewModeActive) return;
    load({ bypassCooldown: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewModeActive, exam, section, vMode, concept, qMode, qTopic]);

  return (
    <div className="page-shell">
      <div className="page">
        <div className="page-header">
          <h1 className="h1">Practice</h1>
          <p className="page-sub">
            Choose an exam, section, and focus to keep questions tailored to the
            skills you want to sharpen.
          </p>
        </div>

        {reviewModeActive && (
          <div className="review-banner" role="status" aria-live="polite">
            <div className="review-banner__info">
              <span className="review-banner__title">Reviewing misses</span>
              <span className="review-banner__label">{reviewLabel ?? 'All queued misses'}</span>
              <span className="review-banner__meta">
                {reviewMeta && typeof reviewMeta.attempts === 'number'
                  ? `Missed ${reviewMeta.attempts}×${reviewMeta.lastMissedAt ? ` · Last missed ${timeAgo(reviewMeta.lastMissedAt)}` : ''}`
                  : 'We will pull from your saved misses.'}
              </span>
            </div>
            <Link href="/missed" className="review-banner__link">
              Change group
            </Link>
          </div>
        )}

        <div className="controls-shell">
          <div className="controls">
            <ChipGroup
              value={exam}
              onChange={(v) => setExam(v as Exam)}
              options={[['GRE','GRE'], ['GMAT','GMAT']]}
            />
            <ChipGroup
              value={section}
              onChange={(v) => setSection(v as Section)}
              options={[['Quant','Quant'], ['Verbal','Verbal']]}
            />

            {isGRE && isVerbal ? (
              <>
                <ChipGroup
                  value={vMode}
                  onChange={(v) => setVMode(v as VerbalMode)}
                  options={[['random','Random'], ['concept','By Concept']]}
                />
                {vMode === 'concept' && (
                  <SelectChip
                    value={(concept ?? 'TC') as Concept}
                    onChange={(v) => setConcept(v as Concept)}
                    options={[['TC','Text Completion'], ['SE','Sentence Equivalence'], ['RC','Reading Comprehension']]}
                  />
                )}
              </>
            ) : (
              <>
                <ChipGroup
                  value={qMode}
                  onChange={(v) => setQMode(v as QuantMode)}
                  options={[['random','Random'], ['topic','By Topic']]}
                />
                {qMode === 'topic' && (
                  <SelectChip
                    value={qTopic}
                    onChange={setQTopic}
                    options={quantTopics.map(t => [t.value, t.label]) as [string, string][]}
                  />
                )}
              </>
            )}
          </div>

          <div className="controls-right">
            <button
              className="next"
              onClick={() => load()}
              disabled={
                loading ||
                cooldownUntil !== null ||
                (!reviewModeActive && !quotaUnlimited && quotaUsed >= quotaLimit) ||
                (!reviewModeActive && quotaLocked)
              }
            >
              {quotaLocked && !reviewModeActive
                ? 'Locked'
                : cooldownUntil
                ? `Next (${Math.max(cooldownRemaining, 1)}s)`
                : 'Next'}
            </button>
            {cooldownMessage && (
              <div className="cooldown-note" role="status">
                {cooldownMessage}
              </div>
            )}
            <div className="progress-pill">
              <div className="progress-text">
                <span className="progress-label">Today</span>
                <span className="progress-value">
                  {quotaUnlimited
                    ? 'Unlimited'
                    : `${Math.min(quotaUsed, quotaLimit)} / ${quotaLimit}`}
                </span>
              </div>
              <div className="progress-track">
                <span
                  className="progress-fill"
                  style={{
                    width: quotaUnlimited
                      ? '100%'
                      : `${Math.min(1, quotaLimit > 0 ? quotaUsed / quotaLimit : 0) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="content">
          {reviewModeActive && reviewLocked && !loading ? (
            <ReviewLockedState onLeave={exitReviewMode} />
          ) : reviewModeActive && reviewUnavailable && !loading ? (
            <ReviewUnavailableState />
          ) : !reviewModeActive && quotaLocked && !loading ? (
            <QuotaLockedState
              nextUnlockAt={nextUnlockAt}
              onRetry={() => load({ bypassCooldown: true })}
            />
          ) : (
            <>
              {loading && <LoadingSkeleton />}

              {!loading && err && (
                <ErrorState
                  message="We hit a snag pulling your next question."
                  detail={err}
                  onRetry={() => load({ bypassCooldown: true })}
                />
              )}

              {!loading && !err && empty && (
                reviewModeActive ? (
                  <ReviewEmptyState
                    label={reviewLabel}
                    onRetry={() => load({ bypassCooldown: true })}
                  />
                ) : (
                  <EmptyState
                    onRetry={() => load({ bypassCooldown: true })}
                    modeLabel={
                      isVerbal
                        ? vMode === 'concept'
                          ? `concept: ${concept ?? 'TC'}`
                          : 'random verbal'
                        : qMode === 'topic'
                        ? `topic: ${qTopic}`
                        : 'random quant'
                    }
                  />
                )
              )}

              {!loading && !err && !empty && payload && (
                <QuestionCard payload={payload} onContinue={() => load()} />
              )}
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .page-shell {
          position: relative;
          padding: clamp(28px, 5vw, 48px) 16px clamp(72px, 10vw, 96px);
        }
        .page {
          position: relative;
          max-width: 1040px;
          margin: 0 auto;
          padding: 0 clamp(12px, 3vw, 24px);
          display: flex;
          flex-direction: column;
          gap: clamp(24px, 5vw, 40px);
        }
        .page-header {
          display: grid;
          gap: 10px;
        }
        .h1 { font-size: clamp(36px, 5vw, 46px); line-height:1.07; font-weight: 800; margin: 2px 0 0; color:#431407; }
        .page-sub {
          max-width: 520px;
          font-size: 16px;
          line-height: 1.7;
          color: rgba(67, 20, 7, 0.76);
          margin: 0;
        }
        .review-banner {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 20px;
          border-radius: 16px;
          background: #fef3c7;
          border: 1px solid rgba(251, 191, 36, 0.32);
          box-shadow: 0 14px 28px rgba(251, 191, 36, 0.18);
        }
        .review-banner__info {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }
        .review-banner__title {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(67, 20, 7, 0.6);
        }
        .review-banner__label {
          font-size: 16px;
          font-weight: 700;
          color: #431407;
          word-break: break-word;
        }
        .review-banner__meta {
          font-size: 13px;
          color: rgba(67, 20, 7, 0.7);
        }
        .review-banner__link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 8px 18px;
          font-weight: 600;
          color: #9a3412;
          background: #fff7ed;
          border: 1px solid rgba(234, 88, 12, 0.3);
          text-decoration: none;
          box-shadow: 0 10px 22px rgba(249, 177, 84, 0.14);
          transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
        }
        .review-banner__link:hover {
          transform: translateY(-1px);
          background: #ffedd5;
          box-shadow: 0 14px 30px rgba(249, 177, 84, 0.22);
        }
        .controls-shell {
          display:grid;
          grid-template-columns:1fr;
          gap:20px;
        }
        @media (min-width: 840px) {
          .controls-shell {
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
          }
        }
        .controls {
          display:flex;
          flex-wrap:wrap;
          gap:12px;
          align-items:center;
        }
        .controls-right { display:flex; align-items:center; gap:14px; justify-self:flex-end; }
        .next {
          border:none;
          background:#f97316;
          color:#fff;
          border-radius:18px;
          padding:10px 24px;
          font-weight:700;
          font-size:14px;
          box-shadow:0 10px 22px rgba(249, 115, 22, 0.28);
          transition:transform 0.18s ease, box-shadow 0.18s ease;
        }
        .next:hover { transform:translateY(-1px); box-shadow:0 14px 30px rgba(249, 115, 22, 0.34); }
        .next:disabled {
          background: rgba(249, 115, 22, 0.38);
          box-shadow: none;
          cursor: not-allowed;
          transform: none;
        }
        .cooldown-note {
          font-size: 13px;
          font-weight: 500;
          color: rgba(67, 20, 7, 0.72);
        }
        .content { min-height: 220px; }
        .err { color:#b91c1c; background:#fee2e2; border:1px solid #fecaca; padding:12px 16px; display:inline-block; border-radius:14px; font-weight:600; }
        .progress-pill {
          display:flex;
          flex-direction:column;
          gap:6px;
          padding:10px 16px;
          border-radius:16px;
          border:1px solid rgba(251, 191, 36, 0.24);
          min-width:140px;
          background:#fffdf7;
        }
        .progress-text { display:flex; justify-content:space-between; font-size:11px; font-weight:600; color:#9a3412; text-transform:uppercase; letter-spacing:0.05em; }
        .progress-label { opacity:0.75; }
        .progress-value { font-weight:700; font-size:12px; }
        .progress-track { position:relative; height:5px; background:rgba(249,115,22,0.16); border-radius:999px; overflow:hidden; }
        .progress-fill { position:absolute; inset:0; background:#f97316; border-radius:999px; transition:width 0.3s ease; }
        @media (max-width: 720px) {
          .controls {
            justify-content:flex-start;
          }
          .controls-right {
            justify-self:stretch;
            justify-content:space-between;
            gap:10px;
          }
        }
      `}</style>
    </div>
  );
}

function timeAgo(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString).getTime();
  if (Number.isNaN(date)) return '';
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
  if (diffWeek < 5) return `${diffWeek}w ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  const diffYear = Math.floor(diffDay / 365);
  return `${diffYear}y ago`;
}

function timeUntil(dateString: string): string {
  if (!dateString) return 'soon';
  const target = new Date(dateString).getTime();
  if (Number.isNaN(target)) return 'soon';
  const now = Date.now();
  const diffMs = Math.max(0, target - now);
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'in under a minute';
  if (diffMin < 60) return `in ${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    const remMin = diffMin - diffHr * 60;
    return remMin > 0 ? `in ${diffHr}h ${remMin}m` : `in ${diffHr}h`;
  }
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) {
    const remHr = diffHr - diffDay * 24;
    return remHr > 0 ? `in ${diffDay}d ${remHr}h` : `in ${diffDay}d`;
  }
  return `on ${new Date(dateString).toLocaleDateString()}`;
}

/* ---------- UI bits ---------- */

function ChipGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <>
      <div className="chip-group">
        {options.map(([opt, label], idx) => {
          const active = opt === value;
          return (
            <button
              key={`${opt}-${idx}`}
              type="button"
              onClick={() => onChange(opt)}
              className={`chip ${active ? 'chip--active' : ''}`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <style jsx>{`
        .chip-group { display:flex; gap:8px; }
        .chip {
          border:none;
          background:#fff9f3;
          color:#9a3412;
          border-radius:16px;
          padding:7px 16px;
          font-weight:600;
          font-size:13px;
          box-shadow:inset 0 0 0 1px rgba(249, 177, 84, 0.32);
          transition:background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
        }
        .chip:hover { box-shadow:inset 0 0 0 1px rgba(249,115,22,0.5); transform:translateY(-1px); background:#fff4e6; }
        .chip--active {
          background:#f97316;
          color:#fff;
          box-shadow:none;
        }
      `}</style>
    </>
  );
}

function SelectChip<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <>
      <div className="select-chip">
        <select
          value={value}
          onChange={(e) => onChange(e.currentTarget.value as T)}
          className="select-chip__control"
        >
          {options.map(([opt, label], idx) => (
            <option key={`${opt}-${idx}`} value={opt}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <style jsx>{`
        .select-chip { position:relative; }
        .select-chip__control {
          appearance:none;
          border:none;
          padding:7px 34px 7px 16px;
          border-radius:16px;
          background:#fff9f3;
          color:#9a3412;
          font-weight:600;
          font-size:13px;
          box-shadow:inset 0 0 0 1px rgba(249, 177, 84, 0.3);
          transition:box-shadow 0.18s ease, background 0.18s ease;
        }
        .select-chip__control:focus {
          outline:none;
          background:#fff4e6;
          box-shadow:inset 0 0 0 1px rgba(249,115,22,0.45);
        }
        .select-chip::after {
          content:'';
          position:absolute;
          right:14px;
          top:50%;
          width:10px;
          height:10px;
          border-right:2px solid rgba(249,115,22,0.7);
          border-bottom:2px solid rgba(249,115,22,0.7);
          transform:translateY(-60%) rotate(45deg);
          pointer-events:none;
        }
      `}</style>
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="loading-shell" role="status" aria-busy="true" aria-live="polite">
      <div className="spinner" aria-hidden>
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} style={{ transform: `rotate(${i * 30}deg) translate(18px)`, animationDelay: `${i * 0.08}s` }} />
        ))}
      </div>
      <p className="loading-text">We’re building your next question…</p>
      <style jsx>{`
        .loading-shell {
          display:grid; place-items:center; gap:10px; padding:28px 0 20px;
        }
        .spinner{ position:relative; width:46px; height:46px; margin:2px 0 2px }
        .spinner span{ position:absolute; left:50%; top:50%; width:8px; height:8px; margin:-4px; border-radius:999px; background: var(--orange); opacity:.2; transform-origin:0 0; animation: spinfade 1.0s linear infinite }
        .loading-text {
          margin:0; font-weight:800; color:#7a3a1f; font-size:14px;
        }
        @keyframes spinfade { 0% { opacity: 1 } 100% { opacity: .12 } }
      `}</style>
    </div>
  );
}

function ErrorState({
  message,
  detail,
  onRetry,
}: {
  message: string;
  detail?: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="state state--error" role="alert">
      <strong>{message}</strong>
      {detail && <span className="state__detail">{detail}</span>}
      <button type="button" onClick={onRetry} className="state__action">
        Try again
      </button>
      <style jsx>{`
        .state {
          display: flex;
          flex-direction: column;
          gap: 10px;
          border-radius: 18px;
          padding: 18px 20px;
          max-width: min(520px, 100%);
        }
        .state--error {
          background: #fef2f2;
          border: 1px solid rgba(239, 68, 68, 0.36);
          color: #7f1d1d;
          box-shadow: 0 12px 28px rgba(239, 68, 68, 0.12);
        }
        strong {
          font-weight: 700;
        }
        .state__detail {
          font-size: 14px;
          opacity: 0.8;
          word-break: break-word;
        }
        .state__action {
          align-self: flex-start;
          border: none;
          border-radius: 999px;
          padding: 8px 18px;
          font-weight: 600;
          color: #fff;
          background: linear-gradient(135deg, #ef4444, #f97316);
          cursor: pointer;
          box-shadow: 0 12px 24px rgba(249, 115, 22, 0.28);
          transition: transform 0.16s ease, box-shadow 0.16s ease;
        }
        .state__action:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 30px rgba(249, 115, 22, 0.34);
        }
      `}</style>
    </div>
  );
}

function ReviewUnavailableState() {
  return (
    <div className="state state--unavailable" role="status" aria-live="polite">
      <strong>Missed-question review isn’t ready yet.</strong>
      <span className="state__detail">
        Apply the database migration that creates the <code>MissedQuestion</code> table, then refresh this page to enable the review queue.
      </span>
      <Link href="/missed" className="state__link">
        Open Missed dashboard
      </Link>
      <style jsx>{`
        .state {
          display: flex;
          flex-direction: column;
          gap: 12px;
          border-radius: 18px;
          padding: 20px 22px;
          max-width: min(520px, 100%);
        }
        .state--unavailable {
          background: #fef3c7;
          border: 1px solid rgba(251, 191, 36, 0.32);
          color: #92400e;
          box-shadow: 0 14px 30px rgba(251, 191, 36, 0.2);
        }
        strong {
          font-weight: 700;
        }
        .state__detail {
          font-size: 14px;
          opacity: 0.9;
        }
        .state__link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 8px 18px;
          font-weight: 600;
          color: #9a3412;
          background: #fff;
          border: 1px solid rgba(234, 88, 12, 0.28);
          text-decoration: none;
          transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
          box-shadow: 0 10px 22px rgba(234, 88, 12, 0.14);
        }
        .state__link:hover {
          transform: translateY(-1px);
          background: #fffbeb;
          box-shadow: 0 14px 30px rgba(234, 88, 12, 0.2);
        }
      `}</style>
    </div>
  );
}

function ReviewLockedState({ onLeave }: { onLeave: () => void }) {
  return (
    <div className="state state--locked" role="status" aria-live="polite">
      <strong>Missed review is a BlobPrep Pro feature.</strong>
      <span className="state__detail">
        Sign in and upgrade to unlock your saved misses. You can keep practicing 15 free questions a day without an account.
      </span>
      <div className="state__actions">
        <Link href="/pricing" className="state__link">
          View plans
        </Link>
        <button type="button" onClick={onLeave} className="state__action">
          Back to practice
        </button>
      </div>
      <style jsx>{`
        .state {
          display: flex;
          flex-direction: column;
          gap: 12px;
          border-radius: 18px;
          padding: 20px 22px;
          max-width: min(520px, 100%);
        }
        .state--locked {
          background: #fdf4ff;
          border: 1px solid rgba(168, 85, 247, 0.32);
          color: #581c87;
          box-shadow: 0 14px 30px rgba(168, 85, 247, 0.18);
        }
        strong {
          font-weight: 700;
        }
        .state__detail {
          font-size: 14px;
          opacity: 0.9;
        }
        .state__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .state__link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 8px 18px;
          font-weight: 600;
          color: #6d28d9;
          background: #fff;
          border: 1px solid rgba(168, 85, 247, 0.28);
          text-decoration: none;
          transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
          box-shadow: 0 10px 22px rgba(168, 85, 247, 0.16);
        }
        .state__link:hover {
          transform: translateY(-1px);
          background: #faf5ff;
          box-shadow: 0 14px 30px rgba(168, 85, 247, 0.2);
        }
        .state__action {
          border: none;
          border-radius: 999px;
          padding: 8px 18px;
          font-weight: 600;
          color: #fff;
          background: linear-gradient(135deg, #a855f7, #6366f1);
          cursor: pointer;
          box-shadow: 0 10px 22px rgba(99, 102, 241, 0.24);
          transition: transform 0.16s ease, box-shadow 0.16s ease;
        }
        .state__action:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 30px rgba(99, 102, 241, 0.32);
        }
      `}</style>
    </div>
  );
}

function QuotaLockedState({ nextUnlockAt, onRetry }: { nextUnlockAt?: string | null; onRetry: () => void }) {
  const message = nextUnlockAt
    ? `You’ve reached the 15-question limit. New free questions unlock ${timeUntil(nextUnlockAt)}.`
    : 'You’ve reached the 15-question limit. New free questions unlock in about 12 hours.';
  return (
    <div className="state state--quota" role="status" aria-live="polite">
      <strong>Daily practice limit reached.</strong>
      <span className="state__detail">{message}</span>
      <div className="state__actions">
        <Link href="/pricing" className="state__link">
          Upgrade for unlimited practice
        </Link>
        <button type="button" onClick={onRetry} className="state__action">
          Refresh
        </button>
      </div>
      <style jsx>{`
        .state {
          display: flex;
          flex-direction: column;
          gap: 12px;
          border-radius: 18px;
          padding: 20px 22px;
          max-width: min(520px, 100%);
        }
        .state--quota {
          background: #fff7ed;
          border: 1px solid rgba(249, 177, 84, 0.32);
          color: #7c2d12;
          box-shadow: 0 14px 30px rgba(249, 177, 84, 0.18);
        }
        strong {
          font-weight: 700;
        }
        .state__detail {
          font-size: 14px;
          opacity: 0.9;
        }
        .state__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .state__link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 8px 18px;
          font-weight: 600;
          color: #9a3412;
          background: #fff;
          border: 1px solid rgba(249, 177, 84, 0.32);
          text-decoration: none;
          transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
          box-shadow: 0 10px 22px rgba(249, 177, 84, 0.18);
        }
        .state__link:hover {
          transform: translateY(-1px);
          background: #fff3e0;
          box-shadow: 0 14px 30px rgba(249, 177, 84, 0.24);
        }
        .state__action {
          border: none;
          border-radius: 999px;
          padding: 8px 18px;
          font-weight: 600;
          color: #fff;
          background: linear-gradient(135deg, #f97316, #ea580c);
          cursor: pointer;
          box-shadow: 0 10px 22px rgba(234, 88, 12, 0.24);
          transition: transform 0.16s ease, box-shadow 0.16s ease;
        }
        .state__action:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 30px rgba(234, 88, 12, 0.32);
        }
      `}</style>
    </div>
  );
}

function ReviewEmptyState({
  label,
  onRetry,
}: {
  label?: string | null;
  onRetry: () => void;
}) {
  const target = label?.trim() ? `“${label.trim()}”` : 'this group';
  return (
    <div className="state state--review" role="status" aria-live="polite">
      <strong>All caught up!</strong>
      <span className="state__detail">
        No missed questions left in {target}. Refresh to double-check or head back to pick another set.
      </span>
      <div className="state__actions">
        <button type="button" onClick={onRetry} className="state__action">
          Refresh
        </button>
        <Link href="/missed" className="state__link">
          Back to Missed
        </Link>
      </div>
      <style jsx>{`
        .state {
          display: flex;
          flex-direction: column;
          gap: 12px;
          border-radius: 18px;
          padding: 20px 22px;
          max-width: min(520px, 100%);
        }
        .state--review {
          background: #eef2ff;
          border: 1px solid rgba(79, 70, 229, 0.28);
          color: #1e1b4b;
          box-shadow: 0 14px 30px rgba(79, 70, 229, 0.18);
        }
        strong {
          font-weight: 700;
        }
        .state__detail {
          font-size: 14px;
          opacity: 0.85;
        }
        .state__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .state__action {
          border: none;
          border-radius: 999px;
          padding: 8px 18px;
          font-weight: 600;
          color: #1e1b4b;
          background: #c7d2fe;
          cursor: pointer;
          box-shadow: 0 10px 22px rgba(79, 70, 229, 0.18);
          transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
        }
        .state__action:hover {
          transform: translateY(-1px);
          background: #a5b4fc;
          box-shadow: 0 14px 30px rgba(79, 70, 229, 0.26);
        }
        .state__link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 8px 18px;
          font-weight: 600;
          color: #1e1b4b;
          background: transparent;
          border: 1px solid rgba(30, 27, 75, 0.36);
          text-decoration: none;
          transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
        }
        .state__link:hover {
          transform: translateY(-1px);
          background: rgba(30, 27, 75, 0.08);
          box-shadow: 0 12px 24px rgba(30, 27, 75, 0.18);
        }
      `}</style>
    </div>
  );
}

function EmptyState({
  onRetry,
  modeLabel,
}: {
  onRetry: () => void;
  modeLabel: string;
}) {
  return (
    <div className="state state--empty" role="status" aria-live="polite">
      <strong>No questions available right now.</strong>
      <span className="state__detail">
        We couldn’t find a question for your current selection ({modeLabel}). Try again or switch filters for a new batch.
      </span>
      <button type="button" onClick={onRetry} className="state__action">
        Refresh
      </button>
      <style jsx>{`
        .state {
          display: flex;
          flex-direction: column;
          gap: 10px;
          border-radius: 18px;
          padding: 18px 20px;
          max-width: min(520px, 100%);
        }
        .state--empty {
          background: #fffbeb;
          border: 1px solid rgba(251, 191, 36, 0.36);
          color: #92400e;
          box-shadow: 0 12px 30px rgba(251, 191, 36, 0.18);
        }
        strong {
          font-weight: 700;
        }
        .state__detail {
          font-size: 14px;
          opacity: 0.85;
        }
        .state__action {
          align-self: flex-start;
          border: none;
          border-radius: 999px;
          padding: 8px 18px;
          font-weight: 600;
          color: #9a3412;
          background: #fff7ed;
          border: 1px solid rgba(234, 88, 12, 0.36);
          cursor: pointer;
          box-shadow: 0 10px 22px rgba(249, 177, 84, 0.16);
          transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
        }
        .state__action:hover {
          transform: translateY(-1px);
          background: #fff4e6;
          box-shadow: 0 14px 28px rgba(249, 177, 84, 0.22);
        }
      `}</style>
    </div>
  );
}
