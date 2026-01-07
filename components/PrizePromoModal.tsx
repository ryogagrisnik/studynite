"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const AUTH_KEY = "studynite:promo:authed";
const GUEST_KEY = "studynite:promo:guest";

export default function PrizePromoModal() {
  const { status, data } = useSession();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isAuthed = status === "authenticated";
  const userId = (data?.user as any)?.id as string | undefined;

  const storageKey = useMemo(() => (isAuthed ? AUTH_KEY : GUEST_KEY), [isAuthed]);

  useEffect(() => {
    if (status === "loading") return;
    if (!pathname) return;
    if (typeof window === "undefined") return;
    const shown = window.sessionStorage.getItem(storageKey);
    if (shown === "1") return;
    window.sessionStorage.setItem(storageKey, "1");
    setOpen(true);
  }, [status, storageKey, pathname, userId]);

  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-card promo-modal">
        <div className="promo-header">
          <span className="promo-kicker">Monthly Quest</span>
          <h2 className="promo-title">Win a $1,000 RunePrep Prize</h2>
          <p className="promo-sub">
            Play RunePrep every month to unlock a chance at a $1,000 reward. Make it your ritual,
            and let the party roll.
          </p>
        </div>
        <div className="promo-actions">
          {isAuthed ? (
            <>
              <Link className="btn btn-primary" href="/decks/new">
                Start a new quiz
              </Link>
              <Link className="btn btn-outline" href="/dashboard">
                Open dashboard
              </Link>
            </>
          ) : (
            <>
              <Link className="btn btn-primary" href="/signup?callbackUrl=/decks/new">
                Sign up and play
              </Link>
              <Link className="btn btn-outline" href="/how-it-works">
                See how it works
              </Link>
            </>
          )}
          <button className="btn btn-outline" onClick={() => setOpen(false)}>
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
