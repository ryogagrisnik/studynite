import Link from 'next/link';
import Image from 'next/image';
import FlashcardsSample from '../components/flashcardssample'; // NEW
import Reveal from '../components/Reveal';
import CounterStat from '../components/CounterStat';

export default function Home() {
  return (
    <>
      {/* Banner */}
      <section className="banner bleed">
        <div className="banner-inner">
          <img
            src="/assets/rara.png"
            alt="More Practice, More Solutions With BlobPrep"
            className="banner-img"
          />
        </div>
      </section>

      {/* Proof metrics */}
      <section className="metrics bleed">
        <div className="metrics-inner">
          <h3>Results that compound</h3>
          <p className="sub">Students practice smarter with BlobPrep and see measurable gains.</p>
          <div className="metrics-grid">
            <div className="metric">
              <Reveal>
                <CounterStat value={12000} suffix="+" />
                <div className="metric__label">Questions generated</div>
              </Reveal>
            </div>
            <div className="metric">
              <Reveal delay={80}>
                <CounterStat value={91} suffix="%" />
                <div className="metric__label">Avg. explanation helpfulness</div>
              </Reveal>
            </div>
            <div className="metric">
              <Reveal delay={160}>
                <CounterStat value={5.99} prefix="$" decimals={2} />
                <div className="metric__label">Unlimited monthly practice</div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HERO (gradient + subtle pattern + curved divider) ===== */}
      <section className="hero-wrap bleed">
        <div className="hero">
          <div>
            <h1 className="split__title">Infinite GRE & GMAT questions at your fingertips.</h1>
            <p className="split__lead">15 free questions every day. Unlimited for just <strong>$5.99/month</strong>.</p>
            <ul className="split__bullets">
              <li><span className="split__dot" />Targeted GRE & GMAT practice by skill</li>
              <li><span className="split__dot" />Instant explanations with step‑by‑step solutions</li>
              <li><span className="split__dot" />Track accuracy and time to improve speed</li>
            </ul>
            <div style={{ marginTop: 18 }}>
              <Link className="btn btn-primary btn-large" href="/practice">Get Started</Link>
            </div>
          </div>

          <div>
            <div className="split__frame">
              <img
                src="/assets/hero.jpg?v=3"
                alt="Students taking an exam"
              />
            </div>
          </div>
        </div>

        {/* Curved divider */}
        <svg
          className="hero-divider"
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0,40 C240,120 480,0 720,40 C960,80 1200,0 1440,40 L1440,120 L0,120 Z" fill="#fff" />
        </svg>
      </section>

      {/* 🔶 TICKER — full bleed, long, smooth */}
      <section
        className="ticker bleed"
        role="region"
        aria-label="BlobPrep highlights"
        aria-live="polite"
      >
        <div className="ticker__mask">
          <div className="ticker__track">
            <div className="ticker__row">
              <span className="ticker__item">• 100+ point score improvement potential</span>
              <span className="ticker__item">• Data Sufficiency and Problem Solving covered end-to-end</span>
              <span className="ticker__item">• Sentence Correction and Critical Reasoning made simpler</span>
              <span className="ticker__item">• Review your misses with instant explanations</span>
              <span className="ticker__item">• 2,000+ GRE and GMAT practice questions generated</span>
              <span className="ticker__item">• Track accuracy by topic with detailed stats</span>
              <span className="ticker__item">• Save 2–3 hours weekly with focused practice</span>
              <span className="ticker__item">• Study smarter, not longer</span>
              <span className="ticker__item">• See accuracy improve session after session</span>
              <span className="ticker__item">• Comprehensive coverage of GMAT and GRE topics</span>
              <span className="ticker__item">• Results you can measure, every time</span>
            </div>
            <div className="ticker__row" aria-hidden="true">
              <span className="ticker__item">• 100+ point score improvement potential</span>
              <span className="ticker__item">• Data Sufficiency and Problem Solving covered end-to-end</span>
              <span className="ticker__item">• Sentence Correction and Critical Reasoning made simpler</span>
              <span className="ticker__item">• Review your misses with instant explanations</span>
              <span className="ticker__item">• 2,000+ GRE and GMAT practice questions generated</span>
              <span className="ticker__item">• Track accuracy by topic with detailed stats</span>
              <span className="ticker__item">• Save 2–3 hours weekly with focused practice</span>
              <span className="ticker__item">• Study smarter, not longer</span>
              <span className="ticker__item">• See accuracy improve session after session</span>
              <span className="ticker__item">• Comprehensive coverage of GMAT and GRE topics</span>
              <span className="ticker__item">• Results you can measure, every time</span>
            </div>
          </div>
        </div>
      </section>

      {/* Alternating split sections (retain brand colors/images) */}
      <section className="split-wrap">
        <div className="split">
          <Reveal className="split__visual">
            <div className="split__frame">
              <Image src="/assets/max-score.jpg" alt="Maximize score gains visual" width={1800} height={1200} style={{ width: '100%', height: 'auto', borderRadius: 16 }} />
            </div>
          </Reveal>
          <Reveal className="split__copy" delay={80}>
            <h2 className="split__title">Maximize score gains per minute</h2>
            <p className="split__lead">
              Pinpoint the topics that move your score. Practice in a clean, fast flow with instant
              explanations and a review queue that keeps you progressing.
            </p>
            <ul className="split__bullets">
              <li><span className="split__dot" />Targeted GRE & GMAT questions by skill</li>
              <li><span className="split__dot" />Immediate feedback with step‑by‑step solutions</li>
              <li><span className="split__dot" />Track accuracy and time to improve speed</li>
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="split-wrap tinted">
        <div className="split split--reverse">
          <Reveal className="split__copy">
            <h2 className="split__title">A personalized training plan that fits your life</h2>
            <p className="split__lead">
              BlobPrep adapts to your goals and schedule. Bite‑sized sessions make it easy to be
              consistent and see real results.
            </p>
            <ul className="split__bullets">
              <li><span className="split__dot" />Smart difficulty ramp tailored to you</li>
              <li><span className="split__dot" />Save misses automatically for quick review</li>
              <li><span className="split__dot" />Study anywhere — desktop or phone</li>
            </ul>
          </Reveal>
          <Reveal className="split__visual" delay={80}>
            <div className="split__frame">
              <Image src="/assets/Library.jpg" alt="Study anywhere on BlobPrep" width={1600} height={1000} style={{ width: '100%', height: 'auto', borderRadius: 16 }} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Features */}
      <section className="section">
        <div className="grid3">
          <div className="feature">
            <h4>One question at a time</h4>
            <p>
              Practice in a focused, single-card flow—no feeds, no tabs. Each prompt arrives on its
              own with an optional timer and scratch area so you can think clearly, answer, and move
              on. Missed items are auto-saved to a review queue you can revisit anytime.
            </p>
          </div>
          <div className="feature">
            <h4>Instant feedback</h4>
            <p>
              Submit and immediately see whether you’re right, plus a step-by-step solution showing
              the setup, key moves, and common traps. We also highlight quicker methods so you keep
              sharpening your test-taking speed.
            </p>
          </div>
          <div className="feature">
            <h4>Clear, easy‑to‑understand explanations</h4>
            <p>
              Each solution uses plain language and concise steps so the idea lands quickly. We also
              include key definitions and a brief “why it works” note, with links to practice more on
              the same concept when you want to go deeper.
            </p>
          </div>
          <div className="feature">
            <h4>Endless questions</h4>
            <p>
              Never run out of practice. With a constantly refreshed pool of GRE and GMAT problems
              across all difficulty levels, you’ll always have new material to sharpen your skills
              and prevent memorization. Fresh challenges keep prep engaging and effective.
            </p>
          </div>
        </div>
      </section>

      {/* NEW: Interactive sample flashcards */}
      <section className="section center">
        <h2>Try a few sample questions</h2>
        <p>Answer to see instant feedback.</p>
        <div style={{ marginTop: 16 }}>
          <FlashcardsSample count={4} />
        </div>
      </section>

      {/* Value band — buyer-focused highlights */}
      <section className="value-wrap bleed">
        <div className="value">
          <h2 className="center">Why students choose BlobPrep</h2>
          <div className="value__grid">
            <Reveal className="value__item">
              <div className="value__icon">⏱️</div>
              <div className="value__title">Score gains per minute</div>
              <p>Short, targeted sessions that maximize improvement in limited time.</p>
            </Reveal>
            <Reveal className="value__item" delay={60}>
              <div className="value__icon">🧭</div>
              <div className="value__title">Personalized path</div>
              <p>Adaptive review focuses practice on your weak spots automatically.</p>
            </Reveal>
            <Reveal className="value__item" delay={120}>
              <div className="value__icon">💡</div>
              <div className="value__title">Clear explanations</div>
              <p>Plain‑English steps with “why it works” so concepts stick.</p>
            </Reveal>
            <Reveal className="value__item" delay={180}>
              <div className="value__icon">📊</div>
              <div className="value__title">Track what matters</div>
              <p>Accuracy and timing by topic help you study smarter.</p>
            </Reveal>
            <Reveal className="value__item" delay={240}>
              <div className="value__icon">📱</div>
              <div className="value__title">Anywhere, anytime</div>
              <p>Works great on desktop or phone—fit study into your day.</p>
            </Reveal>
          </div>
          <div className="center" style={{ marginTop: 28 }}>
            <Link className="btn btn-primary btn-large" href="/practice">Start Practicing Free</Link>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="pricing section center">
        <h2>Simple, honest pricing</h2>
        <p className="sub">Pick what fits your grind. You can switch anytime.</p>

        <div className="pricing-grid">
          <div className="plan">
            <div className="plan__title">Free</div>
            <div className="plan__price">
              <span className="num">$0</span>
              <span className="per">/forever</span>
            </div>
            <p className="plan__blurb">
              Try BlobPrep at no cost. Great for quick daily practice and keeping skills fresh.
            </p>
            <ul className="plan__features">
              <li><span className="plan__dot" />15 questions/day (GRE + GMAT)</li>
              <li><span className="plan__dot" />Timed or untimed mode</li>
              <li><span className="plan__dot" />Step-by-step solutions</li>
              <li><span className="plan__dot" />Review queue for missed items</li>
            </ul>
            <Link href="/practice" className="plan__cta">Start free</Link>
          </div>

          <div className="plan plan--pro">
            <span className="plan__badge">Most Popular</span>
            <div className="plan__title">Pro</div>
            <div className="plan__price">
              <span className="num">$5.99</span>
              <span className="per">/month</span>
            </div>
            <p className="plan__blurb">
              Unlimited practice with smarter review so you master weak spots fast.
            </p>
            <ul className="plan__features">
              <li><span className="plan__dot" />Unlimited questions (GRE + GMAT)</li>
              <li><span className="plan__dot" />Personalized review & difficulty ramp</li>
              <li><span className="plan__dot" />Quick-tip speed strategies</li>
              <li><span className="plan__dot" />Priority updates and new question packs</li>
              <li><span className="plan__dot" />Cancel anytime</li>
            </ul>
            <Link href="/practice" className="plan__cta">Go Pro</Link>
          </div>
        </div>
      </section>

      {/* Slim page end */}
    </>
  );
}
