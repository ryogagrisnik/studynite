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
  const isGuestUser = sessionStatus !== "authenticated";
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
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showResultsDetails, setShowResultsDetails] = useState(false);
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

  const joinCode = state?.party.joinCode;
  const joinLink = useMemo(() => {
    if (!joinCode) return "";
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/party/join?code=${encodeURIComponent(joinCode)}`;
  }, [joinCode]);

  const inviteMessage = useMemo(() => {
    if (!state) return "";
    const topPlayers = state.players.slice(0, 3);
    const title = state.deck.title ? `"${state.deck.title}"` : "our quiz";
    const lines = [`We just wrapped a RunePrep quiz on ${title}.`];
    if (topPlayers.length) {
      lines.push(`Top players: ${topPlayers.map((player) => player.name).join(", ")}.`);
    }
    lines.push(`Join the next round with code ${state.party.joinCode}.`);
    return lines.join(" ");
  }, [state]);

  useEffect(() => {
    setSelectedAnswerIndex(null);
  }, [state?.question?.id, state?.party.answerRevealedAt]);

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
    if (!playerToken || !state) return;
    if (state.party.mode === "QUIZ" && !state.party.answerRevealedAt) {
      await handleReveal();
      return;
    }
    await fetch(`/api/studyhall/parties/${params.partyId}/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerToken }),
    });
  };

  const handleSubmitAnswer = async (answerIndex: number) => {
    if (!playerToken || !state?.question || !state.player || state.player?.hasSubmitted) return;
    setActionError(null);
    setSelectedAnswerIndex(answerIndex);
    setSubmitting(true);
    try {
      const submitResponse = await fetch(`/api/studyhall/parties/${params.partyId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerToken,
          questionId: state.question.id,
          answerIndex,
        }),
      });
      const submitData = await submitResponse.json();
      if (!submitResponse.ok || !submitData.ok) {
        throw new Error(submitData.error || "Unable to submit answer.");
      }
      await fetch("/api/events/studyhall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "question_submitted",
          partyId: params.partyId,
          questionId: state.question.id,
        }),
      });
    } catch (err: any) {
      setSelectedAnswerIndex(null);
      setActionError(err?.message || "Unable to submit answer.");
    } finally {
      setSubmitting(false);
    }
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

  const handleCopyInviteMessage = async () => {
    if (!inviteMessage) return;
    await navigator.clipboard.writeText(inviteMessage);
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
  const accuracyPct = recap ? Math.round(recap.overallAccuracy * 100) : 0;
  const overallAvgTimeMs = state.results
    ? state.results.players.reduce((sum, player) => sum + (player.avgTimeMs ?? 0), 0) /
      Math.max(1, state.results.players.filter((player) => player.avgTimeMs).length)
    : 0;
  const needsHelp = state.results
    ? [...state.results.players].sort((a, b) => a.accuracy - b.accuracy).slice(0, 3)
    : [];
  const didntFinish = state.results
    ? state.results.players.filter((player) => player.totalAnswered < (state.results?.totalItems ?? totalItems)).slice(0, 3)
    : [];

  const pageClass = state?.party.status === "LOBBY" ? "page stack lobby-bleed" : "page stack";

  return (
    <div className={pageClass}>
      <div className="page-header">
        <div>
          {state.party.status === "LOBBY" || state.party.status === "COMPLETE" ? null : (
            <h1 className="page-title">{state.deck.title}</h1>
          )}
        </div>
        {state.party.status === "LOBBY" || state.party.status === "COMPLETE" ? null : (
          <div className="row">
            <Link className="btn btn-outline" href="/dashboard">
              Exit
            </Link>
          </div>
        )}
      </div>

      {error ? <div className="card" style={{ borderColor: "#FCA5A5" }}>{error}</div> : null}
      {actionError ? <div className="card" style={{ borderColor: "#FCA5A5" }}>{actionError}</div> : null}
      {state.party.status === "LOBBY" ? (
        <div className="card stack lobby-shell lobby-shell--live rpg-reveal">
          <div className="lobby-topbar">
            <div>
              <div className="lobby-kicker">Lobby</div>
              <div className="lobby-sub">Waiting for the host to start.</div>
            </div>
            <div className="lobby-actions">
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
            </div>
          </div>

          <div className="lobby-body">
            <aside className="lobby-sidebar">
              <div className="lobby-brand">RunePrep Live</div>
              <div className="lobby-code-card">
                <span className="lobby-code-label">Enter game code</span>
                <div className="lobby-code-value">{state.party.joinCode}</div>
                <button className="btn btn-outline btn-small" onClick={handleCopyCode}>
                  Copy code
                </button>
              </div>
              <div className="lobby-qr-card">
                <div className="lobby-qr">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                      joinLink
                    )}`}
                    alt="Party QR code"
                  />
                </div>
                <span className="lobby-qr-caption">Scan to join</span>
              </div>
              <div className="lobby-side-actions">
                <button className="btn btn-outline" onClick={handleCopyCode}>
                  Copy code
                </button>
              </div>
              {isHost ? (
                <div className="field lobby-timer">
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
              {state.party.joinLocked ? (
                <span className="badge badge-soft">Join locked</span>
              ) : (
                <span className="muted">Join with QR or game code.</span>
              )}
            </aside>

            <section className="lobby-stage">
              <div className="lobby-stage-title">Players</div>
              <div className="lobby-player-orbit">
                {state.players.map((player, index) => {
                  const avatar = getAvatarById(player.avatarId) ?? getAvatarById(DEFAULT_AVATAR_ID);
                  const angle = (360 / Math.max(1, state.players.length)) * index;
                  return (
                    <div
                      key={player.id}
                      className={`lobby-player${player.isHost ? " is-host" : ""}${player.isActive ? "" : " is-inactive"}`}
                      style={{ ["--angle" as any]: `${angle}deg` }}
                    >
                      {avatar ? <img className="lobby-player-avatar" src={avatar.src} alt={avatar.label} /> : null}
                      <span className="lobby-player-name">{player.name}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {state.party.status === "ACTIVE" && isQuizParty && state.question ? (
        <div className="party-quiz-layout">
          {answerRevealed ? (
            <div className="card stack party-scoreboard-card rpg-reveal">
              <div className="party-scoreboard-head">
                <h2 className="card-title">Scoreboard update</h2>
                <span className="badge">Round {state.party.currentQuestionIndex + 1} results</span>
              </div>
              <div className="scoreboard results">
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
              {state.revealedCorrectIndex !== null ? (
                <div className="card card--plain party-answer-card">
                  Correct answer: {String.fromCharCode(65 + state.revealedCorrectIndex)}
                </div>
              ) : null}
              <span className="muted party-scoreboard-note">
                {isHost ? "Advance when ready." : "Waiting for the host to advance."}
              </span>
            </div>
          ) : null}
          {state.question ? (
            <div className="card stack party-question-card rpg-reveal">
              <div className="party-meta">
                <span className="badge">
                  Q {state.party.currentQuestionIndex + 1} / {totalItems}
                </span>
                <span className="badge">{timeRemaining}s</span>
                {state.party.isPaused ? <span className="badge badge-soft">Paused</span> : null}
              </div>
              <h2 className="party-question-text">{state.question.prompt}</h2>
              <div className="party-options">
                {state.question.choices.map((choice, index) => {
                  const submittedIndex = state.player?.submission?.answerIndex ?? selectedAnswerIndex;
                  const isSelected = submittedIndex === index;
                  const isCorrect = answerRevealed && state.revealedCorrectIndex === index;
                  const isWrong = answerRevealed && isSelected && !isCorrect;
                  return (
                    <button
                      key={`${state.question?.id}-${index}`}
                      className={`party-option${isSelected ? " is-selected" : ""}${isCorrect ? " is-correct" : ""}${isWrong ? " is-wrong" : ""}`}
                      onClick={() => handleSubmitAnswer(index)}
                      disabled={
                        submitting ||
                        !state.player ||
                        submittedIndex !== null ||
                        timeRemaining <= 0 ||
                        answerRevealed ||
                        state.party.isPaused
                      }
                    >
                      <span className="party-option-letter">{String.fromCharCode(65 + index)}</span>
                      <span className="party-option-text">{choice}</span>
                    </button>
                  );
                })}
              </div>
              {state.player?.hasSubmitted || selectedAnswerIndex !== null ? (
                <span className="muted answer-locked-text">
                  {answerRevealed
                    ? "Answer revealed."
                    : "Answer locked. Waiting for the reveal."}
                </span>
              ) : state.party.isPaused ? (
                <span className="muted">Timer paused.</span>
              ) : timeRemaining <= 0 ? (
                <span className="muted">Time is up. Waiting for the reveal.</span>
              ) : null}
            </div>
          ) : null}

          {isHost ? (
            <div className="card stack party-host-card rpg-reveal">
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
                  {answerRevealed ? "Next question" : "Reveal answer"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {state.party.status === "ACTIVE" && isQuizParty && !state.question ? (
        <div className="card">No quiz questions available for this party.</div>
      ) : null}

      {state.party.status === "COMPLETE" ? (
        <div className="report-bleed">
          <div className="report-page rpg-reveal">
          <div className="report-head">
            <div>
              <div className="report-kicker">Report</div>
              <h1 className="report-title">{state.deck.title || "Untitled deck"}</h1>
            </div>
            <div className="report-head-actions">
              <Link className="btn btn-outline btn-small" href="/dashboard">
                Exit
              </Link>
            </div>
          </div>

          <div className="report-tabs">
            <span className="report-tab is-active">Summary</span>
            <span className="report-tab">Players</span>
            <span className="report-tab">Questions</span>
            <span className="report-tab">Feedback</span>
          </div>

          <div className="report-grid">
            <div className="report-card report-card--wide">
              <div className="report-ring" style={{ ["--report-accuracy" as any]: accuracyPct }}>
                <div className="report-ring-value">
                  {accuracyPct}%
                  <span>correct</span>
                </div>
              </div>
              <div className="report-summary">
                <h2>Well played!</h2>
                <p className="muted">
                  Play again and let the same group improve their score or see if new players can beat this result.
                </p>
                <div className="row report-actions">
                  <Link className="btn btn-primary" href="/decks/new">
                    Play again
                  </Link>
                </div>
              </div>
            </div>

            <div className="report-card report-card--stats">
              <div className="report-stat">
                <span>Players</span>
                <strong>{state.players.length}</strong>
              </div>
              <div className="report-stat">
                <span>Questions</span>
                <strong>{state.results?.totalItems ?? totalItems}</strong>
              </div>
              <div className="report-stat">
                <span>Avg. time</span>
                <strong>{overallAvgTimeMs ? `${(overallAvgTimeMs / 1000).toFixed(1)}s` : "—"}</strong>
              </div>
            </div>

            <div className="report-card report-card--cta">
              <div>
                <h3>Share the podium</h3>
                <p className="muted">Celebrate success by sharing the results with players.</p>
              </div>
              <div className="row report-actions">
                <button className="btn btn-primary" onClick={handleCopyResults}>
                  Share results
                </button>
                <button className="btn btn-outline" onClick={handleCopyCode}>
                  Copy game code
                </button>
              </div>
            </div>
          </div>

          <div className="report-lower">
            <div className="report-card report-card--difficult">
              <div className="report-card-head">
                <h3>Difficult questions</h3>
                <span className="badge">{recap?.hardestQuiz.length ?? 0}</span>
              </div>
              {recap?.hardestQuiz.length ? (
                <div className="stack">
                  {recap.hardestQuiz.map((question) => (
                    <div key={question.id} className="report-row">
                      <div>
                        <strong>Q{question.order} ·</strong> {question.prompt}
                      </div>
                      <span className="badge">{Math.round(question.accuracy * 100)}% correct</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">No misses yet.</p>
              )}
            </div>

            <div className="report-card report-card--help">
              <div className="report-card-head">
                <h3>Need help</h3>
                <span className="badge">{needsHelp.length}</span>
              </div>
              {needsHelp.length ? (
                <div className="stack">
                  {needsHelp.map((player) => (
                    <div key={player.id} className="report-row">
                      <span>{player.name}</span>
                      <span className="badge">{Math.round(player.accuracy * 100)}%</span>
                    </div>
                  ))}
                  <button className="btn btn-outline btn-small">View missed questions</button>
                </div>
              ) : (
                <p className="muted">Everyone crushed it.</p>
              )}
            </div>

            <div className="report-card report-card--finish">
              <div className="report-card-head">
                <h3>Didn't finish</h3>
                <span className="badge">{didntFinish.length}</span>
              </div>
              {didntFinish.length ? (
                <div className="stack">
                  {didntFinish.map((player) => (
                    <div key={player.id} className="report-row">
                      <span>{player.name}</span>
                      <span className="muted">
                        {Math.max(0, (state.results?.totalItems ?? totalItems) - player.totalAnswered)} unanswered
                      </span>
                    </div>
                  ))}
                  <button className="btn btn-outline btn-small">Review unanswered</button>
                </div>
              ) : (
                <p className="muted">All players finished.</p>
              )}
            </div>
          </div>

          <div className="report-footer">
            {isGuestUser ? (
              <div className="report-card report-card--cta">
                <h3>Keep making quizzes</h3>
                <p className="muted">Create an account to keep forging new quizzes and hosting parties.</p>
                <div className="row">
                  <Link className="btn btn-primary" href="/signup?callbackUrl=/decks/new">
                    Create free account
                  </Link>
                  <Link className="btn btn-outline" href="/signin?callbackUrl=/decks/new">
                    Sign in
                  </Link>
                </div>
              </div>
            ) : (
              <div className="report-card report-card--cta">
                <h3>Make more in the Forge Quiz tab</h3>
                <p className="muted">Keep building new quizzes and launch another party whenever you are ready.</p>
                <Link className="btn btn-primary" href="/decks/new">
                  Open Forge Quiz
                </Link>
              </div>
            )}
          </div>
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
            <p className="card-sub">Send this code so others can join instantly.</p>
            <div className="stack" style={{ gap: 12 }}>
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
