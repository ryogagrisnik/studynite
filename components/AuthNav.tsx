"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function AuthNav() {
  const { data: session, status } = useSession();

  if (status === "loading") return <button className="btn btn-primary" disabled>…</button>;

  if (session?.user) {
    return (
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 12, opacity: 0.8 }}>{(session.user as any).email}</span>
        <button className="btn btn-primary" onClick={() => signOut()}>
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <Link href="/signin" className="btn btn-primary">
      Sign In
    </Link>
  );
}
