"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

type MessageState = { type: "success" | "error"; text: string } | null;

export default function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage(null);

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage({ type: "error", text: body.error || "Unable to create account. Try again." });
      setPending(false);
      return;
    }

    setMessage({
      type: "success",
      text: "Account created! Check your inbox for a verification link.",
    });
    setPending(false);
  }

  return (
    <div className="section" style={{ display: "grid", placeItems: "center" }}>
      <div className="card" style={{ maxWidth: 420, width: "100%", display: "grid", gap: 18 }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Create your BlobPrep account</h1>
          <p style={{ margin: 0 }}>Free to start. Cancel anytime.</p>
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
            placeholder="Name"
            value={name}
            onChange={event => setName(event.target.value)}
            required
            style={{ padding: 12, border: "2px solid #FCEBD7", borderRadius: 12 }}
          />
          <input
            placeholder="Email"
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            required
            style={{ padding: 12, border: "2px solid #FCEBD7", borderRadius: 12 }}
          />
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            required
            minLength={8}
            style={{ padding: 12, border: "2px solid #FCEBD7", borderRadius: 12 }}
          />
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Creating account..." : "Sign Up Free"}
          </button>
        </form>

        <div style={{ display: "grid", gap: 6 }}>
          <button className="btn btn-outline" type="button" onClick={() => signIn("google")}>
            Continue with Google
          </button>
          <p style={{ fontSize: 14, margin: 0, textAlign: "center" }}>
            Already have an account? <Link href="/signin">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
