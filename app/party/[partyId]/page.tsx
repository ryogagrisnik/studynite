"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";

import { QUESTION_SECONDS } from "@/lib/studyhall/constants";
import { avatars, DEFAULT_AVATAR_ID, getAvatarById, resolveAvatarId } from "@/lib/studyhall/avatars";
import ProgressSummary from "@/components/ProgressSummary";
import {
  applySessionProgress,
  getProgressKey,
  grantFullAccess,
  loadProgress,
  saveProgress,
  type ProgressState,
  type SessionInput,
  type SessionOutcome,
} from "@/lib/progression";

type PartyPlayer = {
  id: string;
  name: string;
  score: number;
  bonusScore: number;
  totalScore: number;
  avatarId: string | null;
  isHost: boolean;
  isActive: boolean;
};

type PartyState = {
  id: string;
  status: "LOBBY" | "ACTIVE" | "COMPLETE";
  mode: "QUIZ" | "FLASHCARDS";
  joinCode: string;
  hostPlayerId: string | null;
  currentQuestionIndex: number;
  questionStartedAt: string | null;
  answerRevealedAt: string | null;
  timeRemainingMs: number;
  questionDurationSec: number;
  joinLocked: boolean;
  isPaused: boolean;
};

type PartyResponse = {
  ok: boolean;
  party: PartyState;
  deck: { title: string; totalQuestions: number; totalFlashcards: number; deckId?: string };
  question: { id: string; prompt: string; choices: string[]; order: number } | null;
  flashcard: { id: string; front: string; back: string; order: number } | null;
  player: {
    id: string;
    name: string;
    score: number;
    bonusScore: number;
    totalScore: number;
    avatarId: string | null;
    isHost: boolean;
    hasSubmitted: boolean;
    submission: {
      isCorrect?: boolean;
      answerIndex?: number;
      knewIt?: boolean;
      timeMs?: number | null;
    } | null;
  } | null;
  players: PartyPlayer[];
  distribution: number[] | null;
  flashcardStats: { knewIt: number; missed: number } | null;
  correctIndex: number | null;
  revealedCorrectIndex: number | null;
  results: {
    mode: "QUIZ" | "FLASHCARDS";
    totalItems: number;
    bonusPointValue: number;
    players: Array<{
      id: string;
      name: string;
      avatarId: string | null;
      score: number;
      bonusScore: number;
      totalScore: number;
      accuracy: number;
      correctCount: number;
      totalAnswered: number;
      avgTimeMs: number | null;
      fastestCount: number;
      knewItCount?: number;
    }>;
    questions: Array<{
      id: string;
      order: number;
      prompt: string;
      correctIndex: number;
      distribution: number[];
      correctCount: number;
      totalCount: number;
      fastestPlayerId: string | null;
      fastestTimeMs: number | null;
    }>;
    flashcards: Array<{
      id: string;
      order: number;
      front: string;
      back: string;
      knewItCount: number;
      missedCount: number;
      totalCount: number;
    }>;
  } | null;
};

type JoinResponse = {
  ok: boolean;
  partyId: string;
  joinCode: string;
  player: { id: string; name: string; score: number; playerToken: string; avatarId: string | null };
  error?: string;
};

