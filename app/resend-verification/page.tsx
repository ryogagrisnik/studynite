"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type MessageState = { type: "success" | "error"; text: string } | null;

export default function ResendVerificationPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage(null);

    const response = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (response.ok) {
      setMessage({
        type: "success",
        text: "If we found an account for that email, a new verification message is on the way.",
      });
    } else {
      setMessage({ type: "error", text: "We couldn’t process that request. Try again." });
    }

    setPending(false);
  }

  return (
    <div className="section" style={{ display: "grid", placeItems: "center" }}>
      <div className="card" style={{ maxWidth: 420, width: "100%", display: "grid", gap: 18 }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Resend verification link</h1>
          <p style={{ margin: 0 }}>Enter the email you used for BlobPrep and we’ll resend a link.</p>
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
            placeholder="Email"
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            required
            style={{ padding: 12, border: "2px solid #FCEBD7", borderRadius: 12 }}
          />
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Sending..." : "Send link"}
          </button>
        </form>
        <p style={{ fontSize: 14, margin: 0, textAlign: "center" }}>
          Already verified? <Link href="/signin">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
