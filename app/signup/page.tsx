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

    await fetch("/api/events/studyhall", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "signup" }),
    });

    setMessage({
      type: "success",
      text: "Account created! Check your inbox for a verification link.",
    });
    setPending(false);
  }

  return (
    <div className="page">
      <div className="card stack" style={{ maxWidth: 460, margin: "0 auto" }}>
        <div>
          <h1 className="page-title">Create your StudyNite account</h1>
          <p className="page-sub">Only hosts need accounts. Joiners play with just a name.</p>
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
            placeholder="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <input
            className="input"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="input"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Creating account..." : "Create account"}
          </button>
        </form>

        <div className="stack">
          <button className="btn btn-outline" type="button" onClick={() => signIn("google")}>
            Continue with Google
          </button>
          <p className="muted" style={{ textAlign: "center" }}>
            Already have an account? <Link href="/signin">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
