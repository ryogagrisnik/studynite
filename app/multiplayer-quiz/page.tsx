import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Multiplayer Quiz Maker",
  description:
    "Create multiplayer quizzes from your notes and host live study parties in minutes. Share a link and play together.",
  alternates: { canonical: "/multiplayer-quiz" },
  openGraph: {
    title: "Multiplayer Quiz Maker | RunePrep",
    description:
      "Create multiplayer quizzes from your notes and host live study parties in minutes. Share a link and play together.",
    url: "/multiplayer-quiz",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Multiplayer Quiz Maker | RunePrep",
    description:
      "Create multiplayer quizzes from your notes and host live study parties in minutes. Share a link and play together.",
  },
};

export default function MultiplayerQuiz() {
  return (
    <div className="page stack pixel-ui">
      <section className="quest-panel panel--parchment">
        <div className="chapter-head">
          <span className="chapter-pill">Multiplayer</span>
          <span className="chapter-title">Quiz Maker</span>
          <span className="chapter-line" />
        </div>
        <h1 className="page-title">Multiplayer quiz maker for live study parties</h1>
        <p className="page-sub">
          RunePrep turns your notes into a multiplayer quiz you can run live with friends,
          classmates, or your entire study group.
        </p>
        <div className="row">
          <Link className="btn btn-primary" href="/decks/new">
            Build a quiz from notes
          </Link>
          <Link className="btn btn-outline" href="/party/join">
            Join a party
          </Link>
        </div>
      </section>

      <section className="quest-panel panel--notice">
        <h2 className="section-title pixel-title">How it works</h2>
        <div className="orn-divider" />
        <div className="steps-grid">
          <div className="step">
            <span className="badge">1</span>
            <div>
              <strong>Upload notes</strong>
              <p className="muted">Paste notes, slides, or PDFs to seed a quiz.</p>
            </div>
          </div>
          <div className="step">
            <span className="badge">2</span>
            <div>
              <strong>Generate questions</strong>
              <p className="muted">RunePrep builds a full multiplayer quiz in seconds.</p>
            </div>
          </div>
          <div className="step">
            <span className="badge">3</span>
            <div>
              <strong>Play live</strong>
              <p className="muted">Share a link, host the round, and see live scores.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="quest-panel panel--stone">
        <h2 className="section-title pixel-title">Why use RunePrep?</h2>
        <div className="orn-divider" />
        <div className="split-grid spacious">
          <div className="card quest-scroll">
            <strong>Made for study groups</strong>
            <p className="muted">
              Run synchronized rounds so everyone answers the same questions at the same time.
            </p>
          </div>
          <div className="card quest-scroll">
            <strong>Quiz from your materials</strong>
            <p className="muted">
              Generate questions from your notes instead of generic trivia.
            </p>
          </div>
          <div className="card quest-scroll">
            <strong>Instant sharing</strong>
            <p className="muted">
              Share a link or code so the whole class can join in seconds.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
