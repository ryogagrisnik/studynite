"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProgressSummary from "@/components/ProgressSummary";
import {
  applySessionProgress,
  getProgressKey,
  grantFullAccess,
  loadProgress,
  saveProgress,
  type ProgressState,
  type SessionOutcome,
  type SessionInput,
} from "@/lib/progression";

type DeckQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string | null;
};

type DeckFlashcard = {
  id: string;
  front: string;
  back: string;
};

type StudyMode = "quiz" | "flashcards" | "learn";
type FlashcardResult = "knew" | "missed";
type LearnMode = "typed" | "mc";

type DeckViewProps = {
  deck: {
    id: string;
    title: string;
    shareId: string;
    shareExpiresAt?: string | null;
    questions: DeckQuestion[];
    flashcards: DeckFlashcard[];
    regenerateCount?: number;
    regenerateLimit?: number;
  };
  userName: string | null;
  isPro: boolean;
  isOwner: boolean;
  userAvatarId: string | null;
  userEmail: string | null;
  userId?: string | null;
};

function shuffleArray<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildIndexList(length: number) {
  return Array.from({ length }, (_, index) => index);
}

function normalizeAnswer(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "by",
  "is",
  "are",
  "was",
  "were",
  "be",
  "as",
  "at",
  "from",
  "that",
  "this",
  "these",
  "those",
  "it",
  "its",
  "into",
  "over",
  "under",
  "about",
  "than",
  "then",
  "but",
  "if",
  "so",
  "such",
  "via",
  "per",
  "not",
  "no",
]);

function tokenizeForMatch(value: string) {
  return (value.match(/[a-z0-9]+/g) || []).filter((token) => {
    if (STOPWORDS.has(token)) return false;
    return token.length >= 3 || /\d/.test(token);
  });
}

function isAnswerCloseEnough(answer: string, target: string) {
  const answerClean = normalizeAnswer(answer);
  const targetClean = normalizeAnswer(target);
  if (!answerClean || !targetClean) return false;
  if (answerClean === targetClean) return true;

  const minShared = 4;
  if (
    targetClean.includes(answerClean) &&
    answerClean.length >= Math.max(minShared, Math.floor(targetClean.length * 0.6))
  ) {
    return true;
  }
  if (
    answerClean.includes(targetClean) &&
    targetClean.length >= Math.max(minShared, Math.floor(answerClean.length * 0.6))
  ) {
    return true;
  }

  const answerTokens = tokenizeForMatch(answerClean);
  const targetTokens = tokenizeForMatch(targetClean);
  if (answerTokens.length === 0 || targetTokens.length === 0) return false;
  const targetSet = new Set(targetTokens);
  let matches = 0;
  for (const token of answerTokens) {
    if (targetSet.has(token)) matches += 1;
  }
  const overlap = matches / targetTokens.length;
  if (overlap >= 0.6) return true;
  if (matches >= 3 && overlap >= 0.5) return true;
  if (answerTokens.length <= 2 && matches === answerTokens.length && matches > 0) return true;
  return false;
}

function buildChoices(cards: DeckFlashcard[], cardIndex: number) {
  const correct = cards[cardIndex]?.back ?? "";
  const others = cards
    .map((card, idx) => ({ idx, back: card.back }))
    .filter((card) => card.idx !== cardIndex && card.back && card.back !== correct);
  const shuffled = shuffleArray(others);
  const distractors: string[] = [];
  for (const option of shuffled) {
    if (!distractors.includes(option.back)) {
      distractors.push(option.back);
    }
    if (distractors.length >= 3) break;
  }
  return shuffleArray([correct, ...distractors]);
}