export default function PartyPage({ params }: { params: { partyId: string } }) {
  const { data: session, status: sessionStatus } = useSession();
  const userId = sessionStatus === "authenticated" ? ((session?.user as any)?.id as string) : null;
  const userEmail =
    sessionStatus === "authenticated" ? ((session?.user as any)?.email as string | undefined) : undefined;
  const [playerToken, setPlayerToken] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [avatarId, setAvatarId] = useState(resolveAvatarId(null));
  const [state, setState] = useState<PartyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updatingTimer, setUpdatingTimer] = useState(false);
  const [updatingLock, setUpdatingLock] = useState(false);
  const [kickingPlayerId, setKickingPlayerId] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [partyOutcome, setPartyOutcome] = useState<SessionOutcome | null>(null);
  const [partyAwarded, setPartyAwarded] = useState(false);
  const [timerNow, setTimerNow] = useState(Date.now());

  const stateRef = useRef<PartyResponse | null>(null);
  const timerBaseRef = useRef<{
    remainingMs: number;
    updatedAt: number;
    isPaused: boolean;
  } | null>(null);

  const progressKey = useMemo(() => getProgressKey(userId ?? null), [userId]);

  const shareLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/party/${params.partyId}`;
  }, [params.partyId]);

  const awardPartySession = (input: SessionInput) => {
    const base = progress ?? loadProgress(progressKey);
    const { next: entitledBase, changed } = grantFullAccess(base, userEmail);
    if (changed) saveProgress(progressKey, entitledBase);
    const { next, outcome } = applySessionProgress(entitledBase, input);
    saveProgress(progressKey, next);
    setProgress(next);
    return outcome;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(`studyhall:party:${params.partyId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { playerToken?: string; avatarId?: string };
        if (parsed.playerToken) {
          setPlayerToken(parsed.playerToken);
          joinWithToken(parsed.playerToken);
        }
        if (parsed.avatarId) {
          setAvatarId(resolveAvatarId(parsed.avatarId));
        }
      } catch {
        // ignore
      }
    }
  }, [params.partyId]);

  useEffect(() => {
    if (!playerToken) return;
    let isActive = true;
    let pollTimeout: ReturnType<typeof setTimeout> | null = null;
    let eventSource: EventSource | null = null;

    const startPolling = () => {
      if (pollTimeout) return;
      const schedule = () => {
        if (!isActive) return;
        const latest = stateRef.current;
        const delay = latest?.party.status === "ACTIVE" ? 2000 : 4000;
        pollTimeout = setTimeout(async () => {
          await fetchState(playerToken);
          schedule();
        }, delay);
      };
      void fetchState(playerToken);
      schedule();
    };

    const startStream = () => {
      if (typeof window === "undefined" || typeof EventSource === "undefined") {
        startPolling();
        return;
      }
      const url = `/api/studyhall/parties/${params.partyId}/stream?playerToken=${encodeURIComponent(playerToken)}`;
      eventSource = new EventSource(url);
      eventSource.onmessage = (event) => {
        if (!isActive) return;
        try {
          const data = JSON.parse(event.data) as PartyResponse;
          if (data.ok) {
            applyPartyState(data);
            setError(null);
          }
        } catch {
          // ignore stream parse issues
        }
      };
      eventSource.onerror = () => {
        if (!isActive) return;
        eventSource?.close();
        eventSource = null;
        startPolling();
      };
    };

    startStream();
    return () => {
      isActive = false;
      eventSource?.close();
      if (pollTimeout) clearTimeout(pollTimeout);
    };
  }, [playerToken, params.partyId]);

  useEffect(() => {
    if (state?.party.status === "COMPLETE") {
      void fetch("/api/events/studyhall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "party_completed", partyId: params.partyId }),
      });
    }
  }, [state?.party.status, params.partyId]);

  useEffect(() => {
    if (!state) return;
    const interval = setInterval(() => {
      setTimerNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [state?.party.status, state?.party.questionStartedAt, state?.party.isPaused]);

  useEffect(() => {
    const base = loadProgress(progressKey);
    const { next, changed } = grantFullAccess(base, userEmail);
    if (changed) saveProgress(progressKey, next);
    setProgress(next);
  }, [progressKey, userEmail]);

  useEffect(() => {
    setPartyAwarded(false);
    setPartyOutcome(null);
  }, [params.partyId]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!state || state.party.status !== "COMPLETE" || partyAwarded || !state.results) return;
    if (!state.player) return;
    const playerResult = state.results.players.find((player) => player.id === state.player?.id);
    if (!playerResult || (!state.player.isHost && playerResult.totalAnswered === 0)) return;
    const answeredTotal = playerResult.totalAnswered === 0 ? state.results.totalItems : playerResult.totalAnswered;
    const outcome = awardPartySession({
      mode: "party",
      correct: playerResult.correctCount,
      total: answeredTotal,
      deckId: state.deck.deckId,
      hosted: state.player.isHost,
      joined: true,
    });
    setPartyOutcome(outcome);
    setPartyAwarded(true);
  }, [state, partyAwarded, progressKey, sessionStatus]);

  const applyPartyState = (data: PartyResponse) => {
    setState(data);
    stateRef.current = data;
    timerBaseRef.current = {
      remainingMs: data.party.timeRemainingMs,
      updatedAt: Date.now(),
      isPaused: data.party.isPaused,
    };
  };

  const fetchState = async (token: string) => {
    const response = await fetch(
      `/api/studyhall/parties/${params.partyId}/state?playerToken=${encodeURIComponent(token)}`
    );
    const data = (await response.json()) as PartyResponse;
    if (response.ok && data.ok) {
      applyPartyState(data);
      setError(null);
    } else if (!response.ok) {
      setError((data as any)?.error || "Unable to load party state.");
    }
  };

  const joinWithToken = async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/studyhall/parties/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partyId: params.partyId, playerToken: token }),
      });
      const data = (await response.json()) as JoinResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to rejoin.");
      }
      setPlayerToken(data.player.playerToken);
      setPlayerName(data.player.name);
      setAvatarId(resolveAvatarId(data.player.avatarId));
      if (typeof window !== "undefined") {
        window.localStorage.setItem("studyhall:lastPartyId", params.partyId);
      }
    } catch (err: any) {
      setError(err?.message || "Unable to join.");
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(`studyhall:party:${params.partyId}`);
      }
      setPlayerToken(null);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/studyhall/parties/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partyId: params.partyId, name: playerName, avatarId }),
      });
      const data = (await response.json()) as JoinResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to join.");
      }
      setPlayerToken(data.player.playerToken);
      setPlayerName(data.player.name);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          `studyhall:party:${params.partyId}`,
          JSON.stringify({
            playerToken: data.player.playerToken,
            playerId: data.player.id,
            avatarId: data.player.avatarId,
          })
        );
        window.localStorage.setItem("studyhall:lastPartyId", params.partyId);
      }
      await fetch("/api/events/studyhall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "party_joined", partyId: params.partyId }),
      });
    } catch (err: any) {
      setError(err?.message || "Unable to join.");
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!playerToken) return;
    await fetch(`/api/studyhall/parties/${params.partyId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerToken }),
    });
  };

  const handleAdvance = async () => {
    if (!playerToken) return;
    await fetch(`/api/studyhall/parties/${params.partyId}/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerToken }),
    });
  };

  const handleSubmitAnswer = async (answerIndex: number) => {
    if (!playerToken || !state?.question || !state.player || state.player?.hasSubmitted) return;
    setSubmitting(true);
    await fetch(`/api/studyhall/parties/${params.partyId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerToken,
        questionId: state.question.id,
        answerIndex,
      }),
    });
    await fetch("/api/events/studyhall", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "question_submitted",
        partyId: params.partyId,
        questionId: state.question.id,
      }),
    });
    setSubmitting(false);
  };

  const handleFlashcardMark = async (knewIt: boolean) => {
    if (!playerToken || !state?.flashcard || !state.player || state.player?.hasSubmitted) return;
    setSubmitting(true);
    await fetch(`/api/studyhall/parties/${params.partyId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerToken,
        flashcardId: state.flashcard.id,
        knewIt,
      }),
    });
    await fetch("/api/events/studyhall", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "flashcard_marked",
        partyId: params.partyId,
        flashcardId: state.flashcard.id,
      }),
    });
    setSubmitting(false);
  };

  const handleReveal = async () => {
    if (!playerToken) return;
    await fetch(`/api/studyhall/parties/${params.partyId}/reveal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerToken }),
    });
  };

  const handlePause = async () => {
    if (!playerToken) return;
    setActionError(null);
    await fetch(`/api/studyhall/parties/${params.partyId}/pause`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerToken }),
    });
  };

  const handleResume = async () => {
    if (!playerToken) return;
    setActionError(null);
    await fetch(`/api/studyhall/parties/${params.partyId}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerToken }),
    });
  };

  const handleToggleLock = async () => {
    if (!playerToken || !state) return;
    setActionError(null);
    setUpdatingLock(true);
    try {
      const response = await fetch(`/api/studyhall/parties/${params.partyId}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerToken, locked: !state.party.joinLocked }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to update party lock.");
      }
    } catch (err: any) {
      setActionError(err?.message || "Unable to update party lock.");
    } finally {
      setUpdatingLock(false);
    }
  };

  const handleUpdateTimer = async (durationSec: number) => {
    if (!playerToken) return;
    setActionError(null);
    setUpdatingTimer(true);
    try {
      const response = await fetch(`/api/studyhall/parties/${params.partyId}/timer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerToken, questionDurationSec: durationSec }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to update timer.");
      }
    } catch (err: any) {
      setActionError(err?.message || "Unable to update timer.");
    } finally {
      setUpdatingTimer(false);
    }
  };

  const handleKick = async (playerId: string) => {
    if (!playerToken) return;
    setActionError(null);
    setKickingPlayerId(playerId);
    try {
      const response = await fetch(`/api/studyhall/parties/${params.partyId}/kick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerToken, playerId }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to remove player.");
      }
    } catch (err: any) {
      setActionError(err?.message || "Unable to remove player.");
    } finally {
      setKickingPlayerId(null);
    }
  };

  const handleCopy = async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
  };

  const handleCopyCode = async () => {
    if (!state?.party.joinCode) return;
    await navigator.clipboard.writeText(state.party.joinCode);
  };

  const handleCopyResults = async () => {
    if (!state) return;
    const topPlayers = state.players.slice(0, 3);
    const overallAccuracy =
      state.results && state.results.players.length > 0
        ? state.results.players.reduce((sum, player) => sum + player.accuracy, 0) /
          state.results.players.length
        : null;
    const lines = [
      `RunePrep Results - ${state.deck.title}`,
      ...topPlayers.map((player, index) => `${index + 1}. ${player.name} (${player.totalScore})`),
    ];
    if (overallAccuracy !== null) {
      lines.push(`Overall accuracy: ${Math.round(overallAccuracy * 100)}%`);
    }
    if (partyOutcome) {
      lines.push(`Party bonus: ${partyOutcome.bonus.label}`);
    }
    await navigator.clipboard.writeText(lines.join("\n"));
  };

  const timeRemaining = (() => {
    if (!state) return QUESTION_SECONDS;
    const base = timerBaseRef.current;
    if (!base) {
      return Math.max(0, Math.ceil(state.party.timeRemainingMs / 1000));
    }
    if (base.isPaused) {
      return Math.max(0, Math.ceil(base.remainingMs / 1000));
    }
    const elapsed = Math.max(0, timerNow - base.updatedAt);
    return Math.max(0, Math.ceil((base.remainingMs - elapsed) / 1000));
  })();

  if (!playerToken) {
    return (
      <div className="page">
        <div className="card stack rpg-reveal">
          <h1 className="page-title">Join the quiz party</h1>
          <p className="page-sub">Enter your name to join this live quiz session.</p>
          <div className="field">
            <label className="field-label" htmlFor="name">Name</label>
            <input
              id="name"
              className="input"
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
              placeholder="Your name"
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
          <button
            className="btn btn-primary"
            onClick={handleJoin}
            disabled={loading || !playerName.trim()}
          >
            {loading ? "Joining..." : "Join party"}
          </button>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="page">
        <div className="card rpg-reveal">Loading party...</div>
      </div>
    );
  }

  const isHost = Boolean(state.player?.isHost);
  const isQuizParty = state.party.mode === "QUIZ";
  const totalItems = state.deck.totalQuestions;
  const answerRevealed = Boolean(state.party.answerRevealedAt);
  const answersLocked = Boolean(state.player?.hasSubmitted && !answerRevealed);
  const topPlayers = state.players.slice(0, 3);
  const resultPlayerLookup = state.results
    ? new Map(state.results.players.map((player) => [player.id, player]))
    : null;
  const timerOptions = [20, 25, 30];
  const recap = state.results
    ? (() => {
        const totalAnswered = state.results.players.reduce((sum, player) => sum + player.totalAnswered, 0);
        const totalCorrect = state.results.players.reduce((sum, player) => sum + player.correctCount, 0);
        const overallAccuracy = totalAnswered > 0 ? totalCorrect / totalAnswered : 0;
        const hardest = [...state.results.questions]
          .filter((question) => question.totalCount > 0)
          .map((question) => ({
            ...question,
            accuracy: question.correctCount / question.totalCount,
          }))
          .sort((a, b) => a.accuracy - b.accuracy)
          .slice(0, 3);
        return { overallAccuracy, hardestQuiz: hardest };
      })()
    : null;

  return (
    <div className="page stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{state.deck.title}</h1>
          <p className="page-sub">
            Party code: <strong>{state.party.joinCode}</strong>
          </p>
          <div className="row" style={{ marginTop: 8 }}>
            <span className="badge">Quiz session</span>
            {state.party.joinLocked ? <span className="badge badge-soft">Join locked</span> : null}
          </div>
        </div>
        <div className="row">
          <button className="btn btn-outline" onClick={handleCopy}>
            Copy party link
          </button>
          <Link className="btn btn-outline" href="/dashboard">
            Exit
          </Link>
        </div>
      </div>

      {error ? <div className="card" style={{ borderColor: "#FCA5A5" }}>{error}</div> : null}
      {actionError ? <div className="card" style={{ borderColor: "#FCA5A5" }}>{actionError}</div> : null}
      {state.party.status === "COMPLETE" ? (
        <div className="card stack rpg-reveal">
          <h2 className="card-title">Party ended</h2>
          <p className="card-sub">This session is complete. Review results or return to your quiz.</p>
          <div className="row">
            {state.deck.deckId ? (
              <Link className="btn btn-outline" href={`/decks/${state.deck.deckId}`}>
                Open quiz
              </Link>
            ) : null}
            <Link className="btn btn-outline" href="/dashboard">
              Back to dashboard
            </Link>
          </div>
        </div>
      ) : null}

      {state.party.status === "LOBBY" ? (
        <div className="card stack rpg-reveal">
          <h2 className="card-title">Lobby</h2>
          <p className="card-sub">Waiting for the host to start.</p>
          <div className="row">
            {isHost ? (
              <>
                <button className="btn btn-primary" onClick={handleStart}>
                  Start game
                </button>
                <button
                  className="btn btn-outline"
                  onClick={handleToggleLock}
                  disabled={updatingLock}
                >
                  {state.party.joinLocked ? "Unlock joins" : "Lock joins"}
                </button>
              </>
            ) : (
              <span className="badge">Host controls start</span>
            )}
            <span className="badge">Quiz session</span>
            <span className="badge">{state.party.questionDurationSec}s timer</span>
          </div>
          {isHost ? (
            <div className="field" style={{ maxWidth: 240 }}>
              <label className="field-label">Question timer</label>
              <select
                className="select"
                value={state.party.questionDurationSec}
                onChange={(event) => handleUpdateTimer(Number(event.target.value))}
                disabled={updatingTimer}
              >
                {timerOptions.map((option) => (
                  <option key={option} value={option}>{option}s</option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="scoreboard">
            {state.players.map((player) => {
              const avatar = getAvatarById(player.avatarId) ?? getAvatarById(DEFAULT_AVATAR_ID);
              const rowClass = `score-row${player.isHost ? " is-host" : ""}${player.isActive ? "" : " is-inactive"}`;
              return (
                <div key={player.id} className={rowClass}>
                  <span className="row" style={{ gap: 10 }}>
                    {avatar ? <img className="avatar" src={avatar.src} alt={avatar.label} /> : null}
                    {player.name}
                    {!player.isActive ? <span className="badge badge-soft">Offline</span> : null}
                  </span>
                  <span className="row" style={{ gap: 6 }}>
                    <span className="badge">{player.totalScore}</span>
                    {player.bonusScore > 0 ? (
                      <span className="badge badge-soft">+{player.bonusScore}</span>
                    ) : null}
                    {isHost && !player.isHost ? (
                      <button
                        className="btn btn-outline btn-small"
                        onClick={() => handleKick(player.id)}
                        disabled={kickingPlayerId === player.id}
                      >
                        {kickingPlayerId === player.id ? "Removing..." : "Kick"}
                      </button>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="card card--plain stack">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h3 className="card-title">Invite your party</h3>
              <button className="btn btn-outline btn-small" onClick={() => setShowInviteModal(true)}>
                Open invite
              </button>
            </div>
            <p className="card-sub">Share the link or code to bring others in.</p>
            <div className="row">
              <input className="input" value={shareLink} readOnly />
              <button className="btn btn-outline" onClick={handleCopy}>
                Copy link
              </button>
            </div>
            <div className="row">
              <span className="badge">Code: {state.party.joinCode}</span>
              <button className="btn btn-outline btn-small" onClick={handleCopyCode}>
                Copy code
              </button>
            </div>
            {state.party.joinLocked ? (
              <span className="muted">Join is locked by the host.</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {state.party.status === "ACTIVE" && isQuizParty && state.question ? (
        <div className="grid-2">
          <div className="card stack rpg-reveal">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="badge">
                Q {state.party.currentQuestionIndex + 1} / {totalItems}
              </span>
              <span className="badge">{timeRemaining}s</span>
              {state.party.isPaused ? <span className="badge badge-soft">Paused</span> : null}
              {answersLocked ? <span className="badge answer-locked">Answers locked</span> : null}
              {answerRevealed ? <span className="badge">Answer revealed</span> : null}
            </div>
            <h2 className="card-title">{state.question.prompt}</h2>
            <div className="stack">
              {state.question.choices.map((choice, index) => (
                <button
                  key={`${state.question?.id}-${index}`}
                  className="card rpg-reveal"
                  style={{ textAlign: "left" }}
                  onClick={() => handleSubmitAnswer(index)}
                  disabled={
                    submitting ||
                    !state.player ||
                    Boolean(state.player?.hasSubmitted) ||
                    timeRemaining <= 0 ||
                    answerRevealed ||
                    state.party.isPaused
                  }
                >
                  <strong style={{ marginRight: 8 }}>{String.fromCharCode(65 + index)}.</strong>
                  {choice}
                </button>
              ))}
            </div>
            {state.player?.hasSubmitted ? (
              <span className="muted answer-locked-text">Answers locked. Waiting for the reveal.</span>
            ) : answerRevealed ? (
              <span className="muted">Answer revealed.</span>
            ) : state.party.isPaused ? (
              <span className="muted">Timer paused.</span>
            ) : timeRemaining <= 0 ? (
              <span className="muted">Time is up. Waiting for the host to advance.</span>
            ) : null}
            {answerRevealed && state.revealedCorrectIndex !== null ? (
              <div className="card card--plain">
                Correct answer: {String.fromCharCode(65 + state.revealedCorrectIndex)}
              </div>
            ) : null}
          </div>

          <div className="stack">
            <div className="card stack rpg-reveal rpg-reveal-1">
              <h2 className="card-title">Scoreboard</h2>
              <div className="scoreboard">
                {state.players.map((player) => {
                  const avatar = getAvatarById(player.avatarId) ?? getAvatarById(DEFAULT_AVATAR_ID);
                  const rowClass = `score-row${player.isHost ? " is-host" : ""}${player.isActive ? "" : " is-inactive"}`;
                  return (
                    <div key={player.id} className={rowClass}>
                      <span className="row" style={{ gap: 10 }}>
                        {avatar ? <img className="avatar" src={avatar.src} alt={avatar.label} /> : null}
                        {player.name}
                        {!player.isActive ? <span className="badge badge-soft">Offline</span> : null}
                      </span>
                      <span className="row" style={{ gap: 6 }}>
                        <span className="badge">{player.totalScore}</span>
                        {player.bonusScore > 0 ? (
                          <span className="badge badge-soft">+{player.bonusScore}</span>
                        ) : null}
                        {isHost && !player.isHost ? (
                          <button
                            className="btn btn-outline btn-small"
                            onClick={() => handleKick(player.id)}
                            disabled={kickingPlayerId === player.id}
                          >
                            {kickingPlayerId === player.id ? "Removing..." : "Kick"}
                          </button>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {isHost ? (
              <div className="card stack rpg-reveal rpg-reveal-2">
                <h2 className="card-title">Host controls</h2>
                <div className="stack">
                  <span className="badge">
                    Correct answer: {answerRevealed && state.revealedCorrectIndex !== null ? String.fromCharCode(65 + state.revealedCorrectIndex) : "-"}
                  </span>
                  <span className="muted">Fastest correct answer earns +{state.results?.bonusPointValue ?? 1} bonus.</span>
                  <div className="row">
                    <button
                      className="btn btn-outline"
                      onClick={state.party.isPaused ? handleResume : handlePause}
                    >
                      {state.party.isPaused ? "Resume timer" : "Pause timer"}
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={handleReveal}
                      disabled={answerRevealed}
                    >
                      {answerRevealed ? "Answer revealed" : "Reveal answer"}
                    </button>
                  </div>
                  <div className="field" style={{ maxWidth: 240 }}>
                    <label className="field-label">Question timer</label>
                    <select
                      className="select"
                      value={state.party.questionDurationSec}
                      onChange={(event) => handleUpdateTimer(Number(event.target.value))}
                      disabled={updatingTimer}
                    >
                      {timerOptions.map((option) => (
                        <option key={option} value={option}>{option}s</option>
                      ))}
                    </select>
                  </div>
                  {state.distribution ? (
                    <div className="stack">
                      {state.question.choices.map((choice, idx) => (
                        <div key={`${state.question.id}-dist-${idx}`}>
                          <div className="row" style={{ justifyContent: "space-between" }}>
                            <span>{String.fromCharCode(65 + idx)}. {choice}</span>
                            <span className="badge">{state.distribution?.[idx] ?? 0}</span>
                          </div>
                          <div className="progress" style={{ marginTop: 6 }}>
                            <span
                              style={{
                                width: `${state.players.length ? Math.round(((state.distribution?.[idx] ?? 0) / state.players.length) * 100) : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <button className="btn btn-primary" onClick={handleAdvance}>
                    Next / skip question
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {state.party.status === "ACTIVE" && isQuizParty && !state.question ? (
        <div className="card">No quiz questions available for this party.</div>
      ) : null}

      {state.party.status === "COMPLETE" ? (
        <div className="card stack rpg-reveal">
          <h2 className="card-title">Results</h2>
          <div className="card" style={{ borderStyle: "dashed" }}>
            <strong>RunePrep Results</strong>
            <p className="muted">{state.deck.title}</p>
            <div className="stack" style={{ marginTop: 8 }}>
              {topPlayers.map((player, index) => {
                const avatar = getAvatarById(player.avatarId) ?? getAvatarById(DEFAULT_AVATAR_ID);
                return (
                  <div
                    key={player.id}
                    className={`row result-podium-row ${index === 0 ? "is-first" : ""}`}
                    style={{ justifyContent: "space-between" }}
                  >
                    <span className="row" style={{ gap: 10 }}>
                      {avatar ? <img className="avatar" src={avatar.src} alt={avatar.label} /> : null}
                      {index + 1}. {player.name}
                    </span>
                    <span className="badge">{player.totalScore}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="scoreboard results">
            {state.players.map((player, index) => {
              const avatar = getAvatarById(player.avatarId) ?? getAvatarById(DEFAULT_AVATAR_ID);
              const rowClass = `score-row ${player.isHost ? "is-host" : ""}${index < 3 ? " score-row--tier" : ""}`;
              return (
                <div key={player.id} className={rowClass}>
                  <span className="row" style={{ gap: 10 }}>
                    {avatar ? <img className="avatar" src={avatar.src} alt={avatar.label} /> : null}
                    {index + 1}. {player.name}
                  </span>
                  <span className="row" style={{ gap: 6 }}>
                    <span className="badge">{player.totalScore}</span>
                    {player.bonusScore > 0 ? (
                      <span className="badge badge-soft">+{player.bonusScore}</span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>

          {state.results ? (
            <div className="stack">
              {recap ? (
                <div className="card stack">
                  <h3 className="card-title">Session recap</h3>
                  <div className="row">
                    <span className="badge">
                      {Math.round(recap.overallAccuracy * 100)}% overall accuracy
                    </span>
                    <span className="badge badge-soft">{state.results.totalItems} total items</span>
                  </div>
                  <div className="stack">
                    <strong>Most missed questions</strong>
                    {recap.hardestQuiz.length === 0 ? (
                      <span className="muted">No misses yet.</span>
                    ) : (
                      recap.hardestQuiz.map((question) => (
                        <div key={question.id} className="card card--plain">
                          <div className="row" style={{ justifyContent: "space-between" }}>
                            <span className="badge">Q{question.order}</span>
                            <span className="badge">
                              {Math.round(question.accuracy * 100)}% correct
                            </span>
                          </div>
                          <p className="muted">{question.prompt}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
              <div className="grid-2">
                <div className="card stack">
                  <h3 className="card-title">Performance</h3>
                  <div className="stack">
                    {state.results.players.map((player) => {
                      const avatar = getAvatarById(player.avatarId) ?? getAvatarById(DEFAULT_AVATAR_ID);
                    const accuracy = `${Math.round(player.accuracy * 100)}%`;
                    const avgTime = player.avgTimeMs ? `${(player.avgTimeMs / 1000).toFixed(1)}s avg` : "— avg";
                    return (
                      <div key={player.id} className="card card--plain stack">
                        <div className="row" style={{ justifyContent: "space-between" }}>
                          <span className="row" style={{ gap: 10 }}>
                            {avatar ? <img className="avatar" src={avatar.src} alt={avatar.label} /> : null}
                            <strong>{player.name}</strong>
                          </span>
                          <span className="badge">{player.totalScore}</span>
                        </div>
                        <div className="row muted" style={{ gap: 12 }}>
                          <span>{accuracy} accuracy</span>
                          <span>{avgTime}</span>
                          <span>Fastest x{player.fastestCount}</span>
                          {player.bonusScore > 0 ? <span>Bonus +{player.bonusScore}</span> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>

                <div className="card stack">
                  <h3 className="card-title">Question breakdown</h3>
                  <div className="stack">
                    {state.results.questions.map((question) => {
                          const total = question.totalCount || 1;
                          const accuracy = total > 0 ? question.correctCount / total : 0;
                          const isSwing = total > 0 && accuracy < 0.5;
                          const fastest = question.fastestPlayerId && resultPlayerLookup
                            ? resultPlayerLookup.get(question.fastestPlayerId)
                            : null;
                          return (
                            <div key={question.id} className="card card--plain stack">
                              <div className="row" style={{ justifyContent: "space-between" }}>
                                <span className="row" style={{ gap: 6 }}>
                                  <span className="badge">Q{question.order}</span>
                                  {isSwing ? <span className="badge swing-badge">Swing question</span> : null}
                                </span>
                                <span className="badge">
                                  Correct: {String.fromCharCode(65 + question.correctIndex)}
                                </span>
                              </div>
                              <p className="muted">{question.prompt}</p>
                              <div className="stack">
                                {question.distribution.map((count, idx) => (
                                  <div key={`${question.id}-dist-${idx}`}>
                                    <div className="row" style={{ justifyContent: "space-between" }}>
                                      <span>{String.fromCharCode(65 + idx)}</span>
                                      <span className="badge">{count}</span>
                                    </div>
                                    <div className="progress" style={{ marginTop: 6 }}>
                                      <span style={{ width: `${Math.round((count / total) * 100)}%` }} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="row muted">
                                <span>
                                  Fastest: {fastest ? fastest.name : "—"}
                                </span>
                                <span>
                                  {question.fastestTimeMs ? `${(question.fastestTimeMs / 1000).toFixed(1)}s` : ""}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {partyOutcome && progress ? (
            <ProgressSummary
              progress={progress}
              outcome={partyOutcome}
              headline="Party Bonus Unlocked"
              modeLabel="Quiz party"
            />
          ) : null}
          <div className="row">
            <Link className="btn btn-primary" href="/dashboard">
              Play again
            </Link>
            <button className="btn btn-outline" onClick={handleCopyResults}>
              Share results
            </button>
            <button className="btn btn-outline" onClick={handleCopy}>
              Copy party link
            </button>
          </div>
        </div>
      ) : null}
      {showInviteModal ? (
        <div className="modal-backdrop" onClick={() => setShowInviteModal(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h3 className="card-title">Invite your party</h3>
              <button className="btn btn-outline btn-small" onClick={() => setShowInviteModal(false)}>
                Close
              </button>
            </div>
            <p className="card-sub">Send this link or code so others can join instantly.</p>
            <div className="stack" style={{ gap: 12 }}>
              <div className="row">
                <input className="input" value={shareLink} readOnly />
                <button className="btn btn-outline" onClick={handleCopy}>
                  Copy link
                </button>
              </div>
              <div className="row">
                <span className="badge">Code: {state.party.joinCode}</span>
                <button className="btn btn-outline btn-small" onClick={handleCopyCode}>
                  Copy code
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
