"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { avatars, resolveAvatarId } from "@/lib/studyhall/avatars";

export default function JoinPartyPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [avatarId, setAvatarId] = useState(resolveAvatarId(null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPartyId, setLastPartyId] = useState<string | null>(null);
  const [lastPartyHasSeat, setLastPartyHasSeat] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("studyhall:lastPartyId");
    if (stored) {
      setLastPartyId(stored);
      setLastPartyHasSeat(Boolean(window.localStorage.getItem(`studyhall:party:${stored}`)));
    }
  }, []);

  const handleJoin = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/studyhall/parties/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), name: name.trim(), avatarId }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to join party.");
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
      router.push(`/party/${data.partyId}`);
    } catch (err: any) {
      setError(err?.message || "Unable to join party.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="page stack">
      {lastPartyId ? (
        <div className="card stack">
          <h2 className="card-title">Resume your last party</h2>
          <p className="card-sub">
            {lastPartyHasSeat
              ? "Your seat is saved. Jump back in with one click."
              : "Rejoin your last party with your name and avatar."}
          </p>
          <div className="row">
            <button className="btn btn-primary" onClick={() => router.push(`/party/${lastPartyId}`)}>
              Resume party
            </button>
            <button
              className="btn btn-outline"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.localStorage.removeItem("studyhall:lastPartyId");
                }
                setLastPartyId(null);
                setLastPartyHasSeat(false);
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
      <div className="card stack">
        <h1 className="page-title">Join a quiz party</h1>
        <p className="page-sub">Bring your name and avatar, then join with a party code.</p>
        <div className="field">
          <label className="field-label" htmlFor="name">Your name</label>
          <input
            id="name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
          />
        </div>
        <div className="field">
          <label className="field-label">Choose an avatar</label>
          <div className="avatar-grid">
            {avatars.map((avatar) => (
              <button
                key={avatar.id}
                className={`avatar-tile ${avatarId === avatar.id ? "is-selected" : ""}`}
                type="button"
                onClick={() => setAvatarId(avatar.id)}
              >
                <img className="avatar avatar-lg" src={avatar.src} alt={avatar.label} />
                <span className="avatar-label">{avatar.label}</span>
              </button>
            ))}
          </div>
        </div>
        {error ? <div className="card" style={{ borderColor: "#FCA5A5" }}>{error}</div> : null}
      </div>

      <div className="card stack">
        <h2 className="card-title">Join with a code</h2>
        <p className="card-sub">Have a quiz party code? Enter it below.</p>
        <div className="field">
          <label className="field-label" htmlFor="code">Party code</label>
          <input
            id="code"
            className="input"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="ABC123"
          />
        </div>
        <div className="row">
          <button
            className="btn btn-primary"
            onClick={handleJoin}
            disabled={loading || !code.trim() || !name.trim()}
          >
            {loading ? "Joining..." : "Join party"}
          </button>
          <Link className="btn btn-outline" href="/">
            Back to home
          </Link>
        </div>
      </div>

    </div>
  );
}
