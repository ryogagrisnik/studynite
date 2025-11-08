"use client";
import Reveal from "@/components/Reveal";
import TestimonialCarousel from "@/components/TestimonialCarousel";
import StickyCTA from "@/components/StickyCTA";

const comparisonRows = [
  {
    label: 'Adaptive question rotation',
    blobprep: 'Included',
    traditional: 'Static sets',
  },
  {
    label: 'Instant KaTeX explanations',
    blobprep: 'Included',
    traditional: 'Limited / text-only',
  },
  {
    label: 'Unlimited practice analytics',
    blobprep: 'Unlimited with Pro',
    traditional: 'Manual tracking',
  },
  {
    label: 'GRE + GMAT coverage',
    blobprep: 'Both exams',
    traditional: 'Often separate',
  },
  {
    label: 'Cancel anytime guarantee',
    blobprep: 'Yes',
    traditional: 'Contracts & fees',
  },
];

const planFeatures = [
  'Unlimited GRE + GMAT practice',
  'Topic and difficulty targeting',
  'Accuracy dashboards & streak tracking',
  'Early access to new drills & flashcards',
];

const sellingPoints = [
  {
    title: 'Personalized practice',
    copy: 'Choose the exam you need and drill one focused question at a time with instant feedback.',
  },
  {
    title: 'Score-ready analytics',
    copy: 'See accuracy by topic and difficulty so you know exactly where to spend the next rep.',
  },
  {
    title: 'Trusted explanations',
    copy: 'Clean KaTeX walk-throughs help you understand the “why” without wading through walls of text.',
  },
];

