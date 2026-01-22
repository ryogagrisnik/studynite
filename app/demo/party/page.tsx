"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const demoCode = process.env.NEXT_PUBLIC_DEMO_PARTY_CODE ?? "";
const demoAvatar = process.env.NEXT_PUBLIC_DEMO_AVATAR_ID ?? "paladin";

function buildGuestName() {
  const suffix = Math.floor(100 + Math.random() * 900);
  return `Guest ${suffix}`;
}

export default function DemoPartyPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const guestName = useMemo(() => buildGuestName(), []);

  useEffect(() => {
    if (!demoCode) {
      setError("Demo party is not configured yet.");
      setLoading(false);
      return;
    }

    let isActive = true;

    const join = async () => {
      try {
        const response = await fetch("/api/studyhall/parties/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: demoCode,
            name: guestName,
            avatarId: demoAvatar,
          }),
        });
        const data = await response.json();
        if (!response.ok || !data.ok) {
          throw new Error(data.error || "Unable to join the demo party.");
        }
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            `studyhall:party:${data.partyId}`,
            JSON.stringify({
              playerToken: data.player.playerToken,
              playerId: data.player.id,
              avatarId: data.player.avatarId,
            })
          );
          window.localStorage.setItem("studyhall:lastPartyId", data.partyId);
        }
        await fetch("/api/events/studyhall", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "party_joined", partyId: data.partyId }),
        });
        if (isActive) {
          router.replace(`/party/${data.partyId}`);
        }
      } catch (err: any) {
        if (isActive) {
          setError(err?.message || "Unable to join the demo party.");
          setLoading(false);
        }
      }
    };

    join();

    return () => {
      isActive = false;
    };
  }, [guestName, router]);

  return (
    <div className="page stack">
      <div className="card stack">
        <h1 className="page-title">Launching demo party…</h1>
        <p className="page-sub">
          Jumping you into a live party so you can see the multiplayer flow instantly.
        </p>
        {loading ? <div className="muted">Connecting to the party…</div> : null}
        {error ? (
          <div className="card card--error stack" role="alert">
            <strong>Demo party unavailable.</strong>
            <span>{error}</span>
            <div className="row">
              <Link className="btn btn-primary" href="/demo">
                View the demo quiz instead
              </Link>
              <Link className="btn btn-outline" href="/party/join">
                Join with a code
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
