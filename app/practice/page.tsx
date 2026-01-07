import Link from "next/link";

export default function PracticePage() {
  return (
    <div className="page">
      <div className="card stack" style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 className="page-title">Practice is now quiz-based</h1>
        <p className="page-sub">
          RunePrep focuses on quizzes built from your own materials.
        </p>
        <div className="row">
          <Link className="btn btn-primary" href="/decks/new">
            Create a quiz
          </Link>
          <Link className="btn btn-outline" href="/dashboard">
            View dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
