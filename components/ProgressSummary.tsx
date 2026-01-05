"use client";

import { type CSSProperties } from "react";
import { type ProgressState, type SessionOutcome } from "@/lib/progression";

type ProgressSummaryProps = {
  progress: ProgressState;
  outcome: SessionOutcome;
  headline?: string;
  modeLabel?: string;
};

type ConfettiPiece = {
  x: number;
  drift: number;
  delay: number;
  duration: number;
  size: number;
  rotate: number;
};

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function hashSeed(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function buildConfettiPieces(seedText: string, count: number): ConfettiPiece[] {
  const rand = seededRandom(hashSeed(seedText));
  return Array.from({ length: count }, () => ({
    x: 6 + rand() * 88,
    drift: -90 + rand() * 180,
    delay: rand() * 0.35,
    duration: 1.6 + rand() * 1.4,
    size: 0.9 + rand() * 1.6,
    rotate: rand() * 720,
  }));
}

export default function ProgressSummary({
  progress,
  outcome,
  headline = "Session Bonus Unlocked",
  modeLabel,
}: ProgressSummaryProps) {
  const latestBadge = progress.badges[progress.badges.length - 1] ?? null;
  const activeBadge = progress.equippedBadge ?? latestBadge;
  const confettiBadge = activeBadge
    ? activeBadge.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
    : "default";
  const confettiSeed = `${confettiBadge}-${progress.sessionsCompleted}`;
  const confettiPieces = buildConfettiPieces(confettiSeed, 30);
  const xpPct = outcome.xpForLevel
    ? Math.min(100, Math.round((outcome.xpInLevel / outcome.xpForLevel) * 100))
    : 0;
  const levelUp = outcome.levelAfter > outcome.levelBefore;
  const bonusMuted = outcome.bonus.type === "none";
  const streakLabel = `${progress.streak.days} day${progress.streak.days === 1 ? "" : "s"}`;
  const boostLabel =
    progress.boost.remaining > 0
      ? `${progress.boost.multiplier}x boost (${progress.boost.remaining} left)`
      : null;
  const cosmetics = progress.cosmetics.slice(-4);
  const badges = progress.badges.slice(-4);

  return (
    <div className="stack reward-stack">
      <div className="card vegas-panel reward-panel">
        <div className="confetti-burst" data-badge={confettiBadge}>
          {confettiPieces.map((piece, index) => (
            <span
              key={index}
              className="confetti-piece"
              style={
                {
                  "--x": `${piece.x}%`,
                  "--drift": `${piece.drift}px`,
                  "--delay": `${piece.delay}s`,
                  "--duration": `${piece.duration}s`,
                  "--size": piece.size.toFixed(2),
                  "--rot": `${piece.rotate}deg`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        <div className="reward-header">
          <div className="stack" style={{ gap: 6 }}>
            <span className="reward-kicker">{headline}</span>
            {modeLabel ? <span className="reward-mode">{modeLabel}</span> : null}
          </div>
          <span className={`reward-chip ${bonusMuted ? "is-muted" : ""}`}>
            {outcome.bonus.label}
          </span>
        </div>
        <p className="reward-detail">{outcome.bonus.detail}</p>
        <div className="reward-grid">
          <div className="reward-metric">
            <span>Session XP</span>
            <strong>+{outcome.xpGained}</strong>
          </div>
          <div className="reward-metric">
            <span>Streak boost</span>
            <strong>{outcome.streakMultiplier.toFixed(2)}x</strong>
          </div>
          <div className="reward-metric">
            <span>Level</span>
            <strong>{outcome.levelAfter}</strong>
          </div>
          <div className="reward-metric">
            <span>Total XP</span>
            <strong>{outcome.totalXp}</strong>
          </div>
        </div>
        {levelUp ? (
          <div className="reward-levelup">
            Level up! You jumped from {outcome.levelBefore} to {outcome.levelAfter}.
          </div>
        ) : null}
        {outcome.nearMiss || outcome.sessionNearMiss ? (
          <div className="reward-nearmiss">
            {outcome.nearMiss ? <span>{outcome.nearMiss}</span> : null}
            {outcome.sessionNearMiss ? <span>{outcome.sessionNearMiss}</span> : null}
          </div>
        ) : null}
      </div>

      <div className="grid-2">
        <div className="card vegas-panel progress-panel">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <span className="reward-kicker">Meta progress</span>
              <h3 className="card-title">Level {outcome.levelAfter}</h3>
            </div>
            <span className="reward-chip">+{outcome.xpGained} XP</span>
          </div>
          <div className="progress-bar neon-progress">
            <span style={{ width: `${xpPct}%` }} />
          </div>
          <div className="row muted" style={{ justifyContent: "space-between" }}>
            <span>
              {outcome.xpInLevel} / {outcome.xpForLevel} XP
            </span>
            <span>{xpPct}% to next level</span>
          </div>
          <div className="streak-card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="streak-label">Study streak</span>
              <span className="reward-chip reward-chip--small">{streakLabel}</span>
            </div>
            <strong>{progress.streak.multiplier.toFixed(2)}x rewards active</strong>
            {boostLabel ? <span className="muted">{boostLabel}</span> : null}
          </div>
        </div>

        <div className="card vegas-panel quest-panel">
          <span className="reward-kicker">Collections</span>
          <h3 className="card-title">Cosmetics & badges</h3>
          <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
            {cosmetics.length === 0 && badges.length === 0 ? (
              <span className="muted">No unlocks yet.</span>
            ) : null}
            {cosmetics.map((item) => (
              <span key={item} className="loot-chip">{item}</span>
            ))}
            {badges.map((item) => (
              <span key={item} className="loot-chip loot-chip--badge">{item}</span>
            ))}
          </div>
        </div>
      </div>

      {null}
    </div>
  );
}
