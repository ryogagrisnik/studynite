"use client";

import { FormEvent, useEffect, useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type MessageState = { type: "success" | "error"; text: string } | null;

function SignInClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") || "/dashboard";
  const verified = searchParams?.get("verified");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);

  useEffect(() => {
    if (verified) {
      setMessage({ type: "success", text: "Email verified! You can sign in now." });
    }
  }, [verified]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage(null);

    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl,
    });

    if (!result || result.error) {
      setMessage({
        type: "error",
        text: result?.error === "Email not verified" ? "Verify your email to continue." : "Invalid credentials.",
      });
      setPending(false);
      return;
    }

    router.push(result.url ?? callbackUrl);
  }

  return (
    <div className="page">
      <div className="card stack" style={{ maxWidth: 460, margin: "0 auto" }}>
        <div>
          <h1 className="page-title">Welcome back to StudyNite</h1>
          <p className="page-sub">Sign in to host quizzes and parties.</p>
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
          <input
            className="input"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="stack">
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => signIn("google", { callbackUrl })}
          >
            Continue with Google
          </button>
          <div className="row" style={{ justifyContent: "space-between", fontSize: 14 }}>
            <Link href="/forgot-password">Forgot password?</Link>
            <Link href="/signup">Create account</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignIn() {
  return (
    <Suspense fallback={<div className="page">Loading...</div>}>
      <SignInClient />
    </Suspense>
  );
}
