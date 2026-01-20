"use client";

import { useState } from "react";
import Link from "next/link";

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

export default function DemoPage() {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  const question = sampleQuestions[index];
  const isCorrect = selected === question.correctIndex;

  const handleCheck = () => {
    if (selected === null) return;
    setShowResult(true);
  };

  const handleNext = () => {
    setIndex((prev) => (prev + 1) % sampleQuestions.length);
    setSelected(null);
    setShowResult(false);
  };

  const optionStyle = (idx: number) => {
    if (showResult) {
      if (idx === question.correctIndex) {
        return { borderColor: "#22c55e", background: "rgba(34,197,94,0.12)" };
      }
      if (selected === idx) {
        return { borderColor: "#ef4444", background: "rgba(239,68,68,0.08)" };
      }
    }
    if (!showResult && selected === idx) {
      return { borderColor: "var(--green)", background: "rgba(15,118,110,0.08)" };
    }
    return undefined;
  };

  return (
    <div className="page stack pixel-ui">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sample quiz</h1>
          <p className="page-sub">
            This is the exact quiz view your players see during a run. <strong>Made with sample Economics notes, from learner Ryoga Grisnik</strong>.
          </p>
        </div>
      </div>

      <div className="quiz-shell">
        <div className="quiz-meta">
          <span className="quiz-progress">
            Sample deck • Question {index + 1} / {sampleQuestions.length}
          </span>
        </div>

        <div className="quiz-card">
          <span className="quiz-label">Question</span>
          <div className="quiz-text">{question.prompt}</div>
          <div className="quiz-options">
            {question.choices.map((choice, idx) => (
              <button
                key={`${index}-${idx}`}
                className="quiz-option"
                type="button"
                onClick={() => setSelected(idx)}
                disabled={showResult}
                style={optionStyle(idx)}
              >
                <span className="quiz-choice">
                  <span className="quiz-letter">{String.fromCharCode(65 + idx)}.</span>
                  <span>{choice}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {showResult ? (
          <div className="quiz-result">
            <strong>{isCorrect ? "Correct" : "Incorrect"}</strong>
            <p className="card-sub" style={{ marginTop: 6 }}>
              {question.explanation}
            </p>
          </div>
        ) : null}

        <div className="row cta-row">
          <button
            className="btn btn-primary"
            type="button"
            onClick={showResult ? handleNext : handleCheck}
            disabled={!showResult && selected === null}
          >
            {showResult ? "Next question" : "Check answer"}
          </button>
          <Link className="btn btn-outline" href="/signup?callbackUrl=/decks/new">
            Create your own quiz
          </Link>
        </div>
      </div>
    </div>
  );
}
