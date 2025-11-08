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
    <div className="section" style={{ display: "grid", placeItems: "center" }}>
      <div className="card" style={{ maxWidth: 420, width: "100%", display: "grid", gap: 18 }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Welcome back to BlobPrep</h1>
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
            style={{ padding: 12, border: "2px solid #FCEBD7", borderRadius: 12 }}
          />
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div style={{ display: "grid", gap: 6 }}>
          <button className="btn btn-outline" type="button" onClick={() => signIn("google", { callbackUrl })}>
            Continue with Google
          </button>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
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
    <Suspense fallback={<div className="section">Loading…</div>}>
      <SignInClient />
    </Suspense>
  );
}
