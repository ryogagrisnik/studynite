import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Study Group Quiz",
  description:
    "Run a live study group quiz with RunePrep. Create multiplayer quizzes from your notes and share a link to play together.",
  alternates: { canonical: "/study-group-quiz" },
  openGraph: {
    title: "Study Group Quiz | RunePrep",
    description:
      "Run a live study group quiz with RunePrep. Create multiplayer quizzes from your notes and share a link to play together.",
    url: "/study-group-quiz",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Study Group Quiz | RunePrep",
    description:
      "Run a live study group quiz with RunePrep. Create multiplayer quizzes from your notes and share a link to play together.",
  },
};

export default function StudyGroupQuiz() {
  return (
    <div className="page stack pixel-ui">
      <section className="quest-panel panel--parchment">
        <div className="chapter-head">
          <span className="chapter-pill">Study</span>
          <span className="chapter-title">Group Quiz</span>
          <span className="chapter-line" />
        </div>
        <h1 className="page-title">Study group quiz that runs live</h1>
        <p className="page-sub">
          Host a live study group quiz and keep everyone on the same pace. RunePrep generates
          questions from your materials and tracks scores automatically.
        </p>
        <div className="row">
          <Link className="btn btn-primary" href="/decks/new">
            Create a study quiz
          </Link>
          <Link className="btn btn-outline" href="/demo">
            Try a sample
          </Link>
        </div>
      </section>

      <section className="quest-panel panel--notice">
        <h2 className="section-title pixel-title">Perfect for:</h2>
        <div className="orn-divider" />
        <div className="split-grid spacious">
          <div className="card quest-scroll">
            <strong>Class review sessions</strong>
            <p className="muted">
              Keep the group in sync while the host reveals answers and scores live.
            </p>
          </div>
          <div className="card quest-scroll">
            <strong>Exam prep nights</strong>
            <p className="muted">
              Quickly turn lecture notes into a multiplayer quiz and practice together.
            </p>
          </div>
          <div className="card quest-scroll">
            <strong>Peer tutoring</strong>
            <p className="muted">
              Run a guided quiz where everyone practices the same questions.
            </p>
          </div>
        </div>
      </section>

      <section className="quest-panel panel--stone">
        <h2 className="section-title pixel-title">Start in minutes</h2>
        <div className="orn-divider" />
        <div className="steps-grid">
          <div className="step">
            <span className="badge">1</span>
            <div>
              <strong>Upload or paste notes</strong>
              <p className="muted">Use slides, transcripts, or study guides.</p>
            </div>
          </div>
          <div className="step">
            <span className="badge">2</span>
            <div>
              <strong>Generate quiz</strong>
              <p className="muted">Get ready-to-play questions instantly.</p>
            </div>
          </div>
          <div className="step">
            <span className="badge">3</span>
            <div>
              <strong>Share the link</strong>
              <p className="muted">Invite your group and start the round.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
