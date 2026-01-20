"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
    <div className="page stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Your RunePrep quizzes</h1>
          <p className="page-sub">Create quizzes, edit questions, and launch parties.</p>
        </div>
        <Link className="btn btn-primary" href="/decks/new">
          Start a RunePrep Party
        </Link>
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
              onClick={() => handleAvatarSelect(avatar.id)}
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
