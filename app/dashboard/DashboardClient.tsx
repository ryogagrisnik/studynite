"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { avatars, resolveAvatarId } from "@/lib/studyhall/avatars";
import {
  BADGES,
  COSMETICS,
  getLevelProgress,
  getProgressKey,
  grantFullAccess,
  loadProgress,
  saveProgress,
  type ProgressState,
} from "@/lib/progression";

type DeckSummary = {
  id: string;
  title: string;
  description: string | null;
  shareId: string;
  updatedAt: string;
  questionCount: number;
};

type DashboardClientProps = {
  decks: DeckSummary[];
  userName: string | null;
  userAvatarId: string | null;
  isPro: boolean;
  proExpiresAt: string | null;
  userEmail: string | null;
  userId: string;
};

const SAMPLE_TEXT = `Econ 101 Review:
- Supply shifts right when production costs fall.
- Demand shifts left when prices rise for substitutes.
- GDP includes consumption, investment, government spending, and net exports.
- Inflation reduces purchasing power, nominal rates often rise.
- Monetary policy tools: open market operations, reserve requirements, discount rate.`;

export default function DashboardClient({
  decks,
  userName,
  userAvatarId,
  isPro,
  proExpiresAt,
  userEmail,
  userId,
}: DashboardClientProps) {
  const router = useRouter();
  const [deckList, setDeckList] = useState(decks);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avatarId, setAvatarId] = useState(resolveAvatarId(userAvatarId));
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [creatingSample, setCreatingSample] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [cancelingPremium, setCancelingPremium] = useState(false);
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);
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

  const progressKey = useMemo(() => getProgressKey(userId), [userId]);
  const levelProgress = useMemo(() => {
    if (!progress) return null;
    return getLevelProgress(progress.xp);
  }, [progress]);

  useEffect(() => {
    const base = loadProgress(progressKey);
    const { next, changed } = grantFullAccess(base, userEmail);
    if (changed) saveProgress(progressKey, next);
    setProgress(next);
  }, [progressKey, userEmail]);

  useEffect(() => {
    return () => {
      if (waterFxTimer.current !== null) window.clearTimeout(waterFxTimer.current);
      if (lightFxTimer.current !== null) window.clearTimeout(lightFxTimer.current);
      if (emberFxTimer.current !== null) window.clearTimeout(emberFxTimer.current);
      if (knightFxTimer.current !== null) window.clearTimeout(knightFxTimer.current);
      if (spartanFxTimer.current !== null) window.clearTimeout(spartanFxTimer.current);
      if (circeFxTimer.current !== null) window.clearTimeout(circeFxTimer.current);
      if (rogueFxTimer.current !== null) window.clearTimeout(rogueFxTimer.current);
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
    if (waterFxTimer.current !== null) window.clearTimeout(waterFxTimer.current);
    waterFxTimer.current = window.setTimeout(() => {
      setWaterFxActive(true);
      waterFxTimer.current = window.setTimeout(() => setWaterFxActive(false), 650);
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
    if (lightFxTimer.current !== null) window.clearTimeout(lightFxTimer.current);
    lightFxTimer.current = window.setTimeout(() => {
      setLightFxActive(true);
      lightFxTimer.current = window.setTimeout(() => setLightFxActive(false), 520);
    }, 10);
  };

  const triggerEmberFx = (originEl?: HTMLElement | null) => {
    if (typeof window === "undefined") return;
    const target = originEl ?? cinderTileRef.current;
    if (target) {
      const rect = target.getBoundingClientRect();
      setEmberOrigin({
        x: ((rect.left + rect.width / 2) / window.innerWidth) * 100,
        y: ((rect.top + rect.height / 2) / window.innerHeight) * 100,
      });
      setEmberStartDistance(Math.max(rect.width, rect.height) * 0.54);
    }
    setEmberFxActive(false);
    if (emberFxTimer.current !== null) window.clearTimeout(emberFxTimer.current);
    emberFxTimer.current = window.setTimeout(() => {
      setEmberFxActive(true);
      emberFxTimer.current = window.setTimeout(() => setEmberFxActive(false), 560);
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
    if (knightFxTimer.current !== null) window.clearTimeout(knightFxTimer.current);
    knightFxTimer.current = window.setTimeout(() => {
      setKnightFxActive(true);
      knightFxTimer.current = window.setTimeout(() => setKnightFxActive(false), 480);
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
    if (spartanFxTimer.current !== null) window.clearTimeout(spartanFxTimer.current);
    spartanFxTimer.current = window.setTimeout(() => {
      setSpartanFxActive(true);
      spartanFxTimer.current = window.setTimeout(() => setSpartanFxActive(false), 500);
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
    if (circeFxTimer.current !== null) window.clearTimeout(circeFxTimer.current);
    circeFxTimer.current = window.setTimeout(() => {
      setCirceFxActive(true);
      circeFxTimer.current = window.setTimeout(() => setCirceFxActive(false), 520);
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

  const handleRetry = () => {
    setError(null);
    router.refresh();
  };

  const handleStartParty = async (deckId: string) => {
    setError(null);
    setStartingId(deckId);
    try {
      const response = await fetch("/api/studyhall/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId, hostName: userName ?? undefined, avatarId }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to start party.");
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          `studyhall:party:${data.partyId}`,
          JSON.stringify({ playerToken: data.playerToken, playerId: data.playerId })
        );
        window.localStorage.setItem("studyhall:lastPartyId", data.partyId);
      }
      router.push(`/party/${data.partyId}`);
    } catch (err: any) {
      setError(err?.message || "Unable to start party.");
    } finally {
      setStartingId(null);
    }
  };

  const handleAvatarSelect = async (nextId: string) => {
    setAvatarId(nextId);
    setSavingAvatar(true);
    try {
      const response = await fetch("/api/studyhall/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarId: nextId }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to save avatar.");
      }
    } catch (err: any) {
      setError(err?.message || "Unable to save avatar.");
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleEquipCosmetic = (cosmetic: string | null) => {
    if (!progress) return;
    if (cosmetic && !progress.cosmetics.includes(cosmetic)) return;
    const next = { ...progress, equippedCosmetic: cosmetic };
    saveProgress(progressKey, next);
    setProgress(next);
  };

  const handleEquipBadge = (badge: string | null) => {
    if (!progress) return;
    if (badge && !progress.badges.includes(badge)) return;
    const next = { ...progress, equippedBadge: badge };
    saveProgress(progressKey, next);
    setProgress(next);
  };

  const handleDeleteDeck = async (deckId: string) => {
    if (!confirm("Delete this quiz? This will remove its questions and parties.")) {
      return;
    }
    setDeletingId(deckId);
    setError(null);
    try {
      const response = await fetch(`/api/studyhall/decks/${deckId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to delete quiz.");
      }
      setDeckList((prev) => prev.filter((deck) => deck.id !== deckId));
    } catch (err: any) {
      setError(err?.message || "Unable to delete quiz.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateSample = async () => {
    setSampleError(null);
    setCreatingSample(true);
    try {
      const formData = new FormData();
      formData.append("title", "Sample Deck: Econ 101");
      formData.append("text", SAMPLE_TEXT);
      formData.append("includeQuestions", "true");
      formData.append("includeFlashcards", "false");
      formData.append("questionCount", "8");

      const response = await fetch("/api/studyhall/decks", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to create sample quiz.");
      }
      router.push(`/decks/${data.deckId}/edit?quick=1`);
    } catch (err: any) {
      setSampleError(err?.message || "Unable to create sample quiz.");
    } finally {
      setCreatingSample(false);
    }
  };

  const handleCancelPremium = async () => {
    setCancelingPremium(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to cancel premium.");
      }
      setCancelNotice("Premium is cancelled. You'll keep access until the end of the current billing period.");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Unable to cancel premium.");
    } finally {
      setCancelingPremium(false);
    }
  };

  return (
    <div className="page stack dashboard join-party">
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
          style={{ "--origin-x": `${circeOrigin.x}%`, "--origin-y": `${circeOrigin.y}%` } as CSSProperties}
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
          style={{ "--origin-x": `${spartanOrigin.x}%`, "--origin-y": `${spartanOrigin.y}%` } as CSSProperties}
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
          style={{ "--origin-x": `${knightOrigin.x}%`, "--origin-y": `${knightOrigin.y}%` } as CSSProperties}
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
          style={{ "--origin-x": `${lightOrigin.x}%`, "--origin-y": `${lightOrigin.y}%` } as CSSProperties}
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
          style={{ "--origin-x": `${waterOrigin.x}%`, "--origin-y": `${waterOrigin.y}%` } as CSSProperties}
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
      <div className="page-header">
        <div>
          <h1 className="page-title">Your RunePrep quizzes</h1>
          <p className="page-sub">Create quizzes, edit questions, and launch parties.</p>
        </div>
      </div>

      {error ? (
        <div className="card card--error stack" role="alert">
          <span>{error}</span>
          <button className="btn btn-outline btn-small" type="button" onClick={handleRetry}>
            Try again
          </button>
        </div>
      ) : null}

      {cancelNotice ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2 className="card-title">Premium cancelled</h2>
            <p className="card-sub">{cancelNotice}</p>
            <button className="btn btn-primary" type="button" onClick={() => setCancelNotice(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid-2">
        <div className="card vegas-panel meta-panel">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div className="stack" style={{ gap: 6 }}>
              <span className="reward-kicker">Meta progress</span>
              <h2 className="card-title">Level {levelProgress?.levelAfter ?? progress?.level ?? 1}</h2>
            </div>
            {progress ? <span className="reward-chip">+{progress.xp} XP</span> : null}
          </div>
          {progress && levelProgress ? (
            <>
              <div className="progress-bar neon-progress">
                <span
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((levelProgress.xpInLevel / levelProgress.xpForLevel) * 100)
                    )}%`,
                  }}
                />
              </div>
              <div className="row muted" style={{ justifyContent: "space-between" }}>
                <span>
                  {levelProgress.xpInLevel} / {levelProgress.xpForLevel} XP
                </span>
                <span>
                  {Math.round((levelProgress.xpInLevel / levelProgress.xpForLevel) * 100)}% to next level
                </span>
              </div>
              <div className="streak-card">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="streak-label">Study streak</span>
                  <span className="reward-chip reward-chip--small">
                    {progress.streak.days} day{progress.streak.days === 1 ? "" : "s"}
                  </span>
                </div>
                <strong>{progress.streak.multiplier.toFixed(2)}x rewards active</strong>
              </div>
            </>
          ) : (
            <div className="muted">Complete a session to start tracking progress.</div>
          )}
        </div>
        <div className="card vegas-panel meta-panel">
          <span className="reward-kicker">Collections</span>
          <h2 className="card-title">Cosmetics & badges</h2>
          <p className="card-sub">Equip a cosmetic to show off your wins.</p>
          {progress ? (
            <div className="stack" style={{ gap: 12 }}>
              <div className="cosmetic-grid">
                {COSMETICS.map((cosmetic) => {
                  const isUnlocked = progress.cosmetics.includes(cosmetic);
                  const isEquipped = progress.equippedCosmetic === cosmetic;
                  return (
                    <button
                      key={cosmetic}
                      className={`cosmetic-tile ${isEquipped ? "is-selected" : ""} ${
                        isUnlocked ? "" : "is-locked"
                      }`}
                      type="button"
                      onClick={() => (isUnlocked ? handleEquipCosmetic(cosmetic) : null)}
                      disabled={!isUnlocked}
                    >
                      <span>{cosmetic}</span>
                      {isEquipped ? (
                        <span className="badge badge-soft">Equipped</span>
                      ) : isUnlocked ? (
                        <span className="badge">Equip</span>
                      ) : (
                        <span className="badge badge-soft">Locked</span>
                      )}
                    </button>
                  );
                })}
                {progress.equippedCosmetic ? (
                  <button
                    className="btn btn-outline btn-small"
                    type="button"
                    onClick={() => handleEquipCosmetic(null)}
                  >
                    Clear equip
                  </button>
                ) : null}
              </div>
              <div className="row" style={{ flexWrap: "wrap" }}>
                {BADGES.map((badge) => {
                  const isUnlocked = progress.badges.includes(badge);
                  const isEquipped = progress.equippedBadge === badge;
                  return (
                    <button
                      key={badge}
                      className={`loot-chip loot-chip--badge ${isUnlocked ? "" : "is-locked"} ${
                        isEquipped ? "is-selected" : ""
                      }`}
                      type="button"
                      onClick={() => (isUnlocked ? handleEquipBadge(badge) : null)}
                      disabled={!isUnlocked}
                    >
                      {badge}
                    </button>
                  );
                })}
                {progress.equippedBadge ? (
                  <button
                    className="btn btn-outline btn-small"
                    type="button"
                    onClick={() => handleEquipBadge(null)}
                  >
                    Clear badge
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="muted">Loading cosmetics and badges...</div>
          )}
        </div>
      </div>

      <div className="card stack">
        <h2 className="card-title">Your avatar</h2>
        <p className="card-sub">Shown to friends in parties you host.</p>
        <div className="avatar-grid">
          {avatars.map((avatar) => (
            <button
              key={avatar.id}
              className={`avatar-tile ${avatarId === avatar.id ? "is-selected" : ""}`}
              type="button"
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
              onClick={(event) => {
                handleAvatarSelect(avatar.id);
                if (avatar.id === "wizard" && avatarId !== "wizard") triggerWaterFx(event.currentTarget);
                if (avatar.id === "paladin" && avatarId !== "paladin") triggerLightFx(event.currentTarget);
                if (avatar.id === "pepe" && avatarId !== "pepe") triggerEmberFx(event.currentTarget);
                if (avatar.id === "knight" && avatarId !== "knight") triggerKnightFx(event.currentTarget);
                if (avatar.id === "rider" && avatarId !== "rider") triggerSpartanFx(event.currentTarget);
                if (avatar.id === "archer" && avatarId !== "archer") triggerCirceFx(event.currentTarget);
                if (avatar.id === "rogue" && avatarId !== "rogue") triggerRogueFx(event.currentTarget);
              }}
              disabled={savingAvatar}
            >
              <img className="avatar avatar-lg" src={avatar.src} alt={avatar.label} />
              <span className="avatar-label">{avatar.label}</span>
            </button>
          ))}
        </div>
      </div>

      {deckList.length === 0 ? (
        <div className="card stack">
          <h2 className="card-title">Quick start</h2>
          <p className="card-sub">Upload notes, edit the quiz, then host a live party.</p>
          <div className="stack">
            <div className="row">
              <span className="badge">1</span>
              <span>Upload notes or PDFs.</span>
            </div>
            <div className="row">
              <span className="badge">2</span>
              <span>Review and edit the questions.</span>
            </div>
            <div className="row">
              <span className="badge">3</span>
              <span>Start a party and share the link.</span>
            </div>
          </div>
          {sampleError ? <div className="card card--plain">{sampleError}</div> : null}
          <div className="row">
            <Link className="btn btn-primary" href="/decks/new">
              Create a quiz
            </Link>
            <button className="btn btn-outline" onClick={handleCreateSample} disabled={creatingSample}>
              {creatingSample ? "Building sample..." : "Try a sample quiz"}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid-2">
          {deckList.map((deck) => (
            <div key={deck.id} className="card stack">
              <div>
                <h2 className="card-title">{deck.title}</h2>
                <p className="card-sub">{deck.description || "Study quiz"}</p>
              </div>
              <div className="row">
                <span className="badge">{deck.questionCount} questions</span>
              </div>
              <div className="row">
                <Link className="btn btn-outline" href={`/decks/${deck.id}`}>
                  Open quiz
                </Link>
                <Link className="btn btn-outline" href={`/decks/${deck.id}/edit`}>
                  Edit quiz
                </Link>
                <button
                  className="btn btn-primary"
                  onClick={() => handleStartParty(deck.id)}
                  disabled={startingId === deck.id}
                >
                  {startingId === deck.id ? "Starting..." : "Start Party"}
                </button>
                <button
                  className="btn btn-outline btn-small"
                  onClick={() => handleDeleteDeck(deck.id)}
                  disabled={deletingId === deck.id}
                >
                  {deletingId === deck.id ? "Deleting..." : "Delete"}
                </button>
              </div>
              <span className="muted" style={{ fontSize: 12 }}>
                Updated {new Date(deck.updatedAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {isPro ? (
        <div className="card stack">
          <h2 className="card-title">Pro status</h2>
          <p className="card-sub">
            {proExpiresAt
              ? `Active through ${new Date(proExpiresAt).toLocaleDateString()}.`
              : "Your subscription is active."}
          </p>
          <div className="row">
            <form action="/api/billing/portal" method="POST">
              <button className="btn btn-outline" type="submit">
                Manage billing
              </button>
            </form>
            <Link className="btn btn-outline" href="/pricing">
              View plan
            </Link>
          </div>
        </div>
      ) : (
        <div className="card stack">
          <h2 className="card-title">Free tier limits</h2>
          <p className="card-sub">
            Free accounts can create a few quizzes and host small parties. Upgrade for unlimited access.
          </p>
          <div className="row">
            <span className="badge">Up to 5 quizzes</span>
            <span className="badge">Up to 200 questions</span>
            <span className="badge">Up to 20 parties / month</span>
          </div>
          <div className="row">
            <form action="/api/checkout" method="POST">
              <input type="hidden" name="plan" value="monthly" />
              <button className="btn btn-primary" type="submit">
                Upgrade to Pro
              </button>
            </form>
            <Link className="btn btn-outline" href="/pricing">
              See pricing
            </Link>
          </div>
        </div>
      )}

      {isPro ? (
        <button
          className="btn btn-outline btn-small cancel-premium-fab"
          type="button"
          onClick={handleCancelPremium}
          disabled={cancelingPremium}
        >
          {cancelingPremium ? "Canceling..." : "Cancel premium"}
        </button>
      ) : null}
    </div>
  );
}
