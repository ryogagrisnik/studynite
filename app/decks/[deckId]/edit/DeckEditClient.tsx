"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type EditableQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  order: number;
};

type DeckEditProps = {
  deck: {
    id: string;
    title: string;
    questions: EditableQuestion[];
    regenerateCount: number;
    regenerateLimit: number;
  };
  editId?: string | null;
};

export default function DeckEditClient({ deck, editId }: DeckEditProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quickEdit = searchParams.get("quick") === "1";
  const [title, setTitle] = useState(deck.title);
  const [questions, setQuestions] = useState(deck.questions);
  const [deletedQuestionIds, setDeletedQuestionIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [partyError, setPartyError] = useState<string | null>(null);
  const [startingParty, setStartingParty] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [regenerateCount, setRegenerateCount] = useState(deck.regenerateCount);
  const canHostParty = !editId;
  const remainingRegens = Math.max(0, deck.regenerateLimit - regenerateCount);
  const partyHelp = [
    questions.length === 0 ? "Add quiz questions to enable quiz parties." : null,
    !canHostParty ? "Sign in as the quiz owner to host parties." : null,
  ]
    .filter(Boolean)
    .join(" ");

  const updateQuestion = (index: number, patch: Partial<EditableQuestion>) => {
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === index ? { ...q, ...patch } : q))
    );
  };

  const updateChoice = (index: number, choiceIndex: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== index) return q;
        const choices = [...q.choices];
        choices[choiceIndex] = value;
        return { ...q, choices };
      })
    );
  };

  const moveItem = <T,>(items: T[], from: number, to: number) => {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    setQuestions((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = moveItem(prev, index, target);
      return next.map((question, idx) => ({ ...question, order: idx + 1 }));
    });
  };


  const deleteQuestion = (index: number) => {
    setQuestions((prev) => {
      const target = prev[index];
      if (!target) return prev;
      setDeletedQuestionIds((ids) => [...ids, target.id]);
      const next = prev.filter((_, idx) => idx !== index);
      return next.map((question, idx) => ({ ...question, order: idx + 1 }));
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const questionPayload = questions.map((question, index) => ({
        ...question,
        order: index + 1,
      }));
      const response = await fetch(`/api/studyhall/decks/${deck.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          questions: questionPayload,
          deletedQuestionIds,
          ...(editId ? { editId } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to save changes.");
      }
      setDeletedQuestionIds([]);
      setMessage("Changes saved.");
    } catch (err: any) {
      setMessage(err?.message || "Unable to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleStartParty = async () => {
    setPartyError(null);
    setStartingParty(true);
    try {
      const response = await fetch("/api/studyhall/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId: deck.id, mode: "QUIZ" }),
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
      setPartyError(err?.message || "Unable to start party.");
    } finally {
      setStartingParty(false);
    }
  };

  const handleRegenerate = async () => {
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
      setQuestions(data.questions || []);
      setDeletedQuestionIds([]);
      setRegenerateCount(data.regenerateCount ?? regenerateCount + 1);
      setMessage("Quiz regenerated.");
    } catch (err: any) {
      setRegenerateError(err?.message || "Unable to regenerate quiz.");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="page stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Edit quiz</h1>
          <p className="page-sub">Update questions and answers.</p>
        </div>
        <div className="row">
          <Link className="btn btn-outline" href={`/decks/${deck.id}`}>
            Back to quiz
          </Link>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>

      {quickEdit ? (
        <div className="card card--plain">
          Quick edit: tweak anything below, save, and launch a party when you’re ready.
        </div>
      ) : null}
      {editId ? (
        <div className="card card--plain">
          You are editing with a shared editor link. Changes save directly to this quiz.
        </div>
      ) : null}

      {message ? <div className="card">{message}</div> : null}
      {partyError ? <div className="card" style={{ borderColor: "#FCA5A5" }}>{partyError}</div> : null}
      {regenerateError ? <div className="card" style={{ borderColor: "#FCA5A5" }}>{regenerateError}</div> : null}

      <div className="card stack">
        <h2 className="card-title">Start a quiz party</h2>
        <div className="row">
          <button
            className="btn btn-primary"
            onClick={handleStartParty}
            disabled={startingParty || questions.length === 0 || !canHostParty}
          >
            {startingParty ? "Starting..." : "Start quiz party"}
          </button>
        </div>
        {partyHelp ? <div className="field-help">{partyHelp}</div> : null}
      </div>

      <div className="card stack">
        <h2 className="card-title">Regenerate quiz</h2>
        <p className="muted">
          Create a fresh set of questions from the original source. {remainingRegens} regeneration
          {remainingRegens === 1 ? "" : "s"} remaining.
        </p>
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

      <div className="card stack">
        <div className="field">
          <label className="field-label">Deck title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="muted">{questions.length} questions</span>
          <span className="muted">Reorder or delete items before sharing.</span>
        </div>
      </div>

      <div className="stack">
        <h2 className="card-title">Quiz questions</h2>
        {questions.map((question, index) => (
          <div key={question.id} className="card stack">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>Question {index + 1}</strong>
              <div className="row">
                <button
                  className="btn btn-outline btn-small"
                  type="button"
                  onClick={() => moveQuestion(index, -1)}
                  disabled={index === 0}
                >
                  Move up
                </button>
                <button
                  className="btn btn-outline btn-small"
                  type="button"
                  onClick={() => moveQuestion(index, 1)}
                  disabled={index === questions.length - 1}
                >
                  Move down
                </button>
                <button
                  className="btn btn-outline btn-small"
                  type="button"
                  onClick={() => deleteQuestion(index)}
                >
                  Delete
                </button>
              </div>
            </div>
            <div className="field">
              <label className="field-label">Prompt</label>
              <textarea
                className="textarea"
                value={question.prompt}
                onChange={(event) => updateQuestion(index, { prompt: event.target.value })}
              />
            </div>
            <div className="grid-2">
              {question.choices.map((choice, choiceIndex) => (
                <div key={`${question.id}-${choiceIndex}`} className="field">
                  <label className="field-label">Choice {String.fromCharCode(65 + choiceIndex)}</label>
                  <input
                    className="input"
                    value={choice}
                    onChange={(event) => updateChoice(index, choiceIndex, event.target.value)}
                  />
                </div>
              ))}
            </div>
            <div className="field">
              <label className="field-label">Correct answer</label>
              <select
                className="select"
                value={question.correctIndex}
                onChange={(event) =>
                  updateQuestion(index, { correctIndex: Number(event.target.value) })
                }
              >
                {question.choices.map((choice, choiceIndex) => (
                  <option key={`${question.id}-correct-${choiceIndex}`} value={choiceIndex}>
                    {String.fromCharCode(65 + choiceIndex)} - {choice.slice(0, 48)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label">Explanation (optional)</label>
              <textarea
                className="textarea"
                value={question.explanation}
                onChange={(event) => updateQuestion(index, { explanation: event.target.value })}
              />
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
