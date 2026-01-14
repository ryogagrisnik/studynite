import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
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

export default async function Pricing() {
  const session = await getServerSession(authOptions);
  const userAny = session?.user as any;
  const isPro =
    Boolean(userAny?.isPro) ||
    (userAny?.proExpiresAt ? new Date(userAny.proExpiresAt).getTime() > Date.now() : false);
  const proExpiresAt = userAny?.proExpiresAt
    ? new Date(userAny.proExpiresAt).toLocaleDateString()
    : null;

  return (
    <div className="page stack pixel-ui">
      <div className="container stack">
        <div className="stack" style={{ alignItems: "center", textAlign: "center" }}>
          <h1 className="page-title">Pricing</h1>
          <p className="page-sub">
            Pick your path. Free keeps the quest moving, Pro unlocks the long runs.
          </p>
          <div className="row">
            <span className="badge">Up to {PRO_MAX_QUESTION_COUNT} questions</span>
            <span className="badge">{PRO_DAILY_DECK_LIMIT} decks/day</span>
            <span className="badge">Unlimited practice</span>
          </div>
        </div>

        <div className="grid-2 compare-grid">
          <div className="card compare-card">
            <span className="compare-pill">Free includes</span>
            <ul className="compare-list">
              <li className="compare-item">
                <span className="compare-dot" />
                Up to {FREE_MAX_QUESTION_COUNT} questions and {FREE_MAX_FLASHCARD_COUNT} flashcards per deck.
              </li>
              <li className="compare-item">
                <span className="compare-dot" />
                {FREE_DAILY_DECK_LIMIT} new decks per day.
              </li>
              <li className="compare-item">
                <span className="compare-dot" />
                {FREE_REGENERATE_LIMIT} regenerations per deck.
              </li>
              <li className="compare-item">
                <span className="compare-dot" />
                Up to {PRACTICE_LIMIT} practice questions per 12-hour window.
              </li>
            </ul>
          </div>
          <div className="card compare-card compare-card--pro">
            <span className="compare-pill compare-pill--pro">Pro includes</span>
            <ul className="compare-list">
              <li className="compare-item">
                <span className="compare-dot compare-dot--pro" />
                Up to {PRO_MAX_QUESTION_COUNT} questions and {PRO_MAX_FLASHCARD_COUNT} flashcards per deck.
              </li>
              <li className="compare-item">
                <span className="compare-dot compare-dot--pro" />
                {PRO_DAILY_DECK_LIMIT} new decks per day.
              </li>
              <li className="compare-item">
                <span className="compare-dot compare-dot--pro" />
                {PRO_REGENERATE_LIMIT} regenerations per deck.
              </li>
              <li className="compare-item">
                <span className="compare-dot compare-dot--pro" />
                Unlimited practice questions.
              </li>
            </ul>
          </div>
        </div>

        <section className="pricing rpg-reveal" id="pricing">
          <div className="quest-panel panel--parchment">
            <div className="slab-header">
              <div className="chapter-head">
                <span className="chapter-pill">Chapter V</span>
                <span className="chapter-title">The Ledger</span>
                <span className="chapter-line" />
              </div>
              <h2 className="section-title pixel-title">Free vs Pro</h2>
              <p className="section-sub">
                Free is great for short quests. Pro removes the practice cap and raises limits for
                marathon sessions.
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
                <p className="plan__blurb">Best for quick quests and small squads.</p>
                <ul className="plan__features">
                  <li>
                    <span className="plan__dot" />
                    Up to {FREE_MAX_QUESTION_COUNT} questions and {FREE_MAX_FLASHCARD_COUNT} flashcards per deck.
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
                <Link className="plan__cta" href="/signup?callbackUrl=/pricing">
                  Start free
                </Link>
              </div>

              <div className="plan plan--pro">
                <span className="plan__badge">Pro</span>
                <h3 className="plan__title">Pro</h3>
                <div className="plan__price">
                  <span className="num">$5.99</span>
                  <span className="per">monthly</span>
                </div>
                <p className="plan__blurb">For long raids, big squads, and endless practice.</p>
                <ul className="plan__features">
                  <li>
                    <span className="plan__dot" />
                    Up to {PRO_MAX_QUESTION_COUNT} questions and {PRO_MAX_FLASHCARD_COUNT} flashcards per deck.
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
                {session ? (
                  isPro ? (
                    <div className="stack" style={{ alignItems: "center" }}>
                      <strong>Pro is active</strong>
                      <span className="muted">
                        {proExpiresAt ? `Renews on ${proExpiresAt}.` : "Your subscription is active."}
                      </span>
                      <form action="/api/billing/portal" method="POST">
                        <button className="plan__cta" type="submit">
                          Manage billing
                        </button>
                      </form>
                      <form action="/api/billing/cancel" method="POST">
                        <button className="btn btn-outline" type="submit">
                          Cancel subscription
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="stack" style={{ alignItems: "center" }}>
                      <form action="/api/checkout" method="POST">
                        <input type="hidden" name="plan" value="monthly" />
                        <button className="plan__cta" type="submit">
                          Buy Pro monthly
                        </button>
                      </form>
                      <span className="muted">Cancel anytime from the billing portal.</span>
                    </div>
                  )
                ) : (
                  <div className="stack" style={{ alignItems: "center" }}>
                    <Link className="plan__cta" href="/signin?callbackUrl=/pricing">
                      Sign in to buy
                    </Link>
                    <Link className="text-link" href="/signup?callbackUrl=/pricing">
                      Create account
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
