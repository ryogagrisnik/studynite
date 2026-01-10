// app/layout.tsx
import "katex/dist/katex.min.css";
import "./globals.css";
import Link from "next/link";
import Image from "next/image";
import Providers from "./providers";
import Script from "next/script";
import AuthNav from "../components/AuthNav";
import PrizePromoModal from "../components/PrizePromoModal";
import CosmeticSync from "../components/CosmeticSync";
import { Analytics } from "@vercel/analytics/next";
import { Press_Start_2P, Space_Grotesk } from "next/font/google";
import { validateEnv } from "@/lib/env";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const pressStart = Press_Start_2P({
  subsets: ["latin"],
  variable: "--font-display",
  weight: "400",
  display: "swap",
});

validateEnv();


export const metadata = {
  title: "RunePrep",
  description: "Studying, but multiplayer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {process.env.NEXT_PUBLIC_UMAMI_SRC && process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ? (
          <Script
            src={process.env.NEXT_PUBLIC_UMAMI_SRC}
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
            strategy="afterInteractive"
          />
        ) : null}
        {process.env.NEXT_PUBLIC_GA_ID ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga-setup" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);} gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
              `}
            </Script>
          </>
        ) : null}
      </head>
      <body
        className={`${spaceGrotesk.variable} ${pressStart.variable}`}
        style={{ ["--maxw" as any]: "1280px" }}
      >
        <Providers>
          {/* NAVBAR */}
          <div className="nav">
            <div className="container nav-inner">
              <Link href="/" aria-label="RunePrep home" className="nav-logo">
                <Image src="/assets/logo.png" alt="RunePrep logo" width={520} height={140} priority />
              </Link>
              <div className="nav-links">
                <Link href="/dashboard">Dashboard</Link>
                <Link href="/decks/new">Forge Quiz</Link>
                <Link href="/party/join">Join Party</Link>
                <Link href="/how-it-works">Quest Log</Link>
                <Link href="/pricing">Pricing</Link>
                <Link href="/achievements">Guild Achievements</Link>
                <Link className="btn btn-primary" href="/decks/new">Begin Quest</Link>

                {/* Sign In / Sign Out */}
                <AuthNav />
              </div>
            </div>
          </div>

          {/* MAIN CONTENT */}
          <main>
            <div className="container">{children}</div>
          </main>
          <PrizePromoModal />
          <CosmeticSync />
          <Analytics />

          {/* FOOTER */}
          <div className="footer">
            <div
              className="container"
              style={{
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <strong>RunePrep</strong> © 2025
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <Link href="/dashboard">Dashboard</Link>
                <Link href="/achievements">Guild Achievements</Link>
                <Link href="/how-it-works">How it works</Link>
                <Link href="/pricing">Pricing</Link>
                <Link href="/privacy">Privacy</Link>
                <Link href="/terms">Terms</Link>
              </div>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
