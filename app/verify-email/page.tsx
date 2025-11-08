"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type State = "pending" | "success" | "error";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token");
  const [state, setState] = useState<State>("pending");
  const [message, setMessage] = useState("Verifying your email…");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("This verification link is missing a token.");
      return;
    }

    let mounted = true;
    (async () => {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await response.json().catch(() => ({}));

      if (!mounted) return;

      if (response.ok) {
        setState("success");
        setMessage("Email verified! You can sign in.");
        setTimeout(() => router.push("/signin?verified=1"), 1800);
      } else {
        setState("error");
        setMessage(body.error || "Verification link expired. Request a new one.");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router, token]);

  return (
    <div className="section" style={{ display: "grid", placeItems: "center" }}>
      <div className="card" style={{ maxWidth: 420, padding: 32, textAlign: "center" }}>
        <h1 style={{ marginBottom: 12 }}>Verify email</h1>
        <p style={{ fontSize: 16, margin: 0 }}>{message}</p>
        {state === "error" && (
          <div style={{ marginTop: 20, display: "grid", gap: 10 }}>
            <Link href="/signin" className="btn btn-outline">
              Back to sign in
            </Link>
            <Link href="/resend-verification" className="btn btn-primary">
              Resend verification
            </Link>
          </div>
        )}
        {state === "success" && (
          <p style={{ fontSize: 14, marginTop: 24 }}>Redirecting you to sign in…</p>
        )}
      </div>
    </div>
  );
}
