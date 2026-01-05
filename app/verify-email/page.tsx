"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type State = "pending" | "success" | "error";

function VerifyEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token");
  const [state, setState] = useState<State>("pending");
  const [message, setMessage] = useState("Verifying your email...");

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
    <div className="page">
      <div className="card stack" style={{ maxWidth: 460, margin: "0 auto", textAlign: "center" }}>
        <h1 className="page-title">Verify email</h1>
        <p className="page-sub">{message}</p>
        {state === "error" ? (
          <div className="stack" style={{ marginTop: 12 }}>
            <Link href="/signin" className="btn btn-outline">
              Back to sign in
            </Link>
            <Link href="/resend-verification" className="btn btn-primary">
              Resend verification
            </Link>
          </div>
        ) : null}
        {state === "success" ? (
          <p className="muted" style={{ marginTop: 12 }}>
            Redirecting you to sign in...
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="page">Loading...</div>}>
      <VerifyEmailClient />
    </Suspense>
  );
}
