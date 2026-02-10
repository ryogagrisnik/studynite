"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { DEFAULT_AVATAR_ID, getAvatarById } from "@/lib/studyhall/avatars";

const sampleQuestions = [
  {
    prompt:
      "In a market, demand shifts right while supply stays constant. What happens to equilibrium price?",
    choices: [
      "It falls because supply is unchanged.",
      "It rises because demand increases.",
      "It stays the same because both curves move.",
      "It becomes unpredictable without new data.",
    ],
    correctIndex: 1,
    explanation: "Higher demand with the same supply pushes the equilibrium price up.",
  },
  {
    prompt:
      "Which component is part of GDP when calculated using the expenditure approach?",
    choices: [
      "Household consumption",
      "Imports only",
      "Stock market capitalization",
      "Unpaid household work",
    ],
    correctIndex: 0,
    explanation: "GDP includes consumption, investment, government spending, and net exports.",
  },
  {
    prompt: "If inflation rises faster than nominal wages, real wages will:",
    choices: ["Increase", "Decrease", "Stay the same", "Turn negative"],
    correctIndex: 1,
    explanation: "Real wages fall when prices grow faster than pay.",
  },
];

const QUESTION_TIME = 25;

const demoRoundGains: Record<string, number>[] = [
  { you: 3, momo: 2, pip: 1, sunny: 0, biscuit: 1 },
  { you: 2, momo: 1, pip: 2, sunny: 1, biscuit: 0 },
  { you: 3, momo: 1, pip: 1, sunny: 0, biscuit: 2 },
];

const demoPlayers = [
  { id: "you", name: "You", avatarId: "paladin", score: 12, bonusScore: 2, isHost: true, isActive: true },
  { id: "momo", name: "Momo", avatarId: "wizard", score: 11, bonusScore: 1, isHost: false, isActive: true },
  { id: "pip", name: "Pip", avatarId: "rogue", score: 10, bonusScore: 0, isHost: false, isActive: true },
  { id: "sunny", name: "Sunny", avatarId: "archer", score: 9, bonusScore: 0, isHost: false, isActive: true },
  { id: "biscuit", name: "Biscuit", avatarId: "knight", score: 8, bonusScore: 1, isHost: false, isActive: true },
];

