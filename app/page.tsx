import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { avatars } from "@/lib/studyhall/avatars";
import {
  FREE_DAILY_DECK_LIMIT,
  FREE_MAX_FLASHCARD_COUNT,
  FREE_MAX_QUESTION_COUNT,
  FREE_REGENERATE_LIMIT,
  PRO_DAILY_DECK_LIMIT,
  PRO_MAX_FLASHCARD_COUNT,
  PRO_MAX_QUESTION_COUNT,
  PRO_REGENERATE_LIMIT,
} from "@/lib/studyhall/constants";
import { PRACTICE_LIMIT } from "@/lib/server/practiceAccess";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const isAuthed = Boolean((session?.user as any)?.id);
  return (
    <div className="page stack home pixel-ui">
      <section className="hero-slab hero-slab--glow sparkle-layer rpg-reveal">
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
              <div className="row hero-cta">
                {isAuthed ? (
                  <Link className="btn btn-primary" href="/decks/new">
                    Begin Quest
                  </Link>
                ) : (
                  <Link className="btn btn-primary" href="/signup?callbackUrl=/decks/new">
                    Begin Quest
                  </Link>
                )}
              </div>
              {isAuthed ? null : null}
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
              <div className="row hero-party">
                <span className="muted">Meet your party:</span>
                <div className="hero-avatars">
                  {avatars.map((avatar, index) => (
                    <img
                      key={avatar.id}
                      className="avatar avatar-float"
                      style={{ animationDelay: `${index * 0.12}s` }}
                      src={avatar.src}
                      alt={avatar.label}
                    />
                  ))}
                </div>
              </div>
              <div className="inventory-grid">
                <div className="inventory-slot">
                  <span className="slot-icon slot-icon--deck" aria-hidden="true" />
                  <div>
                    <strong>Deck slots</strong>
                    <span className="muted">Unlimited</span>
                  </div>
                </div>
                <div className="inventory-slot">
                  <span className="slot-icon slot-icon--key" aria-hidden="true" />
                  <div>
                    <strong>Party keys</strong>
                    <span className="muted">Free</span>
                  </div>
                </div>
                <div className="inventory-slot">
                  <span className="slot-icon slot-icon--party" aria-hidden="true" />
                  <div>
                    <strong>Party cap</strong>
                    <span className="muted">12</span>
                  </div>
                </div>
                <div className="inventory-slot">
                  <span className="slot-icon slot-icon--mode" aria-hidden="true" />
                  <div>
                    <strong>Modes</strong>
                    <span className="muted">Quiz</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="card hero-media panel--notice">
              <div className="hero-media-inner">
                <img
                  className="hero-image"
                  src="/hero.png"
                  alt="RunePrep hero scene"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="slab slab--steps rpg-reveal">
        <div className="section-divider" aria-hidden="true" />
        <div className="quest-panel panel--parchment">
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
                  ready‑to‑host group test built from your exact material.
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
        <div className="quest-panel panel--notice">
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
                  <span>Generate a quiz from your notes instantly.</span>
                </div>
                <div className="mode-step">
                  <span className="badge">2</span>
                  <span>Share a link or code in one tap.</span>
                </div>
                <div className="mode-step">
                  <span className="badge">3</span>
                  <span>Run the test live and review results.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="slab slab--showcase rpg-reveal">
        <div className="section-divider" aria-hidden="true" />
        <div className="quest-panel panel--stone">
          <div className="split-grid spacious">
            <div className="card hero-media panel--notice">
              <img
                className="hero-image"
                src="/showcase.png"
                alt="RunePrep showcase"
              />
            </div>
            <div className="stack">
              <div className="chapter-head">
              <span className="chapter-pill">Chapter III</span>
              <span className="chapter-title">The Arena</span>
              <span className="chapter-line" />
            </div>
              <h2 className="section-title pixel-title">Level up anywhere</h2>
              <p className="section-sub">
                Run focused study sessions anywhere and keep everyone synced, even across devices.
              </p>
              <div className="orn-divider" />
              <div className="arena-points">
                <div className="arena-point">
                  <strong>Host from any device</strong>
                  <p className="muted">Phone, tablet, or laptop. No installs, just a link.</p>
                </div>
                <div className="arena-point">
                  <strong>Live pacing keeps everyone together</strong>
                  <p className="muted">
                    The host sets the tempo so your party answers the same questions at the same
                    time.
                  </p>
                </div>
                <div className="arena-point">
                  <strong>Instant feedback and recap</strong>
                  <p className="muted">Scores update each round with a quick summary at the end.</p>
                </div>
              </div>
              <div className="row" style={{ marginTop: 16 }}>
                <Link className="btn btn-outline" href="/how-it-works">
                  Open Leaderboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="slab slab--features rpg-reveal">
        <div className="section-divider" aria-hidden="true" />
        <div className="quest-panel panel--notice">
          <div className="slab-header">
            <div className="chapter-head">
              <span className="chapter-pill">Chapter IV</span>
              <span className="chapter-title">The Guild</span>
              <span className="chapter-line" />
            </div>
            <h2 className="section-title pixel-title">Built for group review</h2>
            <p className="section-sub">
              A clean HUD for party play: fast, readable, and focused.
            </p>
          </div>
          <div className="orn-divider" />
          <div className="two-col">
            <div className="stack feature-card quest-scroll">
              <strong>Track what matters</strong>
              <p className="muted">
                Timed trials, shared pace, and a clear scoreboard for instant feedback.
              </p>
            </div>
            <div className="stack feature-card quest-scroll">
              <strong>Study your way</strong>
              <p className="muted">Solo drills or party battles, all from the same quiz.</p>
            </div>
            <div className="stack feature-card quest-scroll">
              <strong>Private by default</strong>
              <p className="muted">
                Quizzes stay sealed unless you share. Source uploads vanish after forging.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="slab slab--pricing rpg-reveal" id="pricing">
        <div className="section-divider" aria-hidden="true" />
        <div className="quest-panel panel--parchment">
          <div className="slab-header">
            <div className="chapter-head">
              <span className="chapter-pill">Chapter V</span>
              <span className="chapter-title">The Ledger</span>
              <span className="chapter-line" />
            </div>
            <h2 className="section-title pixel-title">Pricing</h2>
            <p className="section-sub">
              Free keeps the party rolling with light caps. Pro unlocks longer runs, more daily
              decks, and unlimited practice.
            </p>
          </div>
          <div className="orn-divider" />
          <div className="pricing-grid">
            <div className="plan">
              <h3 className="plan__title">Free</h3>
              <div className="plan__price">
                <span className="num">$0</span>
                <span className="per">forever</span>
              </div>
              <p className="plan__blurb">Great for quick quests and casual review.</p>
              <ul className="plan__features">
                <li>
                  <span className="plan__dot" />
                  Forge up to {FREE_MAX_QUESTION_COUNT} questions and {FREE_MAX_FLASHCARD_COUNT} flashcards per deck.
                </li>
                <li>
                  <span className="plan__dot" />
                  {FREE_DAILY_DECK_LIMIT} new decks per day.
                </li>
                <li>
                  <span className="plan__dot" />
                  {FREE_REGENERATE_LIMIT} regenerations per deck.
                </li>
                <li>
                  <span className="plan__dot" />
                  Up to {PRACTICE_LIMIT} practice questions per 12-hour window.
                </li>
              </ul>
            </div>
            <div className="plan plan--pro">
              <span className="plan__badge">Pro</span>
              <h3 className="plan__title">Pro</h3>
              <div className="plan__price">
                <span className="num">$5.99</span>
                <span className="per">monthly</span>
              </div>
              <p className="plan__blurb">Built for long raids and bigger squads.</p>
              <ul className="plan__features">
                <li>
                  <span className="plan__dot" />
                  Forge up to {PRO_MAX_QUESTION_COUNT} questions and {PRO_MAX_FLASHCARD_COUNT} flashcards per deck.
                </li>
                <li>
                  <span className="plan__dot" />
                  {PRO_DAILY_DECK_LIMIT} new decks per day.
                </li>
                <li>
                  <span className="plan__dot" />
                  {PRO_REGENERATE_LIMIT} regenerations per deck.
                </li>
                <li>
                  <span className="plan__dot" />
                  Unlimited practice questions.
                </li>
              </ul>
              <Link className="plan__cta" href="/pricing">
                Buy Pro
              </Link>
            </div>
          </div>
          <p className="muted" style={{ textAlign: "center" }}>
            See the full loot list and checkout options on the pricing page.
          </p>
        </div>
      </section>

      <section className="slab slab--rating rpg-reveal">
        <div className="section-divider" aria-hidden="true" />
        <div className="quest-panel panel--notice">
          <div className="slab-header">
            <div className="chapter-head">
              <span className="chapter-pill">Chapter VI</span>
              <span className="chapter-title">Guild Wall</span>
              <span className="chapter-line" />
            </div>
            <h2 className="section-title pixel-title">Students rate RunePrep 4.5 out of 5</h2>
            <p className="section-sub">
              Notes from early adventurers echo through the hall.
            </p>
          </div>
          <div className="orn-divider" />
          <div className="split-grid spacious rating-grid">
            <div className="card rating-card quest-scroll">
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
              <div className="card testimonial-card quest-scroll">
                <blockquote>
                  This service is awesome, and it really helped me in my macro econ course! Group
                  study via RunePrep was really effective for my friends and I.
                </blockquote>
                <div className="testimonial-author">— Daniel Pinaud, UCSD Senior</div>
              </div>
              <div className="card testimonial-card quest-scroll">
                <blockquote>
                  RunePrep made our review sessions feel structured instead of chaotic. The party
                  flow kept everyone focused and we finished faster than usual.
                </blockquote>
                <div className="testimonial-author">— Russell Arashi, UCSD Senior</div>
              </div>
              <div className="card testimonial-card quest-scroll">
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

      <section className="slab slab--features rpg-reveal">
        <div className="section-divider" aria-hidden="true" />
        <div className="quest-panel panel--journal">
          <div className="slab-header">
            <div className="chapter-head">
              <span className="chapter-pill">Chapter VII</span>
              <span className="chapter-title">Achievements</span>
              <span className="chapter-line" />
            </div>
            <h2 className="section-title">Guild achievements</h2>
            <p className="section-sub">A quest journal of milestones and medals.</p>
          </div>
          <div className="orn-divider" />
          <div className="achievement-grid">
            <div className="achievement-card quest-scroll">
              <span className="achievement-icon" aria-hidden="true" />
              <div>
                <span className="achievement-title">Focused Scholar</span>
                <p className="muted">Complete 25 questions in a single session.</p>
              </div>
              <span className="achievement-rank">★</span>
            </div>
            <div className="achievement-card quest-scroll">
              <span className="achievement-icon" aria-hidden="true" />
              <div>
                <span className="achievement-title">Speed Sage</span>
                <p className="muted">Earn 5 fastest-answer bonuses in a party.</p>
              </div>
              <span className="achievement-rank">★</span>
            </div>
            <div className="achievement-card quest-scroll">
              <span className="achievement-icon" aria-hidden="true" />
              <div>
                <span className="achievement-title">Guild Leader</span>
                <p className="muted">Host 3 parties in one week.</p>
              </div>
              <span className="achievement-rank">★★</span>
            </div>
            <div className="achievement-card quest-scroll">
              <span className="achievement-icon" aria-hidden="true" />
              <div>
                <span className="achievement-title">Quizsmith</span>
                <p className="muted">Create 5 quizzes from class material.</p>
              </div>
              <span className="achievement-rank">★★</span>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
