// app/layout.tsx
import "katex/dist/katex.min.css";
import "./globals.css";
import Link from "next/link";
import Providers from "./providers";
import Script from "next/script";
import AuthNav from "../components/AuthNav";

export const metadata = {
  title: "BlobPrep",
  description: "Infinite GRE & GMAT questions",
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
      <body style={{ ["--maxw" as any]: "1440px" }}>
        <Providers>
          {/* NAVBAR */}
          <div className="nav">
            <div className="container nav-inner">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img src="/assets/logo.png" alt="BlobPrep" style={{ height: 36 }} />
                <strong>BlobPrep</strong>
              </div>
              <div className="nav-links" style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <Link href="/">Home</Link>
                <Link href="/practice">Practice</Link>
                <Link href="/pricing">Pricing</Link>
                <Link href="/qotd">QOTD</Link>
                <Link href="/missed">Missed</Link>
                <Link href="/dashboard">Dashboard</Link>

                {/* Sign In / Sign Out */}
                <AuthNav />
              </div>
            </div>
          </div>

          {/* MAIN CONTENT */}
          <main>
            <div className="container">{children}</div>
          </main>

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
                <strong>BlobPrep</strong> © 2025
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <Link href="/practice">Practice</Link>
                <Link href="/pricing">Pricing</Link>
                <Link href="/dashboard">Dashboard</Link>
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
