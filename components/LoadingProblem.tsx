// components/LoadingProblem.tsx
export default function LoadingProblem() {
  return (
    <div className="demo-card">
      <div className="loader-wrap">
        <div className="loader-bubbles" aria-hidden>
          <span className="b1" />
          <span className="b2" />
          <span className="b3" />
        </div>
        <h3 className="loader-title">Cooking up a fresh problem…</h3>
        <p className="loader-sub">Crunching numbers, shuffling choices, sprinkling LaTeX ✨</p>
      </div>
    </div>
  );
}
