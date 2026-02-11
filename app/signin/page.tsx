"use client";

import { FormEvent, useEffect, useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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

function SignInClient() {
  const searchParams = useSearchParams();
  const callbackUrl = normalizeCallbackUrl(searchParams?.get("callbackUrl") ?? null);
  const verified = searchParams?.get("verified");
  const errorParam = searchParams?.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);

  useEffect(() => {
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        OAuthAccountNotLinked:
          "This email is already linked to a different sign-in method. Try the original method or contact support.",
        OAuthSignin: "Google sign-in failed. Please try again.",
        OAuthCallback: "Google sign-in failed. Please try again.",
        OAuthCreateAccount: "We couldn't create your account from Google. Please try again.",
        Callback: "Sign-in failed. Please try again.",
        Configuration: "Sign-in is temporarily unavailable. Please try again later.",
        AccessDenied: "Sign-in was canceled or denied.",
        CredentialsSignin: "Invalid email or password.",
      };
      const friendly = errorMessages[errorParam];
      const suffix = friendly ? "" : ` (error: ${errorParam})`;
      setMessage({
        type: "error",
        text: `${friendly ?? "Sign-in failed. Please try again."}${suffix}`,
      });
      return;
    }
    if (verified) {
      setMessage({ type: "success", text: "Email verified! You can sign in now." });
    }
  }, [errorParam, verified]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage(null);

    await signIn("credentials", {
      email,
      password,
      callbackUrl,
    });
  }

  return (
    <div className="page">
      <div className="card stack" style={{ maxWidth: 460, margin: "0 auto" }}>
        <div>
          <h1 className="page-title">Welcome back to RunePrep</h1>
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

        <div className="row" style={{ justifyContent: "space-between", fontSize: 14 }}>
          <Link href="/forgot-password">Forgot password?</Link>
          <Link href="/signup">Create account</Link>
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