export default function DeckViewClient({
  deck,
  userName,
  isPro,
  isOwner,
  userAvatarId,
  userEmail,
  userId,
}: DeckViewProps) {
  const router = useRouter();
  const hasFlashcards = deck.flashcards.length > 0;
  const [questions, setQuestions] = useState(deck.questions);
  const hasQuestions = questions.length > 0;
  const [mode, setMode] = useState<StudyMode>(
    hasQuestions ? "quiz" : hasFlashcards ? "flashcards" : "quiz"
  );
  const [quizOrder, setQuizOrder] = useState<number[]>(() => buildIndexList(questions.length));
  const [quizCursor, setQuizCursor] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [quizResults, setQuizResults] = useState<Record<string, boolean>>({});
  const [flashcardQueue, setFlashcardQueue] = useState<number[]>(() =>
    buildIndexList(deck.flashcards.length)
  );
  const [flashcardRound, setFlashcardRound] = useState<"all" | "missed">("all");
  const [flashcardResults, setFlashcardResults] = useState<Record<string, FlashcardResult>>({});
  const [showBack, setShowBack] = useState(false);
  const [learnMode, setLearnMode] = useState<LearnMode>(() =>
    deck.flashcards.length >= 2 ? "mc" : "typed"
  );
  const [learnQueue, setLearnQueue] = useState<number[]>(
    deck.flashcards.map((_, index) => index)
  );
  const [learnAnswer, setLearnAnswer] = useState("");
  const [learnFeedback, setLearnFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [learnPendingQueue, setLearnPendingQueue] = useState<number[] | null>(null);
  const [learnStats, setLearnStats] = useState({ correct: 0, total: 0 });
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [quizAwarded, setQuizAwarded] = useState(false);
  const [flashcardAwarded, setFlashcardAwarded] = useState(false);
  const [learnAwarded, setLearnAwarded] = useState(false);
  const [quizOutcome, setQuizOutcome] = useState<SessionOutcome | null>(null);
  const [flashcardOutcome, setFlashcardOutcome] = useState<SessionOutcome | null>(null);
  const [learnOutcome, setLearnOutcome] = useState<SessionOutcome | null>(null);
  const [startingParty, setStartingParty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllQuestions, setShowAllQuestions] = useState(false);
  const [showAllCards, setShowAllCards] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [regenerateCount, setRegenerateCount] = useState(deck.regenerateCount ?? 0);
  const [shareExpiresAt, setShareExpiresAt] = useState<string | null>(deck.shareExpiresAt ?? null);
  const [shareUpdating, setShareUpdating] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareExpiryOption, setShareExpiryOption] = useState<"never" | "24h" | "7d" | "30d">("never");
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const regenerateLimit = deck.regenerateLimit ?? 0;
  const remainingRegens = Math.max(0, regenerateLimit - regenerateCount);

  const progressKey = useMemo(() => getProgressKey(userId), [userId]);

  const previewCount = 5;
  const missedQuestions = useMemo(
    () => questions.filter((question) => quizResults[question.id] === false),
    [questions, quizResults]
  );
  const missedCards = useMemo(
    () => deck.flashcards.filter((card) => flashcardResults[card.id] === "missed"),
    [deck.flashcards, flashcardResults]
  );
  const questionsToShow = showAllQuestions
    ? missedQuestions
    : missedQuestions.slice(0, previewCount);
  const cardsToShow = showAllCards
    ? missedCards
    : missedCards.slice(0, previewCount);

  const quizIsComplete = quizCursor >= quizOrder.length;
  const currentQuestionIndex = quizIsComplete ? null : quizOrder[quizCursor];
  const currentQuestion =
    currentQuestionIndex !== null && currentQuestionIndex !== undefined
      ? questions[currentQuestionIndex]
      : null;
  const flashcardDone = flashcardQueue.length === 0;
  const currentCardIndex = flashcardQueue[0] ?? null;
  const currentCard = currentCardIndex !== null ? deck.flashcards[currentCardIndex] : null;
  const canStartParty = isOwner && hasQuestions;
  const learnCardIndex = learnQueue[0] ?? null;
  const learnCard = learnCardIndex !== null ? deck.flashcards[learnCardIndex] : null;
  const learnChoices = useMemo(() => {
    if (!learnCard || deck.flashcards.length < 2) return [];
    return buildChoices(deck.flashcards, learnCardIndex);
  }, [deck.flashcards, learnCard, learnCardIndex]);
  const quizMissedOrder = useMemo(
    () =>
      quizOrder.filter((index) => {
        const question = questions[index];
        if (!question) return false;
        return quizResults[question.id] === false;
      }),
    [questions, quizOrder, quizResults]
  );
  const flashcardMissedQueue = useMemo(
    () =>
      deck.flashcards
        .map((card, index) => ({ card, index }))
        .filter((item) => flashcardResults[item.card.id] === "missed")
        .map((item) => item.index),
    [deck.flashcards, flashcardResults]
  );
  const flashcardKnownCount = useMemo(
    () => Object.values(flashcardResults).filter((result) => result === "knew").length,
    [flashcardResults]
  );
  const flashcardMissedCount = useMemo(
    () => Object.values(flashcardResults).filter((result) => result === "missed").length,
    [flashcardResults]
  );
  const quizCorrectCount = useMemo(
    () => Object.values(quizResults).filter((value) => value).length,
    [quizResults]
  );
  const quizAnsweredCount = useMemo(() => Object.keys(quizResults).length, [quizResults]);
  const flashcardResultCount = useMemo(
    () => flashcardKnownCount + flashcardMissedCount,
    [flashcardKnownCount, flashcardMissedCount]
  );
  const hasQuizAttempts = quizAnsweredCount > 0;
  const hasFlashcardAttempts = flashcardResultCount > 0;

  const shareLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/decks/${deck.id}?shareId=${deck.shareId}`;
  }, [deck.id, deck.shareId]);
  const buildReportLink = (type: string, prompt: string) => {
    const subject = `RunePrep report: ${deck.title}`;
    const body = `Quiz: ${deck.title}\nQuiz ID: ${deck.id}\nType: ${type}\nPrompt:\n${prompt}`;
    return `mailto:support@runeprep.app?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  useEffect(() => {
    if (!shareExpiresAt) {
      setShareExpiryOption("never");
      return;
    }
    const now = Date.now();
    const expires = new Date(shareExpiresAt).getTime();
    const hours = (expires - now) / 36e5;
    if (hours > 20 && hours < 28) {
      setShareExpiryOption("24h");
    } else if (hours > 140 && hours < 190) {
      setShareExpiryOption("7d");
    } else if (hours > 650 && hours < 820) {
      setShareExpiryOption("30d");
    } else {
      setShareExpiryOption("30d");
    }
  }, [shareExpiresAt]);

  useEffect(() => {
    setQuestions(deck.questions);
    setRegenerateCount(deck.regenerateCount ?? 0);
  }, [deck.id, deck.questions, deck.regenerateCount]);

  const handleAnswer = async (choiceIndex: number) => {
    if (showResult || !currentQuestion || quizIsComplete) return;
    setSelectedIndex(choiceIndex);
    setShowResult(true);

    const isCorrect = choiceIndex === currentQuestion.correctIndex;
    setQuizResults((prev) => ({ ...prev, [currentQuestion.id]: isCorrect }));
    if (isOwner) {
      await fetch("/api/studyhall/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: currentQuestion.id, isCorrect }),
      });
    }
  };

  const resetQuiz = (nextOrder?: number[]) => {
    const order = nextOrder ?? buildIndexList(questions.length);
    setQuizOrder(order);
    setQuizCursor(0);
    setSelectedIndex(null);
    setShowResult(false);
    setQuizResults({});
    setQuizAwarded(false);
    setQuizOutcome(null);
  };

  const resetFlashcards = (nextQueue?: number[], round: "all" | "missed" = "all") => {
    const queue = nextQueue ?? buildIndexList(deck.flashcards.length);
    setFlashcardQueue(queue);
    setFlashcardRound(round);
    setFlashcardResults({});
    setShowBack(false);
    setFlashcardAwarded(false);
    setFlashcardOutcome(null);
  };

  const handleNextQuestion = () => {
    setSelectedIndex(null);
    setShowResult(false);
    setQuizCursor((prev) => Math.min(prev + 1, quizOrder.length));
  };

  const handleRetakeQuiz = () => {
    setMode("quiz");
    resetQuiz();
  };

  const handlePracticeMissed = () => {
    if (quizMissedOrder.length === 0) return;
    setMode("quiz");
    resetQuiz(quizMissedOrder);
  };

  const handleFlashcardResult = (result: FlashcardResult) => {
    if (!currentCard) return;
    setFlashcardResults((prev) => ({ ...prev, [currentCard.id]: result }));
    setShowBack(false);
    setFlashcardQueue((prev) => {
      if (prev.length === 0) return prev;
      const [current, ...rest] = prev;
      if (result === "knew") return rest;
      return [...rest, current];
    });
  };

  const handleFlashcardReviewMissed = () => {
    if (flashcardMissedQueue.length === 0) return;
    resetFlashcards(flashcardMissedQueue, "missed");
  };

  const resetLearn = () => {
    setLearnQueue(shuffleArray(deck.flashcards.map((_, index) => index)));
    setLearnAnswer("");
    setLearnFeedback(null);
    setLearnPendingQueue(null);
    setLearnStats({ correct: 0, total: 0 });
    setLearnAwarded(false);
    setLearnOutcome(null);
  };

  const handleStartParty = async () => {
    if (!canStartParty) {
      setError("Quiz parties require quiz questions in this quiz.");
      return;
    }
    setError(null);
    setStartingParty(true);
    try {
      const response = await fetch("/api/studyhall/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckId: deck.id,
          hostName: userName ?? undefined,
          avatarId: userAvatarId ?? undefined,
          mode: "QUIZ",
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to start party.");
      }
      await fetch("/api/events/studyhall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "party_created", deckId: deck.id, partyId: data.partyId }),
      });
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
      setStartingParty(false);
    }
  };

  const handleRegenerate = async () => {
    if (!isOwner) return;
    setRegenerateError(null);
    setRegenerating(true);
    try {
      const response = await fetch(`/api/studyhall/decks/${deck.id}/regenerate`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to regenerate quiz.");
      }
      const nextQuestions: DeckQuestion[] = data.questions || [];
      setQuestions(nextQuestions);
      setRegenerateCount(data.regenerateCount ?? regenerateCount + 1);
      setShowAllQuestions(false);
      resetQuiz(buildIndexList(nextQuestions.length));
    } catch (err: any) {
      setRegenerateError(err?.message || "Unable to regenerate quiz.");
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopyShare = async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setShareNotice("Viewer link copied.");
    setTimeout(() => setShareNotice(null), 2000);
  };

  const handleCopyShareCode = async () => {
    await navigator.clipboard.writeText(deck.shareId);
    setShareNotice("Deck code copied.");
    setTimeout(() => setShareNotice(null), 2000);
  };

  const handleShareSettingsUpdate = async (payload: {
    enableEditLink?: boolean;
    shareExpiresAt?: string | null;
  }) => {
    setShareUpdating(true);
    setShareError(null);
    try {
      const response = await fetch(`/api/studyhall/decks/${deck.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to update share settings.");
      }
      setShareExpiresAt(data.shareExpiresAt ?? null);
      setShareNotice("Share settings updated.");
      setTimeout(() => setShareNotice(null), 2000);
    } catch (err: any) {
      setShareError(err?.message || "Unable to update share settings.");
    } finally {
      setShareUpdating(false);
    }
  };

  const handleShareExpiryChange = async (value: "never" | "24h" | "7d" | "30d") => {
    setShareExpiryOption(value);
    const nextExpiry =
      value === "never"
        ? null
        : new Date(
            Date.now() +
              (value === "24h" ? 24 : value === "7d" ? 7 * 24 : 30 * 24) * 3600 * 1000
          ).toISOString();
    await handleShareSettingsUpdate({ shareExpiresAt: nextExpiry });
  };

  const awardSession = (input: SessionInput) => {
    const base = progress ?? loadProgress(progressKey);
    const { next: entitledBase, changed } = grantFullAccess(base, userEmail);
    if (changed) saveProgress(progressKey, entitledBase);
    const { next, outcome } = applySessionProgress(entitledBase, input);
    saveProgress(progressKey, next);
    setProgress(next);
    return outcome;
  };

  const handleLearnSubmit = (choice?: string) => {
    if (!learnCard || learnFeedback) return;
    const answer = learnMode === "mc" ? (choice ?? "") : learnAnswer;
    const isCorrect =
      learnMode === "mc"
        ? normalizeAnswer(answer) === normalizeAnswer(learnCard.back)
        : isAnswerCloseEnough(answer, learnCard.back);
    setLearnStats((prev) => ({
      total: prev.total + 1,
      correct: prev.correct + (isCorrect ? 1 : 0),
    }));
    const nextQueue = (() => {
      if (learnQueue.length === 0) return [];
      const current = learnQueue[0];
      const rest = learnQueue.slice(1);
      if (isCorrect) return rest;
      const insertAt = Math.min(2, rest.length);
      const next = [...rest];
      next.splice(insertAt, 0, current);
      return next;
    })();
    setLearnPendingQueue(nextQueue);
    setLearnFeedback(isCorrect ? "correct" : "incorrect");
  };

  const handleFlipCard = () => {
    setShowBack((prev) => !prev);
  };

  const handleLearnNext = () => {
    if (learnPendingQueue) {
      setLearnQueue(learnPendingQueue);
    }
    setLearnAnswer("");
    setLearnFeedback(null);
    setLearnPendingQueue(null);
  };

  useEffect(() => {
    resetLearn();
  }, [deck.id, learnMode]);

  useEffect(() => {
    if (learnMode === "mc" && deck.flashcards.length < 2) {
      setLearnMode("typed");
    }
  }, [deck.flashcards.length, learnMode]);

  useEffect(() => {
    resetQuiz();
    resetFlashcards();
  }, [deck.id, questions.length, deck.flashcards.length]);

  useEffect(() => {
    const base = loadProgress(progressKey);
    const { next, changed } = grantFullAccess(base, userEmail);
    if (changed) saveProgress(progressKey, next);
    setProgress(next);
  }, [progressKey, userEmail]);

  useEffect(() => {
    if (!hasQuestions || quizAwarded || !quizIsComplete) return;
    if (quizOrder.length === 0 || quizAnsweredCount === 0) return;
    if (quizAnsweredCount < quizOrder.length) return;
    const outcome = awardSession({
      mode: "quiz",
      correct: quizCorrectCount,
      total: quizOrder.length,
      deckId: deck.id,
    });
    setQuizOutcome(outcome);
    setQuizAwarded(true);
  }, [
    hasQuestions,
    quizAwarded,
    quizIsComplete,
    quizAnsweredCount,
    quizOrder.length,
    quizCorrectCount,
    deck.id,
  ]);

  useEffect(() => {
    if (!hasFlashcards || flashcardAwarded || !flashcardDone) return;
    if (flashcardResultCount === 0) return;
    const outcome = awardSession({
      mode: "flashcards",
      correct: flashcardKnownCount,
      total: flashcardResultCount,
      deckId: deck.id,
    });
    setFlashcardOutcome(outcome);
    setFlashcardAwarded(true);
  }, [
    hasFlashcards,
    flashcardAwarded,
    flashcardDone,
    flashcardResultCount,
    flashcardKnownCount,
    deck.id,
  ]);

  useEffect(() => {
    if (!hasFlashcards || learnAwarded || learnQueue.length > 0) return;
    if (learnStats.total === 0) return;
    const outcome = awardSession({
      mode: "learn",
      correct: learnStats.correct,
      total: learnStats.total,
      deckId: deck.id,
    });
    setLearnOutcome(outcome);
    setLearnAwarded(true);
  }, [hasFlashcards, learnAwarded, learnQueue.length, learnStats, deck.id]);

  return (
    <div className="page stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{deck.title}</h1>
          <p className="page-sub">Practice solo or host a live party from your uploaded material.</p>
        </div>
        <div className="row">
          {isOwner ? (
            <>
              <Link className="btn btn-outline" href={`/decks/${deck.id}/edit`}>
                Edit quiz
              </Link>
            </>
          ) : (
            <span className="badge">Shared quiz (read-only)</span>
          )}
        </div>
      </div>

      {error ? <div className="card" style={{ borderColor: "#FCA5A5" }}>{error}</div> : null}

      {isOwner ? (
        <div className="card stack">
          <h2 className="card-title">Host a live quiz party</h2>
          <p className="card-sub">
            Quiz parties are live multiplayer sessions. Share a link or code so everyone joins the same round.
          </p>
          <div className="row">
            <button
              className="btn btn-primary"
              onClick={handleStartParty}
              disabled={startingParty || !canStartParty}
            >
              {startingParty ? "Starting..." : "Start party"}
            </button>
            <span className="muted">
              Invite friends with a private link or code.
            </span>
          </div>
          {!canStartParty ? (
            <div className="muted">
              Add quiz questions to enable parties.
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="card stack">
        <div>
          <h2 className="card-title">Practice solo</h2>
          <p className="card-sub">Run quick quiz rounds without repeating what you already know.</p>
        </div>

        {mode === "quiz" ? (
          hasQuestions ? (
            !quizIsComplete && currentQuestion ? (
              <div className="quiz-shell">
                <div className="quiz-meta">
                  <span className="quiz-progress">
                    Q {Math.min(quizCursor + 1, quizOrder.length)} / {quizOrder.length}
                  </span>
                  <button className="btn btn-outline btn-small" onClick={handleRetakeQuiz}>
                    Restart quiz
                  </button>
                </div>

                <div className="quiz-card">
                  <span className="quiz-label">Question</span>
                  <div className="quiz-text">{currentQuestion.prompt}</div>
                </div>

                <span className="quiz-label">Choose an answer</span>
                <div className="quiz-options">
                  {currentQuestion.choices.map((choice, index) => {
                    const isSelected = selectedIndex === index;
                    const isCorrect = showResult && index === currentQuestion.correctIndex;
                    const isWrong = showResult && isSelected && !isCorrect;
                    return (
                      <button
                        key={`${choice}-${index}`}
                        className="quiz-option"
                        onClick={() => handleAnswer(index)}
                        disabled={showResult}
                        style={{
                          borderColor: isCorrect
                            ? "#16A34A"
                            : isWrong
                            ? "#FCA5A5"
                            : "var(--border)",
                          background: isCorrect
                            ? "#DCFCE7"
                            : isWrong
                            ? "#FEF2F2"
                            : "#fff",
                        }}
                      >
                        <span className="quiz-choice">
                          <span className="quiz-letter">{String.fromCharCode(65 + index)}.</span>
                          <span>{choice}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {showResult ? (
                  <div className="quiz-result">
                    <strong>
                      {selectedIndex === currentQuestion.correctIndex ? "Correct" : "Incorrect"}
                    </strong>
                    {isPro && currentQuestion.explanation ? (
                      <p className="card-sub" style={{ marginTop: 8 }}>
                        {currentQuestion.explanation}
                      </p>
                    ) : null}
                    <div className="row" style={{ marginTop: 12 }}>
                      <button className="btn btn-primary" onClick={handleNextQuestion}>
                        {quizCursor + 1 < quizOrder.length ? "Next question" : "Finish quiz"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="stack">
                <div className="card stack">
                  <strong>Quiz complete</strong>
                  <p className="card-sub" style={{ marginTop: 8 }}>
                    You got {quizCorrectCount} / {quizOrder.length} correct.
                  </p>
                  <div className="row" style={{ marginTop: 12 }}>
                    <button
                      className="btn btn-primary"
                      onClick={handlePracticeMissed}
                      disabled={quizMissedOrder.length === 0}
                    >
                      Practice missed ({quizMissedOrder.length})
                    </button>
                    <button className="btn btn-outline" onClick={handleRetakeQuiz}>
                      Restart full quiz
                    </button>
                  </div>
                </div>
                {quizOutcome && progress ? (
                  <ProgressSummary
                    progress={progress}
                    outcome={quizOutcome}
                    modeLabel="Quiz run"
                  />
                ) : null}
              </div>
            )
          ) : (
            <div className="muted">No quiz questions in this quiz.</div>
          )
        ) : null}

      </div>

      <div className="card stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2 className="card-title">Missed questions</h2>
            <p className="card-sub">
              This library only tracks what you missed in your latest run.
            </p>
          </div>
          <div className="row">
            <button
              className="btn btn-outline btn-small"
              onClick={handlePracticeMissed}
              disabled={quizMissedOrder.length === 0}
            >
              Practice missed
            </button>
          </div>
        </div>
        <div className="card stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>Missed quiz questions</strong>
            {missedQuestions.length > previewCount ? (
              <button
                className="btn btn-outline btn-small"
                onClick={() => setShowAllQuestions((prev) => !prev)}
              >
                {showAllQuestions ? "Show less" : "Show all"}
              </button>
            ) : null}
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {questionsToShow.map((question, index) => (
              <div key={question.id} className="review-item">
                <div className="review-item-title">
                  Q{index + 1}. {question.prompt}
                </div>
                <div className="review-item-sub">
                  Correct: {question.choices[question.correctIndex]}
                </div>
                {isPro && question.explanation ? (
                  <div className="review-item-sub">Note: {question.explanation}</div>
                ) : null}
                <div className="review-item-actions">
                  <a
                    className="btn btn-outline btn-small"
                    href={buildReportLink("Quiz question", question.prompt)}
                  >
                    Report question
                  </a>
                </div>
              </div>
            ))}
            {questionsToShow.length === 0 ? (
              <div className="muted">
                {hasQuizAttempts ? "No missed questions this run." : "Complete a quiz run to track misses."}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {isOwner ? (
        <div className="card stack">
          <h2 className="card-title">Regenerate quiz</h2>
          <p className="muted">
            Create a fresh set of questions from the original source. {remainingRegens} regeneration
            {remainingRegens === 1 ? "" : "s"} remaining.
          </p>
          {regenerateError ? (
            <div className="card card--plain" style={{ borderColor: "#FCA5A5" }}>
              {regenerateError}
            </div>
          ) : null}
          <div className="row">
            <button
              className="btn btn-outline"
              type="button"
              onClick={handleRegenerate}
              disabled={regenerating || remainingRegens === 0}
            >
              {regenerating ? "Regenerating..." : "Regenerate questions"}
            </button>
          </div>
        </div>
      ) : null}

      {isOwner ? (
        <div className="card stack">
          <h2 className="card-title">Share this quiz</h2>
          <p className="card-sub">Send a link or code so others can run the quiz on their own.</p>
          {shareError ? <div className="card card--plain">{shareError}</div> : null}
          <div className="field">
            <label className="field-label">Viewer link</label>
            <div className="row">
              <input className="input" value={shareLink} readOnly />
              <button className="btn btn-outline" onClick={handleCopyShare}>
                Copy link
              </button>
            </div>
          </div>
          <div className="field">
            <label className="field-label">Quiz code</label>
            <div className="row">
              <input className="input" value={deck.shareId} readOnly />
              <button className="btn btn-outline" onClick={handleCopyShareCode}>
                Copy code
              </button>
            </div>
            <span className="muted">Share this code with anyone you want to quiz.</span>
          </div>
          <div className="field">
            <label className="field-label">Link expiry</label>
            <div className="row">
              <select
                className="select"
                value={shareExpiryOption}
                onChange={(event) =>
                  handleShareExpiryChange(event.target.value as "never" | "24h" | "7d" | "30d")
                }
                disabled={shareUpdating}
              >
                <option value="never">Never</option>
                <option value="24h">24 hours</option>
                <option value="7d">7 days</option>
                <option value="30d">30 days</option>
              </select>
              <span className="muted">
                {shareExpiresAt ? `Expires ${new Date(shareExpiresAt).toLocaleString()}` : "No expiry"}
              </span>
            </div>
          </div>
          {shareNotice ? <span className="muted">{shareNotice}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
