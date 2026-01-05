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
    <div className="page">
      <div className="card stack" style={{ maxWidth: 460, margin: "0 auto" }}>
        <div>
          <h1 className="page-title">Resend verification link</h1>
          <p className="page-sub">Enter the email you used for StudyNite and we’ll resend a link.</p>
        </div>
        {message ? (
          <div
            className="card"
            style={{
              borderColor: message.type === "success" ? "#86EFAC" : "#FCA5A5",
              color: message.type === "success" ? "#166534" : "#991B1B",
            }}
          >
            {message.text}
          </div>
        ) : null}
        <form onSubmit={handleSubmit} className="stack">
          <input
            className="input"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Sending..." : "Send link"}
          </button>
        </form>
        <p className="muted" style={{ textAlign: "center" }}>
          Already verified? <Link href="/signin">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
