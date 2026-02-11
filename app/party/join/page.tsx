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
  const [emberFxActive, setEmberFxActive] = useState(false);
  const [knightFxActive, setKnightFxActive] = useState(false);
  const [spartanFxActive, setSpartanFxActive] = useState(false);
  const [circeFxActive, setCirceFxActive] = useState(false);
  const [rogueFxActive, setRogueFxActive] = useState(false);
  const [waterOrigin, setWaterOrigin] = useState({ x: 50, y: 50 });
  const [lightOrigin, setLightOrigin] = useState({ x: 50, y: 50 });
  const [emberOrigin, setEmberOrigin] = useState({ x: 50, y: 50 });
  const [knightOrigin, setKnightOrigin] = useState({ x: 50, y: 50 });
  const [spartanOrigin, setSpartanOrigin] = useState({ x: 50, y: 50 });
  const [circeOrigin, setCirceOrigin] = useState({ x: 50, y: 50 });
  const [rogueOrigin, setRogueOrigin] = useState({ x: 50, y: 50 });
  const [emberStartDistance, setEmberStartDistance] = useState(56);
  const waterFxTimer = useRef<number | null>(null);
  const lightFxTimer = useRef<number | null>(null);
  const emberFxTimer = useRef<number | null>(null);
  const knightFxTimer = useRef<number | null>(null);
  const spartanFxTimer = useRef<number | null>(null);
  const circeFxTimer = useRef<number | null>(null);
  const rogueFxTimer = useRef<number | null>(null);
  const paladinTileRef = useRef<HTMLButtonElement | null>(null);
  const cinderTileRef = useRef<HTMLButtonElement | null>(null);
  const knightTileRef = useRef<HTMLButtonElement | null>(null);
  const riderTileRef = useRef<HTMLButtonElement | null>(null);
  const circeTileRef = useRef<HTMLButtonElement | null>(null);
  const wizardTileRef = useRef<HTMLButtonElement | null>(null);
  const rogueTileRef = useRef<HTMLButtonElement | null>(null);

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
      if (emberFxTimer.current !== null) {
        window.clearTimeout(emberFxTimer.current);
      }
      if (knightFxTimer.current !== null) {
        window.clearTimeout(knightFxTimer.current);
      }
      if (spartanFxTimer.current !== null) {
        window.clearTimeout(spartanFxTimer.current);
      }
      if (circeFxTimer.current !== null) {
        window.clearTimeout(circeFxTimer.current);
      }
      if (rogueFxTimer.current !== null) {
        window.clearTimeout(rogueFxTimer.current);
      }
    };
  }, []);

  const triggerWaterFx = (originEl?: HTMLElement | null) => {
    if (typeof window === "undefined") return;
    const target = originEl ?? wizardTileRef.current;
    if (target) {
      const rect = target.getBoundingClientRect();
      setWaterOrigin({
        x: ((rect.left + rect.width / 2) / window.innerWidth) * 100,
        y: ((rect.top + rect.height / 2) / window.innerHeight) * 100,
      });
    }
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

  const triggerEmberFx = (originEl?: HTMLElement | null) => {
    if (typeof window === "undefined") return;
    const target = originEl ?? cinderTileRef.current;
    if (target) {
      const rect = target.getBoundingClientRect();
      const edgeRadius = Math.max(rect.width, rect.height) * 0.54;
      setEmberOrigin({
        x: ((rect.left + rect.width / 2) / window.innerWidth) * 100,
        y: ((rect.top + rect.height / 2) / window.innerHeight) * 100,
      });
      setEmberStartDistance(edgeRadius);
    }
    setEmberFxActive(false);
    if (emberFxTimer.current !== null) {
      window.clearTimeout(emberFxTimer.current);
    }
    emberFxTimer.current = window.setTimeout(() => {
      setEmberFxActive(true);
      emberFxTimer.current = window.setTimeout(() => {
        setEmberFxActive(false);
      }, 560);
    }, 10);
  };

  const triggerKnightFx = (originEl?: HTMLElement | null) => {
    if (typeof window === "undefined") return;
    const target = originEl ?? knightTileRef.current;
    if (target) {
      const rect = target.getBoundingClientRect();
      setKnightOrigin({
        x: ((rect.left + rect.width / 2) / window.innerWidth) * 100,
        y: ((rect.top + rect.height / 2) / window.innerHeight) * 100,
      });
    }
    setKnightFxActive(false);
    if (knightFxTimer.current !== null) {
      window.clearTimeout(knightFxTimer.current);
    }
    knightFxTimer.current = window.setTimeout(() => {
      setKnightFxActive(true);
      knightFxTimer.current = window.setTimeout(() => {
        setKnightFxActive(false);
      }, 480);
    }, 10);
  };

  const triggerSpartanFx = (originEl?: HTMLElement | null) => {
    if (typeof window === "undefined") return;
    const target = originEl ?? riderTileRef.current;
    if (target) {
      const rect = target.getBoundingClientRect();
      setSpartanOrigin({
        x: ((rect.left + rect.width / 2) / window.innerWidth) * 100,
        y: ((rect.top + rect.height / 2) / window.innerHeight) * 100,
      });
    }
    setSpartanFxActive(false);
    if (spartanFxTimer.current !== null) {
      window.clearTimeout(spartanFxTimer.current);
    }
    spartanFxTimer.current = window.setTimeout(() => {
      setSpartanFxActive(true);
      spartanFxTimer.current = window.setTimeout(() => {
        setSpartanFxActive(false);
      }, 500);
    }, 10);
  };

  const triggerCirceFx = (originEl?: HTMLElement | null) => {
    if (typeof window === "undefined") return;
    const target = originEl ?? circeTileRef.current;
    if (target) {
      const rect = target.getBoundingClientRect();
      setCirceOrigin({
        x: ((rect.left + rect.width / 2) / window.innerWidth) * 100,
        y: ((rect.top + rect.height / 2) / window.innerHeight) * 100,
      });
    }
    setCirceFxActive(false);
    if (circeFxTimer.current !== null) {
      window.clearTimeout(circeFxTimer.current);
    }
    circeFxTimer.current = window.setTimeout(() => {
      setCirceFxActive(true);
      circeFxTimer.current = window.setTimeout(() => {
        setCirceFxActive(false);
      }, 520);
    }, 10);
  };

  const triggerRogueFx = (originEl?: HTMLElement | null) => {
    if (typeof window === "undefined") return;
    const target = originEl ?? rogueTileRef.current;
    if (target) {
      const rect = target.getBoundingClientRect();
      setRogueOrigin({
        x: ((rect.left + rect.width / 2) / window.innerWidth) * 100,
        y: ((rect.top + rect.height / 2) / window.innerHeight) * 100,
      });
    }
    setRogueFxActive(false);
    if (rogueFxTimer.current !== null) window.clearTimeout(rogueFxTimer.current);
    rogueFxTimer.current = window.setTimeout(() => {
      setRogueFxActive(true);
      rogueFxTimer.current = window.setTimeout(() => setRogueFxActive(false), 460);
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

  const embers = Array.from({ length: 30 }, (_, i) => {
    const angle = (360 / 30) * i + ((i % 2) * 6 - 3);
    const delay = (i * 13) % 120;
    const duration = 340 + ((i * 29) % 190);
    const distance = 120 + ((i * 19) % 250);
    const size = 7 + (i % 5);
    return { i, angle, delay, duration, distance, size };
  });

  const spartanSpears = Array.from({ length: 12 }, (_, i) => {
    const angle = i * 30;
    const delay = (i * 14) % 120;
    const distance = 170 + ((i * 19) % 180);
    const scale = 0.72 + ((i * 7) % 24) / 100;
    return { i, angle, delay, distance, scale };
  });

  const circeBlades = Array.from({ length: 12 }, (_, i) => {
    const angle = i * 30;
    const delay = 0;
    const distance = 140 + ((i * 11) % 120);
    const scale = 0.6 + ((i * 7) % 22) / 100;
    return { i, angle, delay, distance, scale, mirrored: i % 2 === 1 };
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
      {rogueFxActive ? (
        <div
          className="rogue-claw-fx"
          aria-hidden="true"
          style={{ "--origin-x": `${rogueOrigin.x}%`, "--origin-y": `${rogueOrigin.y}%` } as CSSProperties}
        >
          <span className="rogue-claw-fx__stroke rogue-claw-fx__stroke--a" />
          <span className="rogue-claw-fx__stroke rogue-claw-fx__stroke--b" />
        </div>
      ) : null}
      {circeFxActive ? (
        <div
          className="circe-assassin-fx"
          aria-hidden="true"
          style={
            {
              "--origin-x": `${circeOrigin.x}%`,
              "--origin-y": `${circeOrigin.y}%`,
            } as CSSProperties
          }
        >
          <span className="circe-assassin-fx__rune" />
          <span className="circe-assassin-fx__rune circe-assassin-fx__rune--echo" />
          <span className="circe-assassin-fx__aura" />
          {circeBlades.map((blade) => (
            <span
              key={blade.i}
              className={`circe-assassin-fx__blade${blade.mirrored ? " circe-assassin-fx__blade--mirrored" : ""}`}
              style={
                {
                  "--angle": `${blade.angle}deg`,
                  "--delay": `${blade.delay}ms`,
                  "--distance": `${blade.distance}px`,
                  "--scale": blade.scale,
                  "--start-distance": "146px",
                } as CSSProperties
              }
            />
          ))}
        </div>
      ) : null}
      {spartanFxActive ? (
        <div
          className="spartan-dory-fx"
          aria-hidden="true"
          style={
            {
              "--origin-x": `${spartanOrigin.x}%`,
              "--origin-y": `${spartanOrigin.y}%`,
            } as CSSProperties
          }
        >
          {spartanSpears.map((spear) => (
            <span
              key={spear.i}
              className="spartan-dory-fx__spear"
              style={
                {
                  "--angle": `${spear.angle}deg`,
                  "--delay": `${spear.delay}ms`,
                  "--distance": `${spear.distance}px`,
                  "--scale": spear.scale,
                } as CSSProperties
              }
            />
          ))}
          <span className="spartan-dory-fx__burst" />
          <span className="spartan-dory-fx__dust spartan-dory-fx__dust--a" />
          <span className="spartan-dory-fx__dust spartan-dory-fx__dust--b" />
        </div>
      ) : null}
      {knightFxActive ? (
        <div
          className="knight-shield-fx"
          aria-hidden="true"
          style={
            {
              "--origin-x": `${knightOrigin.x}%`,
              "--origin-y": `${knightOrigin.y}%`,
            } as CSSProperties
          }
        >
          <span className="knight-shield-fx__slam" />
          <span className="knight-shield-fx__ring" />
          <span className="knight-shield-fx__ring knight-shield-fx__ring--late" />
        </div>
      ) : null}
      {emberFxActive ? (
        <div
          className="cinder-ember-fx"
          aria-hidden="true"
          style={
            {
              "--origin-x": `${emberOrigin.x}%`,
              "--origin-y": `${emberOrigin.y}%`,
              "--start-distance": `${emberStartDistance}px`,
            } as CSSProperties
          }
        >
          <span className="cinder-ember-fx__core" />
          {embers.map((ember) => (
            <span
              key={ember.i}
              className="cinder-ember-fx__ember"
              style={
                {
                  "--angle": `${ember.angle}deg`,
                  "--delay": `${ember.delay}ms`,
                  "--duration": `${ember.duration}ms`,
                  "--distance": `${ember.distance}px`,
                  "--size": `${ember.size}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      ) : null}
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
        <div
          className="water-mage-fx"
          aria-hidden="true"
          style={
            {
              "--origin-x": `${waterOrigin.x}%`,
              "--origin-y": `${waterOrigin.y}%`,
            } as CSSProperties
          }
        >
          <span className="water-mage-fx__sigil" />
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
                ref={
                  avatar.id === "wizard"
                    ? wizardTileRef
                    : avatar.id === "paladin"
                    ? paladinTileRef
                    : avatar.id === "pepe"
                      ? cinderTileRef
                      : avatar.id === "knight"
                        ? knightTileRef
                        : avatar.id === "rider"
                          ? riderTileRef
                          : avatar.id === "archer"
                            ? circeTileRef
                            : avatar.id === "rogue"
                              ? rogueTileRef
                            : undefined
                }
                type="button"
                onClick={(event) => {
                  setAvatarId(avatar.id);
                  if (avatar.id === "wizard" && avatarId !== "wizard") {
                    triggerWaterFx(event.currentTarget);
                  }
                  if (avatar.id === "paladin" && avatarId !== "paladin") {
                    triggerLightFx(event.currentTarget);
                  }
                  if (avatar.id === "pepe" && avatarId !== "pepe") {
                    triggerEmberFx(event.currentTarget);
                  }
                  if (avatar.id === "knight" && avatarId !== "knight") {
                    triggerKnightFx(event.currentTarget);
                  }
                  if (avatar.id === "rider" && avatarId !== "rider") {
                    triggerSpartanFx(event.currentTarget);
                  }
                  if (avatar.id === "archer" && avatarId !== "archer") {
                    triggerCirceFx(event.currentTarget);
                  }
                  if (avatar.id === "rogue" && avatarId !== "rogue") {
                    triggerRogueFx(event.currentTarget);
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
