"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import {
  DEFAULT_QUESTION_COUNT,
  FREE_MAX_QUESTION_COUNT,
  MAX_INPUT_CHARS,
  MAX_FILE_COUNT,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
  MAX_TOTAL_FILE_SIZE_BYTES,
  MAX_TOTAL_FILE_SIZE_MB,
  MIN_QUESTION_COUNT,
  PRO_MAX_QUESTION_COUNT,
} from "@/lib/studyhall/constants";

export default function CreateDeckPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const includeQuestions = true;
  const [questionCountInput, setQuestionCountInput] = useState(String(DEFAULT_QUESTION_COUNT));
  const [loading, setLoading] = useState(false);
  const [loadingMode, setLoadingMode] = useState<"deck" | "party" | "edit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [lastAction, setLastAction] = useState<"deck" | "party" | "edit" | null>(null);
  const [quota, setQuota] = useState<{
    dailyLimit: number;
    dailyUsed: number;
    dailyResetAt: number;
    cooldownMs: number;
  } | null>(null);
  const canStartParty = true;
  const userAny = session?.user as any;
  const isPro =
    Boolean(userAny?.isPro) ||
    (userAny?.proExpiresAt ? new Date(userAny.proExpiresAt).getTime() > Date.now() : false);
  const maxQuestionCount = isPro ? PRO_MAX_QUESTION_COUNT : FREE_MAX_QUESTION_COUNT;

  const parseCount = (value: string, fallback: number) => {
    if (!value.trim()) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const formatBytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  const validateFiles = (nextFiles: File[]) => {
    if (nextFiles.length > MAX_FILE_COUNT) {
      return `Upload up to ${MAX_FILE_COUNT} files.`;
    }
    const totalBytes = nextFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_TOTAL_FILE_SIZE_BYTES) {
      return `Total upload must be under ${MAX_TOTAL_FILE_SIZE_MB}MB.`;
    }
    for (const file of nextFiles) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return `${file.name || "File"} exceeds ${MAX_FILE_SIZE_MB}MB.`;
      }
    }
    return null;
  };

  const refreshQuota = async () => {
    try {
      const res = await fetch("/api/studyhall/decks/quota");
      const data = await res.json();
      if (res.ok && data.ok) {
        setQuota({
          dailyLimit: data.dailyLimit,
          dailyUsed: data.dailyUsed,
          dailyResetAt: data.dailyResetAt,
          cooldownMs: data.cooldownMs,
        });
      }
    } catch {
      // ignore quota failures
    }
  };

  useEffect(() => {
    if (session?.user) {
      void refreshQuota();
    }
  }, [session?.user]);

  if (status === "loading") {
    return (
      <div className="page">
        <div className="card">Checking your account...</div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="page">
        <div className="card stack">
          <h1 className="page-title">Create a RunePrep quiz</h1>
          <p className="page-sub">
            Create an account to generate quizzes and host RunePrep parties.
          </p>
          <div className="row">
            <Link className="btn btn-primary" href="/signup?callbackUrl=/decks/new">
              Create free account
            </Link>
            <Link className="btn btn-outline" href="/signin?callbackUrl=/decks/new">
              Sign in
            </Link>
            <Link className="btn btn-outline" href="/party/join">
              Join a quiz party
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const uploadDeck = (formData: FormData) =>
    new Promise<{ deckId: string; shareId: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/studyhall/decks");
      xhr.responseType = "json";
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const next = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(next);
      };
      xhr.onload = () => {
        const data = (xhr.response || {}) as any;
        if (xhr.status >= 200 && xhr.status < 300 && data.ok) {
          resolve(data);
          return;
        }
        reject(new Error(data.error || "Unable to create quiz."));
      };
      xhr.onerror = () => reject(new Error("Upload failed."));
      xhr.send(formData);
    });

  const submitDeck = async (action: "deck" | "party" | "edit") => {
    setError(null);
    setLastAction(action);

    if (action === "party" && !canStartParty) {
      setError("Quiz parties require quiz questions.");
      return;
    }

    if (!text.trim() && files.length === 0) {
      setError("Add text or upload a PDF/image to continue.");
      return;
    }

    if (text.trim().length > MAX_INPUT_CHARS) {
      setError(`Text exceeds ${MAX_INPUT_CHARS} characters. Trim and retry.`);
      return;
    }
    if (quota?.cooldownMs && quota.cooldownMs > 0) {
      setError("Please wait for the cooldown before generating another quiz.");
      return;
    }
    const fileValidation = validateFiles(files);
    if (fileValidation) {
      setError(fileValidation);
      return;
    }

    const questionCount = parseCount(questionCountInput, DEFAULT_QUESTION_COUNT);

    if (includeQuestions && (questionCount < MIN_QUESTION_COUNT || questionCount > maxQuestionCount)) {
      setError(`Question count must be ${MIN_QUESTION_COUNT}-${maxQuestionCount}.`);
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("text", text);
    formData.append("includeQuestions", "true");
    formData.append("includeFlashcards", "false");
    formData.append("questionCount", String(questionCount));
    files.forEach((file) => formData.append("files", file));

    setLoading(true);
    setLoadingMode(action);
    setUploadProgress(0);
    try {
      const data = await uploadDeck(formData);
      await refreshQuota();
      await fetch("/api/events/studyhall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "deck_created", deckId: data.deckId }),
      });
      if (action === "party") {
        const partyResponse = await fetch("/api/studyhall/parties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deckId: data.deckId, mode: "QUIZ" }),
        });
        const partyData = await partyResponse.json();
        if (!partyResponse.ok || !partyData.ok) {
          throw new Error(partyData.error || "Unable to start party.");
        }
        await fetch("/api/events/studyhall", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "party_created", deckId: data.deckId, partyId: partyData.partyId }),
        });
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            `studyhall:party:${partyData.partyId}`,
            JSON.stringify({ playerToken: partyData.playerToken, playerId: partyData.playerId })
          );
          window.localStorage.setItem("studyhall:lastPartyId", partyData.partyId);
        }
        router.push(`/party/${partyData.partyId}`);
      } else if (action === "edit") {
        router.push(`/decks/${data.deckId}/edit?quick=1`);
      } else {
        router.push(`/decks/${data.deckId}`);
      }
    } catch (err: any) {
      setError(err?.message || "Unable to create quiz.");
      setLoading(false);
      setLoadingMode(null);
      setUploadProgress(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitDeck("deck");
  };

  return (
    <div className="page stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Create a RunePrep quiz</h1>
          <p className="page-sub">
            Paste text or upload PDFs/images. Choose exactly how many items to generate.
          </p>
        </div>
      </div>

      <form className="card stack" onSubmit={handleSubmit}>
        <div className="field">
          <label className="field-label" htmlFor="title">
            Quiz title (optional)
          </label>
          <input
            id="title"
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Bio 101 midterm review"
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="questionCount">Question count</label>
          <input
            id="questionCount"
            type="number"
            className="input"
            min={MIN_QUESTION_COUNT}
            max={maxQuestionCount}
            value={questionCountInput}
            onChange={(event) => {
              setQuestionCountInput(event.target.value);
            }}
          />
          <div className="field-help">
            {MIN_QUESTION_COUNT}-{maxQuestionCount} questions
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="files">
            Upload PDFs or images
          </label>
          <input
            id="files"
            type="file"
            className="input"
            accept="application/pdf,image/*"
            multiple
            onChange={(event) => {
              const nextFiles = Array.from(event.target.files || []);
              const validation = validateFiles(nextFiles);
              if (validation) {
                setError(validation);
                return;
              }
              setError(null);
              setFiles(nextFiles);
            }}
          />
          <div className="field-help">
            OCR is currently unavailable. Use text-based PDFs or paste text. Max {MAX_FILE_COUNT}{" "}
            files, {MAX_FILE_SIZE_MB}MB each.
          </div>
          {files.length > 0 ? (
            <div className="stack" style={{ gap: 8 }}>
              {files.map((file, index) => (
                <div key={`${file.name}-${index}`} className="row" style={{ justifyContent: "space-between" }}>
                  <span className="muted">
                    {file.name || "Untitled file"} · {formatBytes(file.size)}
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline btn-small"
                    onClick={() => {
                      const nextFiles = files.filter((_, fileIndex) => fileIndex !== index);
                      setFiles(nextFiles);
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <span className="muted">
                Total {formatBytes(files.reduce((sum, file) => sum + file.size, 0))} /
                {MAX_TOTAL_FILE_SIZE_MB}MB
              </span>
            </div>
          ) : null}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="text">
            Paste text
          </label>
          <textarea
            id="text"
            className="textarea"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste lecture notes, summaries, or study guides here..."
          />
        <div className="field-help">
          {text.trim().length}/{MAX_INPUT_CHARS} characters
        </div>
      </div>

      {quota ? (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>Daily quiz limit</strong>
            <span className="muted">
              {Math.max(0, quota.dailyLimit - quota.dailyUsed)} of {quota.dailyLimit} remaining
            </span>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">Resets</span>
            <span className="muted">{new Date(quota.dailyResetAt).toLocaleString()}</span>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">Cooldown</span>
            <span className="muted">
              {quota.cooldownMs > 0
                ? `${Math.ceil(quota.cooldownMs / 1000)}s remaining`
                : "Ready"}
            </span>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="card stack" style={{ borderColor: "#FCA5A5" }}>
            <div>{error}</div>
            {lastAction ? (
              <button
                className="btn btn-outline btn-small"
                type="button"
                onClick={() => submitDeck(lastAction)}
                disabled={loading}
              >
                Retry
              </button>
            ) : null}
          </div>
        ) : null}
        {uploadProgress !== null ? (
          <div className="stack" style={{ gap: 8 }}>
            <div className="progress">
              <span style={{ width: `${uploadProgress}%` }} />
            </div>
            <span className="muted">
              {uploadProgress < 100 ? `Uploading ${uploadProgress}%` : "Processing content..."}
            </span>
          </div>
        ) : null}

        <div className="row">
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading && loadingMode === "deck" ? "Generating..." : "Generate quiz"}
          </button>
          <button
            className="btn btn-outline"
            type="button"
            disabled={loading}
            onClick={() => submitDeck("edit")}
          >
            {loading && loadingMode === "edit" ? "Preparing..." : "Generate & edit"}
          </button>
          <button
            className="btn btn-outline"
            type="button"
            disabled={loading || !canStartParty}
            onClick={() => submitDeck("party")}
          >
            {loading && loadingMode === "party" ? "Starting..." : "Generate & start quiz party"}
          </button>
          <span className="muted">
            {canStartParty
              ? "Source files are processed and discarded."
              : "Quiz parties require quiz questions."}
          </span>
        </div>
      </form>
    </div>
  );
}
