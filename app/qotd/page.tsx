'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import QuestionCard from '@/components/QuestionCard';
import { normalizeQuestionPayload } from '@/lib/normalizeQuestionPayload';
import type { QuestionPayload } from '@/lib/types/question';

/* ---------- safe localStorage helpers ---------- */
const hasWindow = () => typeof window !== 'undefined';
const safeGet = (k: string) => (hasWindow() ? window.localStorage.getItem(k) : null);
const safeSet = (k: string, v: string) => {
  if (hasWindow()) window.localStorage.setItem(k, v);
};
const safeRemove = (k: string) => {
  if (hasWindow()) window.localStorage.removeItem(k);
};

/* ---------- 1-minute lock ---------- */
const LOCK_MS = 60_000;

/* ---------- QOTD logic ---------- */
type QuantQuestion = QuestionPayload;
const LS_Q = 'qotd:question';
const LS_ISSUED = 'qotd:issuedAt';
const LS_DONE = 'qotd:completedAt';

export default function QotdPage() {
  const [q, setQ] = useState<QuantQuestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [coolMs, setCoolMs] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reqIdRef = useRef(0);

  // recompute remaining lock time every minute for label
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  const lockLeft = useMemo(() => {
    if (!hasWindow()) return null;
    const doneStr = safeGet(LS_DONE);
    const done = doneStr ? Number(doneStr) : 0;
    if (!done) return null;
    const left = LOCK_MS - (Date.now() - done);
    return left > 0 ? left : null;
  }, [tick]);

  // live countdown and auto-fetch when cooldown completes
  useEffect(() => {
    if (!hasWindow()) return;
    if (!locked) {
      setCoolMs(null);
      return;
    }

    const start = Number(safeGet(LS_DONE) || 0);
    const update = () => {
      const left = Math.max(0, LOCK_MS - (Date.now() - start));
      setCoolMs(left);
      if (left <= 0) {
        safeRemove(LS_DONE);
        safeRemove(LS_Q);
        safeRemove(LS_ISSUED);
        setLocked(false);
        load();
      }
    };
    update();
    const id = setInterval(update, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  async function load() {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setErr(null);

    try {
      if (!hasWindow()) return;

      const doneStr = safeGet(LS_DONE);
      const done = doneStr ? Number(doneStr) : 0;
      const leftFromDone = done ? LOCK_MS - (Date.now() - done) : null;
      if (leftFromDone && leftFromDone > 0) {
        setLocked(true);
        setQ(null);
        return;
      }

      if (done && (!leftFromDone || leftFromDone <= 0)) {
        safeRemove(LS_DONE);
        safeRemove(LS_Q);
        safeRemove(LS_ISSUED);
      }

      const issuedAtStr = safeGet(LS_ISSUED);
      const issuedAt = issuedAtStr ? Number(issuedAtStr) : 0;
      const cached = safeGet(LS_Q);
      if (issuedAt && Date.now() - issuedAt < 24 * 60 * 60 * 1000 && cached) {
        const cachedQuestion = normalizeQuestionPayload(JSON.parse(cached));
        setQ(cachedQuestion);
        setLocked(false);
        return;
      }

      const res = await fetch('/api/next-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exam: 'GRE', section: 'Quant', difficulty: 'hard' }),
      });
      if (!res.ok) throw new Error(`next-question ${res.status}`);
      const raw = await res.json();
      if (reqId !== reqIdRef.current) return;

      const question = normalizeQuestionPayload({ ...raw, difficulty: 'hard', section: 'Quant' });
      setQ(question);
      setLocked(false);
      safeSet(LS_Q, JSON.stringify(question));
      safeSet(LS_ISSUED, String(Date.now()));
      safeRemove(LS_DONE);
    } catch (e: any) {
      if (reqId !== reqIdRef.current) return;
      setErr('Could not load today’s question.');
      setQ(null);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function onNextAfterAnswered() {
    safeSet(LS_DONE, String(Date.now())); // start minute lock
    setLocked(true);
    setQ(null);
  }

  const remainingMs = locked ? coolMs ?? lockLeft ?? LOCK_MS : 0;
  const progressPct = locked
    ? Math.min(100, Math.max(0, 100 - (remainingMs / LOCK_MS) * 100))
    : 0;
  const secondsLeft = locked
    ? Math.max(0, Math.ceil((remainingMs || LOCK_MS) / 1000))
    : 0;

  const showLocked = !loading && !err && locked;
  const showQuestion = !loading && !err && !locked && q;

  return (
    <div className="page-shell">
      <div className="page">
        <div className="page-header">
          <h1 className="h1">Question of the Day</h1>
          <p className="page-sub">
            Your daily GRE Quant warm-up. Tackle the question, then swing back tomorrow for a fresh challenge.
          </p>
        </div>

        <div className="content">
          {loading && <LoadingSkeleton />}

          {!loading && err && (
            <ErrorState
              message="We hit a snag fetching today’s question."
              detail={err}
              onRetry={() => load()}
            />
          )}

          {showLocked && (
            <LockedState secondsLeft={secondsLeft} progressPct={progressPct} />
          )}

          {showQuestion && q && (
            <QuestionCard question={q} onNext={onNextAfterAnswered} />
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
        .h1 {
          font-size: clamp(36px, 5vw, 46px);
          line-height: 1.07;
          font-weight: 800;
          margin: 2px 0 0;
          color: #431407;
        }
        .page-sub {
          max-width: 520px;
          font-size: 16px;
          line-height: 1.7;
          color: rgba(67, 20, 7, 0.76);
          margin: 0;
        }
        .content {
          min-height: 220px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
        }
      `}</style>
    </div>
  );
}

/* ---------- UI bits (mirroring practice visuals) ---------- */

function LoadingSkeleton() {
  return (
    <div className="loading-shell" role="status" aria-busy="true" aria-live="polite">
      <div className="spinner" aria-hidden>
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} style={{ transform: `rotate(${i * 30}deg) translate(18px)`, animationDelay: `${i * 0.08}s` }} />
        ))}
      </div>
      <p className="loading-text">We’re building your question…</p>

      <style jsx>{`
        .loading-shell{ display:grid; place-items:center; gap:10px; padding:28px 0 20px }
        .spinner{ position:relative; width:46px; height:46px; margin:2px 0 2px }
        .spinner span{ position:absolute; left:50%; top:50%; width:8px; height:8px; margin:-4px; border-radius:999px; background: var(--orange); opacity:.2; transform-origin:0 0; animation: spinfade 1.0s linear infinite }
        .loading-text{ margin:0; font-weight:800; color:#7a3a1f; font-size:14px }
        @keyframes spinfade { 0% { opacity: 1 } 100% { opacity: .12 } }
        @keyframes shimmer { 0% { transform: translateX(-100%) } 50% { transform: translateX(60%) } 100% { transform: translateX(160%) } }
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

function LockedState({
  secondsLeft,
  progressPct,
}: {
  secondsLeft: number;
  progressPct: number;
}) {
  return (
    <div className="locked-shell" role="status" aria-live="polite">
      <div className="locked-card">
        <span className="locked-badge">
          <span className="locked-dot" />
          Locked
        </span>
        <h2 className="locked-title">Come back tomorrow for another question.</h2>
        <p className="locked-sub">
          {secondsLeft > 1 ? `Unlocks in ${secondsLeft}s.` : 'Unlocking…'}
        </p>
        <LoaderRing size={68} />
        <div className="locked-progress">
          <span className="locked-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <style jsx>{`
        .locked-shell {
          width: 100%;
          display: flex;
          justify-content: center;
          padding: 24px 0;
        }
        .locked-card {
          width: min(760px, 100%);
          border-radius: 24px;
          border: 1px solid rgba(249, 177, 84, 0.26);
          background: #fffdfa;
          padding: clamp(24px, 5vw, 32px);
          box-shadow: 0 18px 46px rgba(249, 177, 84, 0.16);
          display: grid;
          gap: 14px;
          justify-items: center;
          text-align: center;
        }
        .locked-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #9a3412;
          background: #fff4e6;
          box-shadow: inset 0 0 0 1px rgba(249, 177, 84, 0.32);
        }
        .locked-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #f97316;
        }
        .locked-title {
          margin: 6px 0 0;
          font-size: clamp(22px, 3vw, 26px);
          font-weight: 800;
          color: #431407;
        }
        .locked-sub {
          margin: 0;
          font-size: 15px;
          color: rgba(67, 20, 7, 0.72);
        }
        .locked-progress {
          width: min(420px, 100%);
          height: 10px;
          border-radius: 999px;
          border: 1px solid rgba(249, 177, 84, 0.28);
          background: rgba(249, 177, 84, 0.16);
          overflow: hidden;
        }
        .locked-progress-fill {
          display: block;
          height: 100%;
          background: linear-gradient(90deg, #fed7aa, #f97316);
          transition: width 0.25s ease;
        }
      `}</style>
    </div>
  );
}

function LoaderRing({ size = 72 }: { size?: number }) {
  const r = size / 2 - 6; // for 10px dots

  return (
    <div className="ring" style={{ width: size, height: size }} aria-hidden="true">
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = i * 30;
        const pos = `rotate(${angle}deg) translate(0, -${r}px)`;
        const style = {
          '--pos': pos,
          animationDelay: `${i * 0.08}s`,
        } as CSSProperties;
        return <span key={i} style={style} />;
      })}

      <style jsx>{`
        .ring {
          position: relative;
        }
        .ring span {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 10px;
          height: 10px;
          margin: -5px;
          border-radius: 999px;
          background: #f97316;
          opacity: 0;
          animation: ring-pop 1s linear infinite;
        }
        @keyframes ring-pop {
          0% {
            opacity: 0;
            transform: var(--pos) scale(0.7);
          }
          30% {
            opacity: 1;
            transform: var(--pos) scale(1);
          }
          100% {
            opacity: 0;
            transform: var(--pos) scale(0.7);
          }
        }
      `}</style>
    </div>
  );
}
