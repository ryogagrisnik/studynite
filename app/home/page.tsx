import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: {
    absolute: "RunePrep | Multiplayer quizzes from your notes",
  },
  description:
    "Turn your notes into multiplayer quizzes. Auto-generate questions and host a live study party with a single link.",
  alternates: { canonical: "/home" },
  openGraph: {
    title: "RunePrep | Multiplayer quizzes from your notes",
    description:
      "Turn your notes into multiplayer quizzes. Auto-generate questions and host a live study party with a single link.",
    url: "/home",
    type: "website",
    images: [
      {
        url: "/assets/banner.png",
        width: 1200,
        height: 630,
        alt: "RunePrep multiplayer quiz generator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RunePrep | Multiplayer quizzes from your notes",
    description:
      "Turn your notes into multiplayer quizzes. Auto-generate questions and host a live study party with a single link.",
    images: ["/assets/banner.png"],
  },
};

export default function Home() {
  const demoHref = process.env.NEXT_PUBLIC_DEMO_PARTY_CODE ? "/demo/party" : "/demo";
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "RunePrep",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    description:
      "Turn your notes into multiplayer quizzes. Auto-generate questions and host live study parties in minutes.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <div className="page stack home pixel-ui pixel-home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <section className="hero-slab hero-slab--glow sparkle-layer rpg-reveal pixel-sky">
        <div className="quest-panel panel--stone hero-panel">
          <div className="chapter-head chapter-head--hero">
            <span className="chapter-pill">Prologue</span>
            <span className="chapter-title">The Runes of Awakening</span>
            <span className="chapter-line" />
          </div>
          <div className="orn-divider" />
          <div className="hero-grid">
            <div className="stack hero-copy">
              <h1 className="page-title">Turn your notes into multiplayer quizzes.</h1>
              <p className="page-sub">
                Upload notes, auto-generate questions, and host a live party with a single link.
              </p>
              <div className="row hero-cta">
                <Link className="btn btn-primary btn-hero" href="/decks/new">
                  Start a live party
                </Link>
                <Link className="btn btn-outline btn-hero" href={demoHref}>
                  Try a sample quiz
                </Link>
              </div>
              <p className="path-label">What you do</p>
              <div className="path-grid">
                <Link className="quest-card" href="/decks/new">
                  <span className="path-meta">Quest I</span>
                  <strong>Upload materials</strong>
                  <p className="muted">Paste notes or PDFs and pick what you want to practice.</p>
                </Link>
                <Link className="quest-card" href="/party/join">
                  <span className="path-meta">Quest II</span>
                  <strong>Start a party</strong>
                  <p className="muted">Share a link so everyone plays the same round together.</p>
                </Link>
                <Link className="quest-card" href="/dashboard">
                  <span className="path-meta">Quest III</span>
                  <strong>See results</strong>
                  <p className="muted">Live scores, accuracy, and a recap after each run.</p>
                </Link>
              </div>
            </div>
            <div className="hero-media hero-media--plain">
              <div className="hero-media-inner pixel-frame">
                <img className="hero-image" src="/hero.png" alt="RunePrep hero scene" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="slab slab--rating rpg-reveal">
        <div className="section-divider" aria-hidden="true" />
        <div className="quest-panel panel--notice panel--hero-frame">
          <div className="slab-header">
            <div className="chapter-head chapter-head--hero">
              <span className="chapter-pill">Chapter VI</span>
              <span className="chapter-title">Guild Wall</span>
              <span className="chapter-line" />
            </div>
            <h2 className="section-title pixel-title">Students rate RunePrep 4.5 out of 5</h2>
            <p className="section-sub">Notes from early adventurers echo through the hall.</p>
          </div>
          <div className="orn-divider" />
          <div className="split-grid spacious rating-grid">
            <div className="card rating-card quest-scroll card--hero-frame">
              <div className="rating-row" aria-label="Rated 4.5 out of 5 stars">
                <div className="star-row" aria-hidden="true">
                  <span className="star star--full"><span className="star-fill" /></span>
                  <span className="star star--full"><span className="star-fill" /></span>
                  <span className="star star--full"><span className="star-fill" /></span>
                  <span className="star star--full"><span className="star-fill" /></span>
                  <span className="star star--half"><span className="star-fill" /></span>
                </div>
                <span className="rating-score">4.5 average</span>
              </div>
            </div>
            <div className="stack">
              <div className="card testimonial-card quest-scroll card--hero-frame">
                <blockquote>
                  This service is awesome, and it really helped me in my macro econ course! Group
                  study via RunePrep was really effective for my friends and I.
                </blockquote>
                <div className="testimonial-author">— Daniel Pinaud, UCSD Senior</div>
              </div>
              <div className="card testimonial-card quest-scroll card--hero-frame">
                <blockquote>
                  RunePrep made our review sessions feel structured instead of chaotic. The party
                  flow kept everyone focused and we finished faster than usual.
                </blockquote>
                <div className="testimonial-author">— Russell Arashi, UCSD Senior</div>
              </div>
              <div className="card testimonial-card quest-scroll card--hero-frame">
                <blockquote>
                  I love that I can study solo and then host a quick quiz for my friends. The
                  party flow made cramming feel focused.
                </blockquote>
                <div className="testimonial-author">— Jeremy Jor, UCSD Sophomore</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="slab slab--steps rpg-reveal">
        <div className="section-divider" aria-hidden="true" />
        <div className="quest-panel panel--parchment panel--hero-frame">
          <div className="slab-header">
            <div className="chapter-head">
              <span className="chapter-pill">Chapter I</span>
              <span className="chapter-title">The Path</span>
              <span className="chapter-line" />
            </div>
            <h2 className="section-title pixel-title">How it works</h2>
            <p className="section-sub">Upload materials, generate a quiz, then run a live party.</p>
          </div>
          <div className="orn-divider" />
          <div className="steps-grid">
            <div className="step">
              <span className="badge">1</span>
              <div>
                <strong>Upload materials</strong>
                <p className="muted">
                  Upload anything, from slides, lecture transcripts to class notes, it doesn't
                  matter, we’ll take it all!
                </p>
              </div>
            </div>
            <div className="step">
              <span className="badge">2</span>
              <div>
                <strong>Generate a quiz</strong>
                <p className="muted">
                  Based on what you upload, we instantly turn it into quiz questions and a
                  ready-to-host group test built from your exact material.
                </p>
              </div>
            </div>
            <div className="step">
              <span className="badge">3</span>
              <div>
                <strong>Play together</strong>
                <p className="muted">
                  Share a link or code and everyone joins the same live round, answering in sync
                  while the host controls the pace, reveals answers, and everyone sees scores update
                  in real time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="slab slab--modes rpg-reveal">
        <div className="section-divider" aria-hidden="true" />
        <div className="quest-panel panel--notice panel--hero-frame">
          <div className="slab-header">
            <div className="chapter-head">
              <span className="chapter-pill">Chapter II</span>
              <span className="chapter-title">Study Modes</span>
              <span className="chapter-line" />
            </div>
            <h2 className="section-title pixel-title">Two ways to quiz</h2>
            <p className="section-sub">
              Upload notes once, then instantly get a solo quiz and a group test.
            </p>
          </div>
          <div className="orn-divider" />
          <div className="mode-grid">
            <div className="card stack mode-card quest-scroll">
              <span className="path-meta">Solo quiz</span>
              <p className="muted">
                Run quick quiz rounds on your own. See answers right away and replay missed
                questions until they stick.
              </p>
              <div className="mode-steps">
                <div className="mode-step">
                  <span className="badge">1</span>
                  <span>Generate a quiz from your notes.</span>
                </div>
                <div className="mode-step">
                  <span className="badge">2</span>
                  <span>Answer fast and see results.</span>
                </div>
                <div className="mode-step">
                  <span className="badge">3</span>
                  <span>Review misses and run another round.</span>
                </div>
              </div>
            </div>
            <div className="card stack mode-card quest-scroll">
              <span className="path-meta">Party quiz</span>
              <p className="muted">
                Turn notes into a group test in seconds. Share a link, run the quiz live,
                and see scores update together.
              </p>
              <div className="mode-steps">
                <div className="mode-step">
                  <span className="badge">1</span>
                  <span>Create a quiz in Forge.</span>
                </div>
                <div className="mode-step">
                  <span className="badge">2</span>
                  <span>Start a live party.</span>
                </div>
                <div className="mode-step">
                  <span className="badge">3</span>
                  <span>Share the code and play.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="slab slab--mission rpg-reveal">
        <div className="section-divider" aria-hidden="true" />
        <div className="quest-panel panel--stone panel--hero-frame">
          <div className="slab-header">
            <div className="chapter-head">
              <span className="chapter-pill">Chapter III</span>
              <span className="chapter-title">Our Mission</span>
              <span className="chapter-line" />
            </div>
            <h2 className="section-title pixel-title">Make studying a shared ritual</h2>
            <p className="section-sub">
              We’re building RunePrep so learning feels like a party, not a solo grind.
            </p>
          </div>
          <div className="orn-divider" />
          <div className="stack" style={{ maxWidth: 860 }}>
            <p className="muted">
              Study sessions are better when they’re social. RunePrep turns notes into multiplayer
              quizzes so friends, classmates, and study groups can practice together.
            </p>
            <p className="muted">
              Our goal is simple: keep learning communal, encourage consistency, and make progress
              feel shared.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