export default function DemoPage() {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [completed, setCompleted] = useState(false);
  const [phase, setPhase] = useState<"question" | "scoreboard">("question");

  const question = sampleQuestions[index];
  const isCorrect = selected === question.correctIndex;
  const isLast = index === sampleQuestions.length - 1;
  const showSignup = completed;

  useEffect(() => {
    if (revealed || timeLeft === 0 || completed || phase !== "question") return;
    const timer = setTimeout(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [revealed, timeLeft, index, completed, phase]);

  useEffect(() => {
    if (timeLeft === 0) {
      setLocked(true);
    }
  }, [timeLeft]);

  const handleSelect = (idx: number) => {
    if (locked || revealed) return;
    setSelected(idx);
    setLocked(true);
  };

  const handleReveal = () => {
    setRevealed(true);
  };

  const handleNext = () => {
    if (isLast) {
      setCompleted(true);
      return;
    }
    setPhase("scoreboard");
    setTimeout(() => {
      setIndex((prev) => prev + 1);
      setSelected(null);
      setLocked(false);
      setRevealed(false);
      setTimeLeft(QUESTION_TIME);
      setPhase("question");
    }, 1300);
  };

  const playerRows = useMemo(() => {
    const roundIndex = Math.min(index, demoRoundGains.length - 1);
    return demoPlayers.map((player) => ({
      ...player,
      roundGain: demoRoundGains[roundIndex]?.[player.id] ?? 0,
      totalScore:
        player.score +
        demoRoundGains
          .slice(0, roundIndex + 1)
          .reduce((sum, round) => sum + (round[player.id] ?? 0), 0),
    }));
  }, [index]);

  if (completed) {
    return (
      <div className="page stack pixel-ui">
        <div className="card stack">
          <h1 className="page-title">Demo complete. Make your own?</h1>
          <p className="page-sub">
            Upload notes and RunePrep turns them into a full multiplayer quiz in minutes.
          </p>
          <div className="row">
            <Link className="btn btn-primary" href="/decks/new">
              Make my quiz
            </Link>
            <Link className="btn btn-outline" href="/signup?callbackUrl=/decks/new">
              Save results & create
            </Link>
            <button className="btn btn-outline" type="button" onClick={() => setCompleted(false)}>
              Replay demo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page stack pixel-ui demo-party">
      <div className="page-header">
        <div>
          <h1 className="page-title">Demo party (bots)</h1>
          <p className="page-sub">
            This is the exact multiplayer quiz view. Play alongside a few friendly bots.
          </p>
        </div>
      </div>

      <div className="demo-layout">
        {phase === "scoreboard" ? (
          <div className="card stack demo-scoreboard-card rpg-reveal">
            <div className="demo-scoreboard-head">
              <h2 className="card-title">Scoreboard update</h2>
              <span className="badge">Round {index + 1} results</span>
            </div>
            <div className="scoreboard results">
              {playerRows.map((player) => {
                const avatar = getAvatarById(player.avatarId) ?? getAvatarById(DEFAULT_AVATAR_ID);
                const rowClass = `score-row${player.isHost ? " is-host" : ""}${player.isActive ? "" : " is-inactive"}`;
                return (
                  <div key={player.id} className={rowClass}>
                    <span className="row" style={{ gap: 10 }}>
                      {avatar ? <img className="avatar" src={avatar.src} alt={avatar.label} /> : null}
                      {player.name}
                      {!player.isActive ? <span className="badge badge-soft">Offline</span> : null}
                    </span>
                    <span className="row" style={{ gap: 6 }}>
                      <span className="badge">{player.totalScore}</span>
                      <span className={`badge badge-soft ${player.roundGain > 0 ? "badge-gain" : "badge-gain--muted"}`}>
                        +{player.roundGain}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
            <span className="muted demo-scoreboard-note">Next question incoming...</span>
          </div>
        ) : (
          <>
            <div className="card stack demo-question-card rpg-reveal">
              <div className="demo-meta">
                <span className="badge">
                  Q {index + 1} / {sampleQuestions.length}
                </span>
                <span className="badge">{timeLeft}s</span>
                {locked ? <span className="badge answer-locked">Answers locked</span> : null}
                {revealed ? <span className="badge">Answer revealed</span> : null}
              </div>
              <h2 className="demo-question-text">{question.prompt}</h2>
              <div className="demo-options">
                {question.choices.map((choice, idx) => {
                  const isSelected = selected === idx;
                  const isCorrectChoice = revealed && idx === question.correctIndex;
                  const isWrongChoice = revealed && isSelected && !isCorrectChoice;
                  return (
                    <button
                      key={`${index}-${idx}`}
                      className={`demo-option${isSelected ? " is-selected" : ""}${isCorrectChoice ? " is-correct" : ""}${isWrongChoice ? " is-wrong" : ""}`}
                      onClick={() => handleSelect(idx)}
                      disabled={locked || revealed || timeLeft === 0}
                    >
                      <span className="demo-option-letter">{String.fromCharCode(65 + idx)}</span>
                      <span className="demo-option-text">{choice}</span>
                    </button>
                  );
                })}
              </div>
              {locked && !revealed ? (
                <span className="muted answer-locked-text">Answers locked. Waiting for the reveal.</span>
              ) : revealed ? (
                <span className="muted">Answer revealed.</span>
              ) : timeLeft === 0 ? (
                <span className="muted">Time is up. Waiting for the reveal.</span>
              ) : null}
              {revealed ? (
                <div className="card card--plain demo-answer-card">
                  Correct answer: {String.fromCharCode(65 + question.correctIndex)}
                  {selected !== null ? ` — ${isCorrect ? "you got it!" : "nice try."}` : ""}
                </div>
              ) : null}
            </div>

            <div className="card stack demo-host-card rpg-reveal">
              <h2 className="card-title">Host controls</h2>
              <div className="stack">
                <span className="badge">
                  Correct answer: {revealed ? String.fromCharCode(65 + question.correctIndex) : "-"}
                </span>
                <span className="muted">Fastest correct answer earns +1 bonus.</span>
                <div className="row demo-host-actions">
                  <button className="btn btn-outline" onClick={handleReveal} disabled={revealed}>
                    {revealed ? "Answer revealed" : "Reveal answer"}
                  </button>
                  <button className="btn btn-outline" onClick={handleNext} disabled={!revealed}>
                    {isLast ? "Finish demo" : "Next question"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {showSignup ? null : null}
    </div>
  );
}
