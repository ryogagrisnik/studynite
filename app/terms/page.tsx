import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Read the RunePrep terms of service, usage guidelines, subscriptions, and liability limits.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service | RunePrep",
    description:
      "Read the RunePrep terms of service, usage guidelines, subscriptions, and liability limits.",
    url: "/terms",
    type: "article",
  },
  twitter: {
    card: "summary",
    title: "Terms of Service | RunePrep",
    description:
      "Read the RunePrep terms of service, usage guidelines, subscriptions, and liability limits.",
  },
};

export default function Terms() {
  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="stack">
        <h1 className="page-title">Terms of Service</h1>
        <div className="card" style={{ background: "var(--green-soft)" }}>
          <em>
            Disclaimer: RunePrep lets you upload your own materials. You are responsible for
            ensuring you have the rights to share and use any content you upload.
          </em>
        </div>
        <h3>Agreement</h3>
        <p>By using RunePrep, you accept these terms.</p>
        <h3>Use of service</h3>
        <p>Use RunePrep for personal or classroom study. Abuse may result in limits or termination.</p>
        <h3>Accounts & security</h3>
        <p>Hosts must keep their credentials secure. Joiners participate with a display name only.</p>
        <h3>Content handling</h3>
        <p>
          Uploaded source materials are processed to generate quizzes, then discarded.
          Decks and game results are stored according to your account settings.
        </p>
        <h3>Payments & subscriptions</h3>
        <p>
          Paid plans are billed through Stripe. You may cancel anytime from the billing portal and
          your access remains active until the end of the billing period.
        </p>
        <h3>Limitation of liability</h3>
        <p>RunePrep is provided as-is without warranties.</p>
        <h3>Governing law</h3>
        <p>Applicable local laws apply.</p>
      </div>
    </div>
  );
}
