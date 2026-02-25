// app/layout.tsx
import "katex/dist/katex.min.css";
import "./globals.css";
import Link from "next/link";
import Image from "next/image";
import Providers from "./providers";
import Script from "next/script";
import AuthNav from "../components/AuthNav";
import NavLinks from "../components/NavLinks";
import CosmeticSync from "../components/CosmeticSync";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Press_Start_2P, Space_Grotesk } from "next/font/google";
import { validateEnv } from "@/lib/env";
import { getAppBaseUrl } from "@/lib/urls";

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


const siteUrl = getAppBaseUrl();

export const metadata: Metadata = {
  title: {
    default: "RunePrep",
    template: "RunePrep | %s",
  },
  description:
    "Turn your notes into multiplayer quizzes. Auto-generate questions and host live study parties in minutes.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "RunePrep",
    description:
      "Turn your notes into multiplayer quizzes. Auto-generate questions and host live study parties in minutes.",
    type: "website",
    url: "/",
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
    title: "RunePrep",
    description:
      "Turn your notes into multiplayer quizzes. Auto-generate questions and host live study parties in minutes.",
    images: ["/assets/banner.png"],
  },
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
                <Image src="/assets/logo.png" alt="RunePrep" width={520} height={140} priority />
              </Link>
              <input id="nav-toggle" className="nav-toggle" type="checkbox" />
              <label htmlFor="nav-toggle" className="nav-toggle-btn nav-toggle-btn--open" aria-label="Open menu">
                <span className="nav-toggle-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 7h16M4 12h16M4 17h16" />
                  </svg>
                </span>
              </label>
              <div className="nav-links">
                <div className="nav-drawer-head">
                  <span className="nav-drawer-title">Menu</span>
                  <label htmlFor="nav-toggle" className="nav-toggle-btn nav-toggle-btn--close" aria-label="Close menu">
                    <span className="nav-toggle-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M6 6l12 12M18 6l-12 12" />
                      </svg>
                    </span>
                  </label>
                </div>
                <div className="nav-list">
                  <NavLinks />
                </div>
                <div className="nav-auth">
                  {/* Sign In / Sign Out */}
                  <AuthNav />
                </div>
              </div>
              <label htmlFor="nav-toggle" className="nav-scrim" aria-hidden="true" />
            </div>
            <div className="nav-divider" aria-hidden="true">
              <div className="section-divider" />
            </div>
          </div>

          {/* MAIN CONTENT */}
          <main>
            <div className="container">{children}</div>
          </main>
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