export default function Pricing() {
  return (
      <div className="pricing-page">
        <StickyCTA targetId="plan-card-anchor" />
        <section className="hero">
          <div className="hero__lead">
          <span className="hero__tag">Your tailored prep companion</span>
          <h1>
            Unlock ultra-focused GRE &amp; GMAT practice. <span>Try Pro for free.</span>
          </h1>
          <p>
            Join thousands of learners drilling smarter with BlobPrep. One clean prompt at a time,
            with explanations that actually teach.
          </p>
        </div>

        <div className="plan-card" id="plan-card-anchor">
          <header className="plan-card__header">
            <span className="badge">Early‑adopter pricing</span>
            <span>BlobPrep Pro</span>
            <small>Unlimited mode</small>
          </header>
          <div className="plan-card__price">
            <strong>$5.99</strong>
            <span>/ month</span><span className="anchor"> <s>$9.99</s></span>
          </div>
          <p className="plan-card__bill">Billed monthly. Pause or cancel anytime.</p>
          <ul className="plan-card__features">
            {planFeatures.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          <form action="/api/checkout" method="post">
            <button className="btn btn-primary btn-large" style={{ width: '100%' }}>Upgrade for $5.99/mo</button>
          </form>
          <p className="plan-card__footnote">🔒 Secure billing with Stripe • Cancel anytime</p>
        </div>
      </section>

        <section className="selling">
        <div className="selling__list">
          {sellingPoints.map((point) => (
            <article key={point.title} className="selling__item">
              <span className="selling__icon" aria-hidden="true">✓</span>
              <div>
                <h3>{point.title}</h3>
                <p>{point.copy}</p>
              </div>
            </article>
          ))}
        </div>

        <aside className="testimonial">
          <TestimonialCarousel
            items={[
              { quote: 'The one-question flow kept me focused and my quant score jumped 13 points in 8 weeks.', author: 'Daniel Pinad, UCSD Senior', tag: 'GRE' },
              { quote: 'Clear explanations with the “why” saved me hours. I knew exactly what to practice next.', author: 'Sophie Agnes, Rutgers Senior', tag: 'GMAT' },
              { quote: 'I used the review queue on my phone every day. Tiny sessions added up fast.', author: 'Nidal Aurelia, UCLA Senior', tag: 'Daily habits' },
            ]}
          />
        </aside>
      </section>

        <section className="comparison">
        <h2>What makes BlobPrep different</h2>
        <div className="comparison__table">
          <div className="comparison__head">
            <span></span>
            <span>BlobPrep</span>
            <span>Traditional prep books</span>
          </div>
          {comparisonRows.map((row) => (
            <div className="comparison__row" key={row.label}>
              <span>{row.label}</span>
              <span className="comparison__check">{row.blobprep}</span>
              <span className="comparison__muted">{row.traditional}</span>
            </div>
          ))}
        </div>
      </section>

        <section className="faq">
          <h2>Frequently asked questions</h2>
          <details>
            <summary>Can I cancel anytime?</summary>
            <p>Yes. Pro is billed monthly and you can pause or cancel from your account in seconds.</p>
          </details>
          <details>
            <summary>Do you offer a free trial?</summary>
            <p>You can start free and upgrade when you want unlimited practice and review.</p>
          </details>
          <details>
            <summary>What exams do you cover?</summary>
            <p>Both GRE and GMAT with topic targeting for Quant and Verbal.</p>
          </details>
        </section>

        <section className="cta-final">
        <div className="cta-final__content">
          <h2>Take BlobPrep Pro for a spin</h2>
          <p>Start drilling in seconds. Keep the gains, cancel anytime.</p>
        </div>
        <form action="/api/checkout" method="post">
          <button className="cta-button cta-button--wide">Start Pro for $5.99/mo</button>
        </form>
        </section>
      <style jsx>{`
        .pricing-page {
          display: grid;
          gap: clamp(36px, 5vw, 56px);
          padding: clamp(48px, 6vw, 76px) clamp(24px, 6vw, 72px) 120px;
          position: relative;
          max-width: 1040px;
          margin: 0 auto;
        }

        .hero {
          display: grid;
          gap: clamp(24px, 4vw, 40px);
          align-items: start;
          grid-template-columns: 1.1fr .9fr;
        }

        .hero__lead {
          display: grid;
          gap: 18px;
        }

        .hero__tag {
          font-size: 12px;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: rgba(67, 20, 7, 0.6);
        }

        h1 {
          margin: 0;
          font-size: clamp(36px, 5vw, 54px);
          line-height: 1.05;
          color: #2f1104;
        }

        h1 span {
          color: #f77f00;
        }

        .hero__lead p {
          margin: 0;
          font-size: 18px;
          line-height: 1.75;
          max-width: 560px;
          color: rgba(47, 17, 4, 0.74);
        }

        .plan-card {
          position: sticky;
          top: 18px;
          border-radius: 28px;
          padding: clamp(28px, 3.6vw, 40px);
          background: #fff;
          color: var(--brown);
          border: 2px solid #f5e5d6;
          box-shadow: var(--shadow);
        }
        /* removed animated border ring by request */

        .plan-card__header {
          position: relative;
          display: grid;
          gap: 4px;
          font-size: 14px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          opacity: 0.85;
        }
        .badge{ display:inline-block; background: var(--orange); color:#fff; font-weight:800; border-radius:999px; padding:4px 10px; font-size:11px; letter-spacing:.08em; justify-self:start; }

        .plan-card__price {
          position: relative;
          display: flex;
          align-items: baseline;
          gap: 12px;
          font-size: clamp(44px, 5vw, 56px);
          font-weight: 800;
          margin: 18px 0;
        }

        .plan-card__price span {
          font-size: 16px;
          font-weight: 600;
          opacity: 0.8;
        }
        .plan-card__price .anchor{ font-size:14px; opacity:.5; }

        .plan-card__bill {
          position: relative;
          margin: 0 0 18px;
          font-size: 15px;
          opacity: 0.85;
        }

        .plan-card__features {
          position: relative;
          list-style: none;
          margin: 0 0 24px;
          padding: 0;
          display: grid;
          gap: 12px;
          font-size: 15px;
        }

        .plan-card__features li {
          position: relative;
          padding-left: 26px;
        }

        .plan-card__features li::before {
          content: '';
          position: absolute;
          left: 0;
          top: 7px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--orange);
          opacity: 0.9;
        }

        .plan-card__footnote {
          margin: 16px 0 0;
          font-size: 12px;
          opacity: 0.75;
        }

        .cta-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 12px 28px;
          border-radius: 999px;
          border: none;
          font-weight: 700;
          font-size: 16px;
          background: #ffffff;
          color: #f77f00;
          cursor: pointer;
          box-shadow: 0 18px 44px rgba(0, 0, 0, 0.18);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .cta-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 26px 56px rgba(0, 0, 0, 0.22);
        }

        .selling {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: clamp(18px, 3vw, 28px);
          align-items: start;
        }

        .selling__list {
          display: grid;
          gap: 16px;
        }

        .selling__item {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 14px;
          padding: 18px 22px;
          border-radius: 20px;
          background: #ffffff;
          border: 1px solid rgba(249, 177, 84, 0.18);
          box-shadow: 0 18px 46px rgba(249, 177, 84, 0.1);
        }

        .selling__icon {
          align-self: start;
          background: rgba(247, 127, 0, 0.15);
          color: #f77f00;
          width: 28px;
          height: 28px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          font-weight: 700;
        }

        .selling__item h3 {
          margin: 0 0 6px;
          font-size: 18px;
          color: #2f1104;
        }

        .selling__item p {
          margin: 0;
          color: rgba(47, 17, 4, 0.68);
          font-size: 14px;
        }

        .testimonial {
          border-radius: 24px;
          background: linear-gradient(145deg, #fff2e1 0%, #ffffff 70%);
          border: 1px solid rgba(249, 177, 84, 0.24);
          box-shadow: 0 24px 64px rgba(249, 177, 84, 0.16);
          padding: clamp(24px, 3vw, 34px);
          display: grid;
          gap: 16px;
        }
        /* trust chips removed */

        .how{ display:grid; gap:16px; }
        .how h2{ margin:0; font-size:clamp(24px,3vw,32px); color:#2f1104; }
        .how__grid{ display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:14px; }
        .how__step{ background:#fff; border:1px solid rgba(249,177,84,.22); border-radius:16px; padding:16px; box-shadow:0 10px 26px rgba(249,177,84,.12); }
        .how__step h3{ margin:8px 0 6px; font-size:18px; color:#2f1104; }
        .how__step p{ margin:0; color:rgba(47,17,4,.72); }
        .how__num{ width:28px; height:28px; border-radius:999px; background:#fff2e1; color:#f77f00; font-weight:800; display:grid; place-items:center; }

        .testimonial__score {
          display: grid;
          gap: 6px;
        }

        .testimonial__range {
          font-size: 22px;
          font-weight: 700;
          color: #f77f00;
        }

        blockquote {
          margin: 0;
          font-size: 16px;
          line-height: 1.6;
          color: rgba(47, 17, 4, 0.78);
        }

        .testimonial footer {
          font-size: 13px;
          color: rgba(47, 17, 4, 0.6);
        }

        .comparison {
          display: grid;
          gap: 22px;
        }

        .comparison h2 {
          margin: 0;
          font-size: clamp(24px, 3vw, 32px);
          color: #2f1104;
        }

        .comparison__table {
          border-radius: 28px;
          background: #ffffff;
          border: 1px solid rgba(249, 177, 84, 0.16);
          box-shadow: 0 32px 74px rgba(249, 177, 84, 0.12);
          overflow: hidden;
          display: grid;
        }

        .comparison__head,
        .comparison__row {
          display: grid;
          grid-template-columns: minmax(200px, 1fr) 160px 200px;
          gap: 18px;
          padding: 16px clamp(18px, 4vw, 36px);
          align-items: center;
        }

        .comparison__head {
          background: rgba(247, 177, 84, 0.12);
          font-weight: 700;
          color: #431407;
        }

        .comparison__row:nth-child(even) {
          background: rgba(249, 177, 84, 0.08);
        }

        .comparison__check {
          color: #f77f00;
          font-weight: 600;
        }

        .comparison__muted {
          color: rgba(47, 17, 4, 0.5);
        }

        .cta-final {
          border-radius: 28px;
          background: linear-gradient(120deg, rgba(253, 186, 116, 0.18), rgba(247, 127, 0, 0.22));
          display: grid;
          gap: 18px;
          padding: clamp(28px, 3vw, 40px);
          align-items: center;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        }

        .cta-final__content h2 {
          margin: 0 0 6px;
          color: #2f1104;
          font-size: clamp(24px, 3vw, 32px);
        }

        .cta-final__content p {
          margin: 0;
          color: rgba(47, 17, 4, 0.7);
        }

        .cta-button--wide {
          width: 100%;
          background: #ffffff;
        }

        @media (max-width: 720px) {
          .comparison__head,
          .comparison__row {
            grid-template-columns: 1fr;
            gap: 6px;
            text-align: left;
          }
        }

        .faq { display: grid; gap: 12px; }
        .faq h2 { margin: 0 0 4px; font-size: clamp(22px, 3vw, 28px); color: #2f1104; }
        .faq details { border: 1px solid rgba(249,177,84,0.26); border-radius: 14px; padding: 12px 16px; background: #fff; }
        .faq summary { cursor: pointer; font-weight: 700; color: #2f1104; }
        .faq p { margin: 8px 0 0; color: rgba(47,17,4,.76); }

        :global(body), :global(html) {
          background-color: #fff;
        }
      `}</style>
    </div>
  );
}
