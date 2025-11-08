"use client";

import { FormEvent, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type MessageState = { type: "success" | "error"; text: string } | null;

function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);
  const [tokenMissing, setTokenMissing] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenMissing(true);
      setMessage({ type: "error", text: "This reset link is missing or already used." });
    }
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !token) return;
    if (password !== confirm) {
      setMessage({ type: "error", text: "Passwords do not match." });
      return;
    }
    setPending(true);
    setMessage(null);

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const body = await response.json().catch(() => ({}));

    if (response.ok) {
      setMessage({ type: "success", text: "Password updated! Redirecting you to sign in…" });
      setTimeout(() => router.push("/signin"), 1800);
    } else {
      setMessage({ type: "error", text: body.error || "This reset link expired. Request a new one." });
    }

    setPending(false);
  }

  return (
    <div className="section" style={{ display: "grid", placeItems: "center" }}>
      <div className="card" style={{ maxWidth: 420, width: "100%", display: "grid", gap: 18 }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Choose a new password</h1>
          <p style={{ margin: 0 }}>Keep it at least 8 characters for security.</p>
        </div>
        {message && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: message.type === "success" ? "#ECFDF3" : "#FEF2F2",
              color: message.type === "success" ? "#027A48" : "#B42318",
              fontSize: 14,
            }}
          >
            {message.text}
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <input
            placeholder="New password"
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            required
            minLength={8}
            disabled={tokenMissing}
            style={{ padding: 12, border: "2px solid #FCEBD7", borderRadius: 12 }}
          />
          <input
            placeholder="Confirm new password"
            type="password"
            value={confirm}
            onChange={event => setConfirm(event.target.value)}
            required
            minLength={8}
            disabled={tokenMissing}
            style={{ padding: 12, border: "2px solid #FCEBD7", borderRadius: 12 }}
          />
          <button className="btn btn-primary" type="submit" disabled={pending || tokenMissing}>
            {pending ? "Updating..." : "Update password"}
          </button>
        </form>
        <p style={{ fontSize: 14, margin: 0, textAlign: "center" }}>
          Need a new link? <Link href="/forgot-password">Request reset</Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="section">Loading…</div>}>
      <ResetPasswordClient />
    </Suspense>
  );
}
