"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
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
  const [waterFxActive, setWaterFxActive] = useState(false);
  const [lightFxActive, setLightFxActive] = useState(false);
  const [lightOrigin, setLightOrigin] = useState({ x: 50, y: 50 });
  const waterFxTimer = useRef<number | null>(null);
  const lightFxTimer = useRef<number | null>(null);
  const paladinTileRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("studyhall:lastPartyId");
    if (stored) {
      setLastPartyId(stored);
      setLastPartyHasSeat(Boolean(window.localStorage.getItem(`studyhall:party:${stored}`)));
    }
  }, []);

  useEffect(() => {
    return () => {
      if (waterFxTimer.current !== null) {
        window.clearTimeout(waterFxTimer.current);
      }
      if (lightFxTimer.current !== null) {
        window.clearTimeout(lightFxTimer.current);
      }
    };
  }, []);

  const triggerWaterFx = () => {
    if (typeof window === "undefined") return;
    setWaterFxActive(false);
    if (waterFxTimer.current !== null) {
      window.clearTimeout(waterFxTimer.current);
    }
    waterFxTimer.current = window.setTimeout(() => {
      setWaterFxActive(true);
      waterFxTimer.current = window.setTimeout(() => {
        setWaterFxActive(false);
      }, 650);
    }, 10);
  };

  const triggerLightFx = (originEl?: HTMLElement | null) => {
    if (typeof window === "undefined") return;
    const target = originEl ?? paladinTileRef.current;
    if (target) {
      const rect = target.getBoundingClientRect();
      setLightOrigin({
        x: ((rect.left + rect.width / 2) / window.innerWidth) * 100,
        y: ((rect.top + rect.height / 2) / window.innerHeight) * 100,
      });
    }
    setLightFxActive(false);
    if (lightFxTimer.current !== null) {
      window.clearTimeout(lightFxTimer.current);
    }
    lightFxTimer.current = window.setTimeout(() => {
      setLightFxActive(true);
      lightFxTimer.current = window.setTimeout(() => {
        setLightFxActive(false);
      }, 520);
    }, 10);
  };

  const waterDrops = Array.from({ length: 56 }, (_, i) => {
    const left = (i * 17) % 100;
    const delay = (i * 11) % 180;
    const duration = 340 + ((i * 29) % 180);
    const size = 18 + ((i * 7) % 16);
    const drift = ((i % 2 === 0 ? 1 : -1) * (6 + (i % 5))) / 1.5;
    const opacity = 0.5 + ((i * 13) % 40) / 100;
    return { i, left, delay, duration, size, drift, opacity };
  });

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

  const handlePasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setCode(text.trim().toUpperCase());
      }
    } catch {
      // ignore clipboard errors
    }
  };


  return (
    <div className="page stack join-party">
      {lightFxActive ? (
        <div
          className="paladin-sunburst"
          aria-hidden="true"
          style={
            {
              "--origin-x": `${lightOrigin.x}%`,
              "--origin-y": `${lightOrigin.y}%`,
            } as CSSProperties
          }
        >
          <span className="paladin-sunburst__beam paladin-sunburst__beam--a" />
          <span className="paladin-sunburst__beam paladin-sunburst__beam--b" />
          <span className="paladin-sunburst__beam paladin-sunburst__beam--c" />
          <span className="paladin-sunburst__beam paladin-sunburst__beam--d" />
          <span className="paladin-sunburst__beam paladin-sunburst__beam--e" />
          <span className="paladin-sunburst__beam paladin-sunburst__beam--f" />
          <span className="paladin-sunburst__beam paladin-sunburst__beam--g" />
          <span className="paladin-sunburst__beam paladin-sunburst__beam--h" />
          <span className="paladin-sunburst__glow" />
        </div>
      ) : null}
      {waterFxActive ? (
        <div className="water-mage-fx" aria-hidden="true">
          {waterDrops.map((drop) => (
            <span
              key={drop.i}
              className="water-mage-fx__sprite"
              style={
                {
                  "--left": `${drop.left}%`,
                  "--delay": `${drop.delay}ms`,
                  "--duration": `${drop.duration}ms`,
                  "--size": `${drop.size}px`,
                  "--drift": `${drop.drift}px`,
                  "--opacity": drop.opacity,
                } as CSSProperties
              }
            />
          ))}
        </div>
      ) : null}
      {lastPartyId ? (
        <div className="card stack">
          <h2 className="card-title">Resume your last party</h2>
          <p className="card-sub">
            {lastPartyHasSeat
              ? "Your seat is saved. Jump back in with one click."
              : "Rejoin your last party with your name and avatar."}
          </p>
          <div className="row cta-row">
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
      <div className="card stack join-panel join-panel--glow">
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
                ref={avatar.id === "paladin" ? paladinTileRef : undefined}
                type="button"
                onClick={(event) => {
                  setAvatarId(avatar.id);
                  if (avatar.id === "wizard" && avatarId !== "wizard") {
                    triggerWaterFx();
                  }
                  if (avatar.id === "paladin" && avatarId !== "paladin") {
                    triggerLightFx(event.currentTarget);
                  }
                }}
              >
                <img className="avatar avatar-lg" src={avatar.src} alt={avatar.label} />
                <span className="avatar-label">{avatar.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card stack join-panel join-panel--glow">
        <h2 className="card-title">Join with a code</h2>
        <p className="card-sub">Have a quiz party code? Enter it below.</p>
        <div className="field">
          <label className="field-label" htmlFor="code">Party code</label>
          <div className="join-code-row">
            <input
              id="code"
              className="input join-code-input"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="ABC123"
            />
            <button
              type="button"
              className="btn btn-outline btn-small join-code-paste"
              onClick={handlePasteCode}
            >
              Paste code
            </button>
          </div>
          <span className="field-help join-code-hint">Uppercase letters and numbers.</span>
        </div>
        {error ? (
          <div className="card card--error stack" role="alert">
            <strong>Couldn't join the party.</strong>
            <span>{error}</span>
            <div className="row cta-row">
              <button
                className="btn btn-outline btn-small"
                onClick={handleJoin}
                disabled={loading || !code.trim() || !name.trim()}
              >
                Try again
              </button>
              <button className="btn btn-outline btn-small" onClick={() => setError(null)}>
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
        <div className="row cta-row">
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
