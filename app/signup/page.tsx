"use client";

import { FormEvent, useEffect, useState, Suspense } from "react";
import { signIn, getProviders, type ClientSafeProvider } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type MessageState = { type: "success" | "error"; text: string } | null;

function normalizeCallbackUrl(value: string | null) {
  if (!value) return "/dashboard";
  if (value.startsWith("/")) return value;
  try {
    const parsed = new URL(value);
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return path.startsWith("/") ? path : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

function SignUpClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = normalizeCallbackUrl(searchParams?.get("callbackUrl") ?? null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);
  const [providers, setProviders] = useState<Record<string, ClientSafeProvider> | null>(null);

  useEffect(() => {
    void getProviders().then((data) => setProviders(data ?? null));
  }, []);

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

    const login = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
      callbackUrl,
    });

    if (login?.error) {
      setMessage({
        type: "success",
        text: "Account created! Sign in with your email and password.",
      });
      setPending(false);
      return;
    }

    router.push(login?.url || "/dashboard");
  }

  return (
    <div className="page">
      <div className="card stack" style={{ maxWidth: 460, margin: "0 auto" }}>
        <div>
          <h1 className="page-title">Create your RunePrep account</h1>
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

        {providers?.google ? (
          <div className="stack" style={{ gap: 10 }}>
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => signIn("google", { callbackUrl })}
            >
              Continue with Google
            </button>
            <div className="muted" style={{ fontSize: 12, textAlign: "center" }}>
              or create an account with email
            </div>
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

        <p className="muted" style={{ textAlign: "center" }}>
          Already have an account? <Link href="/signin">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default function SignUp() {
  return (
    <Suspense fallback={<div className="page">Loading...</div>}>
      <SignUpClient />
    </Suspense>
  );
}
