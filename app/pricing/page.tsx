import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple pricing for RunePrep: create multiplayer quizzes from your notes and host live study parties.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "RunePrep Pricing",
    description:
      "Simple pricing for RunePrep: create multiplayer quizzes from your notes and host live study parties.",
    url: "/pricing",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "RunePrep Pricing",
    description:
      "Simple pricing for RunePrep: create multiplayer quizzes from your notes and host live study parties.",
  },
};

export default async function Pricing() {
  return (
    <div className="page stack pixel-ui">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: "RunePrep",
            description:
              "Turn your notes into multiplayer quizzes and host live study parties.",
            brand: { "@type": "Brand", name: "RunePrep" },
            offers: [
              {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
                category: "free",
                name: "Free",
              },
            ],
          }),
        }}
      />
      <div className="container stack" style={{ alignItems: "center" }}>
        <section className="pricing rpg-reveal" id="pricing">
          <div className="rune-announcement">
            <h1 className="rune-title">Pro tier coming soon</h1>
          </div>
        </section>
      </div>
    </div>
  );
}
