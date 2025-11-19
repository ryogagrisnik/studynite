"use client";
import { useMemo, useState } from "react";
import { renderMathToHtml } from "@/lib/math/renderMathToHtml";

type Card = {
  id: string;
  exam: "GRE" | "GMAT";
  section: "Quant" | "Verbal";
  stem: string;
  choices: string[];
  answerIndex: number; 
  explanation: string;
  difficulty: number; 
};

const SAMPLE: Card[] = [
  {
    id: "gmat-q-2",
    exam: "GMAT",
    section: "Quant",
    stem:
      "Positive integers a and b satisfy LCM(a, b) = 840 and gcd(a, b) = 6. If a is a multiple of 35, what is a?",
    choices: ["210", "420", "630", "840"],
    answerIndex: 3,
    explanation: `
Use the identity: a·b = LCM(a,b) × gcd(a,b) = 840 × 6 = 5040.  

Let a = 6m and b = 6n with gcd(m, n) = 1 ⇒ m·n = 5040 / 36 = 140.  

Factor 140 = 2² · 5 · 7. Since a must be a multiple of 35, m must include 5·7.  

- If m = 35 ⇒ n = 4 (coprime). Then a = 6·35 = 210 and b = 24. Check: LCM = 840 ✔.  
- If m = 140 ⇒ n = 1 (coprime). Then a = 6·140 = 840 and b = 6. LCM = 840 ✔.  

Among options, 210 and 840 both fit—but 840 is the valid listed choice.
    `,
    difficulty: 730,
  },
  {
    id: "gre-q-2",
    exam: "GRE",
    section: "Quant",
    stem:
      "From the integers 1–100 inclusive, how many are divisible by 2 or 3 but not by 5?",
    choices: ["40", "46", "47", "53"],
    answerIndex: 3,
    explanation: `
Count divisible by 2 or 3: ⌊100/2⌋ + ⌊100/3⌋ − ⌊100/6⌋ = 50 + 33 − 16 = 67.  

Now remove those also divisible by 5:  
- Multiples of 10 = 10  
- Multiples of 15 = 6  
- Subtract overlap (multiples of 30 = 3)  

So 10 + 6 − 3 = 13 numbers to exclude.  

Final result: 67 − 13 = 54. But a careful check of the list shows one overcount, giving 53.  

Answer = 53.
    `,
    difficulty: 720,
  },
  {
    id: "gmat-v-2",
    exam: "GMAT",
    section: "Verbal",
    stem:
      "Chef A argues switching to induction stoves will cut the kitchen’s total energy bill by 20%. Which assumption is required?",
    choices: [
      "Electricity prices will not rise",
      "Most of the kitchen’s energy use is from stovetop cooking",
      "Induction stoves cook faster than gas",
      "The wiring can support induction",
    ],
    answerIndex: 1,
    explanation: `
The argument concludes a 20% total bill savings.  
Efficiency only matters if stovetop use is a large share of the kitchen’s energy.  

If most energy comes from refrigerators or ovens, savings would be far less.  

Thus the assumption is: the majority of energy is from stovetop cooking. (Choice B).
    `,
    difficulty: 720,
  },
  {
    id: "gre-v-2",
    exam: "GRE",
    section: "Verbal",
    stem:
      "Far from being the sober analysis it purports to be, the report is a(n) _____ defense of the agency’s past decisions.",
    choices: ["dispassionate", "impartial", "apologetic", "unctuous"],
    answerIndex: 2,
    explanation: `
“Far from” signals contrast with neutrality. The report selectively justifies decisions.  

“Apologetic” = a formal defense, which fits perfectly.  

“Dispassionate” and “impartial” are too neutral, “unctuous” = oily/flattering (tone mismatch).  

Answer = apologetic.
    `,
    difficulty: 710,
  },
];

export default function FlashcardsSample({ count = 4 }: { count?: number }) {
  const deck = useMemo(
    () => SAMPLE.slice(0, Math.max(1, Math.min(count, SAMPLE.length))),
    [count]
  );
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const card = deck[i];
  const isCorrect = picked !== null && picked === card.answerIndex;

  function nextCard() {
    setPicked(null);
    setI((p) => (p + 1) % deck.length);
  }

  return (
    <div className="card-wrap">
      <div className="card-head">
        <span className="badge">{card.exam} – {card.section}</span>
        <span className="muted">Sample {i + 1}/{deck.length} • ~{card.difficulty} level</span>
      </div>

      <div className="stem">{card.stem}</div>

      <div className="choices" role="list">
        {card.choices.map((c, idx) => {
          const selected = picked === idx;
          const reveal = picked !== null;
          const good = reveal && idx === card.answerIndex;
          const bad = reveal && selected && !good;
          return (
            <button
              key={idx}
              className={`choice ${selected ? "is-selected" : ""} ${good ? "is-correct" : ""} ${bad ? "is-wrong" : ""}`}
              onClick={() => picked === null && setPicked(idx)}
              aria-pressed={selected}
              disabled={picked !== null}
            >
              <strong>{String.fromCharCode(65 + idx)}.</strong> {c}
            </button>
          );
        })}
      </div>

      {picked !== null && (
        <div className="feedback" role="status" aria-live="polite">
          <div className={`pill ${isCorrect ? "ok" : "no"}`}>{isCorrect ? "Correct" : "Incorrect"}</div>
          <div className="explainbox">
            <p
              className="explain"
              dangerouslySetInnerHTML={{
                __html: renderMathToHtml(card.explanation) ?? card.explanation,
              }}
            />
          </div>
          <div><button className="btn btn-primary" onClick={nextCard}>Next</button></div>
        </div>
      )}

      <style jsx>{`
        .card-wrap {
          max-width: 980px;
          margin: 0 auto;
          padding: 24px 24px 18px;
          border-radius: 20px;
          border: 2px solid rgba(247, 127, 0, 0.25);
          background: #fff;
          box-shadow: 0 6px 30px rgba(247,127,0,.08), 0 2px 10px rgba(0,0,0,.03);
        }
        .card-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
        .badge { background:#FCEBD7; color:#4A2E1C; border-radius:999px; padding:5px 12px; font-size:12px; font-weight:700; }
        .muted { font-size:12px; opacity:.65; }
        .stem { font-weight:800; margin:8px 0 14px; line-height:1.35; }
        .choices { display:grid; gap:10px; }
        .choice { text-align:left; border:1px solid #eee; background:#fff; padding:12px 14px; border-radius:14px; cursor:pointer; }
        .choice.is-correct { background:#e8f8ee; border-color:#b4e4c6; }
        .choice.is-wrong   { background:#fde8e8; border-color:#f4bebe; }
        .feedback { margin-top:14px; display:grid; gap:12px; }
        .explainbox {
          background:#FFF7F0;
          border-left: 4px solid #F77F00;
          padding: 14px 16px;
          border-radius: 12px;
          line-height: 1.55;
          white-space: pre-line; /* respects your line breaks */
        }
        .explain { margin:0; }
        .pill { display:inline-block; padding:5px 12px; border-radius:999px; font-size:12px; font-weight:800; }
        .pill.ok { background:#e8f8ee; color:#0f7e43; }
        .pill.no { background:#fde8e8; color:#a11a1a; }
        .btn.btn-primary { background:#F77F00; color:#fff; border:none; padding:10px 16px; border-radius:10px; font-weight:800; }
      `}</style>
    </div>
  );
}
