"use client";

import { useEffect, useState, type ChangeEvent, type DragEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import {
  MAX_FILE_COUNT,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
  MAX_TOTAL_FILE_SIZE_BYTES,
  MAX_TOTAL_FILE_SIZE_MB,
} from "@/lib/studyhall/constants";

const TARGET_QUESTION_COUNT = 20;
const TARGET_DIFFICULTY = "hard" as const;

export default function PrizePromoModal() {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  useEffect(() => {
    if (!pathname || pathname !== "/") return;
    if (typeof window === "undefined") return;
    setOpen(true);
  }, [pathname]);

  if (!open) return null;

  const dismiss = () => {
    setOpen(false);
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

  const mergeFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    const nextFiles = [...files, ...incoming];
    const validation = validateFiles(nextFiles);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setFiles(nextFiles);
  };

  const handlePicker = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files || []);
    mergeFiles(picked);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    const dropped = Array.from(event.dataTransfer.files || []);
    mergeFiles(dropped);
  };

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

  const startForge = async () => {
    setError(null);
    if (status === "loading") return;
    if (status !== "authenticated") {
      router.push("/signup?callbackUrl=/decks/new");
      return;
    }
    if (files.length === 0) {
      setError("Drop your notes to continue.");
      return;
    }

    const formData = new FormData();
    formData.append("title", "");
    formData.append("text", "");
    formData.append("includeQuestions", "true");
    formData.append("includeFlashcards", "false");
    formData.append("questionCount", String(TARGET_QUESTION_COUNT));
    formData.append("difficulty", TARGET_DIFFICULTY);
    files.forEach((file) => formData.append("files", file));

    setLoading(true);
    setUploadProgress(0);
    try {
      const data = await uploadDeck(formData);
      const partyResponse = await fetch("/api/studyhall/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId: data.deckId, mode: "QUIZ" }),
      });
      const partyData = await partyResponse.json();
      if (!partyResponse.ok || !partyData.ok) {
        throw new Error(partyData.error || "Unable to start party.");
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          `studyhall:party:${partyData.partyId}`,
          JSON.stringify({ playerToken: partyData.playerToken, playerId: partyData.playerId })
        );
        window.localStorage.setItem("studyhall:lastPartyId", partyData.partyId);
      }
      router.push(`/party/${partyData.partyId}`);
    } catch (err: any) {
      setError(err?.message || "Unable to create quiz.");
      setLoading(false);
      setUploadProgress(null);
    }
  };

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="modal-backdrop" data-nosnippet role="dialog" aria-modal="true">
      <div className="modal-card forge-modal">
        <div className="forge-grid">
          <div className="stack" style={{ gap: 18 }}>
            <div className="forge-header">
              <span className="forge-kicker">Forge Quiz</span>
              <h2 className="forge-title">Make one now.</h2>
              <p className="forge-sub">
                Drop your notes and we will forge a {TARGET_QUESTION_COUNT}-question quiz at the
                hardest difficulty, then launch a live party link instantly.
              </p>
            </div>
            <div className="forge-badges">
              <span className="badge">{TARGET_QUESTION_COUNT} questions</span>
              <span className="badge badge-soft">Hardest difficulty</span>
              <span className="badge badge-soft">Auto-starts a quiz party</span>
            </div>
            <div className="forge-actions">
              <button className="btn btn-primary" type="button" onClick={startForge} disabled={loading}>
                {loading ? "Forging..." : "Make one now"}
              </button>
              <button className="btn btn-outline" type="button" onClick={dismiss} disabled={loading}>
                Maybe later
              </button>
              {status !== "authenticated" ? (
                <span className="muted" style={{ fontSize: 13 }}>
                  Sign in to upload and start a party.
                </span>
              ) : null}
            </div>
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
            {error ? (
              <div className="card card--error" role="alert">
                {error}
              </div>
            ) : null}
          </div>
          <div className="stack" style={{ gap: 16 }}>
            <div
              className={`forge-drop${dragActive ? " is-dragging" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setDragActive(false);
              }}
              onDrop={handleDrop}
            >
              <input
                id="forge-files"
                className="forge-file-input"
                type="file"
                accept="application/pdf,image/*"
                multiple
                onChange={handlePicker}
              />
              <label className="forge-drop-inner" htmlFor="forge-files">
                <span className="forge-drop-title">Drop your notes here</span>
                <span className="forge-drop-hint">PDFs or images. Up to {MAX_FILE_COUNT} files.</span>
                <span className="forge-drop-action">Or click to upload</span>
              </label>
            </div>

            {files.length > 0 ? (
              <div className="forge-file-list">
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="forge-file-row">
                    <span className="muted">{file.name || "Untitled file"} · {formatBytes(file.size)}</span>
                    <button
                      className="btn btn-outline btn-small"
                      type="button"
                      onClick={() => setFiles(files.filter((_, idx) => idx !== index))}
                      disabled={loading}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <span className="muted">Total {formatBytes(totalBytes)} / {MAX_TOTAL_FILE_SIZE_MB}MB</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
