"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signIn, signOut } from "next-auth/react";

export default function Header() {
  const { data: session } = useSession();

  return (
    <header className="site-header">
      <div className="inner">
        <Link href="/" className="logo" aria-label="RunePrep home">
          <Image
            src="/assets/logo.png"
            alt="RunePrep logo"
            width={120}
            height={64}
            priority
          />
        </Link>

        <nav className="nav">
          <Link href="/practice">Practice</Link>
          <Link href="/pricing">Pricing</Link>

          {session?.user ? (
            <div className="auth">
              <span className="who">{session.user.email}</span>
              <button onClick={() => signOut()} className="btn small">Sign out</button>
            </div>
          ) : (
            <div className="auth">
              <button onClick={() => signIn("google", { callbackUrl: "/dashboard" })} className="btn small">
                Sign in
              </button>
              {/* Or use a link: <Link href="/signin" className="btn small">Sign in</Link> */}
            </div>
          )}
        </nav>
      </div>

      <style jsx>{`
        .site-header {
          position: sticky; top: 0; z-index: 50;
          background: #fff; border-bottom: 1px solid var(--beige, #FCEBD7);
        }
        .inner {
          max-width: var(--maxw, 1280px);
          margin: 0 auto; padding: 12px 24px;
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
        }
        .logo { display: inline-flex; align-items: center; }
        .logo :global(img) { height: 56px; width: auto; object-fit: contain; }
        .nav { display: flex; align-items: center; gap: 16px; }
        .nav a { color: var(--brown, #4A2E1C); text-decoration: none; }
        .auth { display: flex; align-items: center; gap: 10px; }
        .who { font-size: 12px; opacity: .8; }
        .btn.small {
          padding: 8px 12px; border-radius: 10px; border: 1px solid var(--beige, #FCEBD7);
          background: #fff; color: var(--brown, #4A2E1C); cursor: pointer;
        }
        .btn.small:hover { background: rgba(0,0,0,.03); }
      `}</style>
    </header>
  );
}
