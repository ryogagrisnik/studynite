import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { buildAchievements, emptyAchievementMetrics, getAchievementMetrics } from "@/lib/studyhall/achievements";
import AchievementsGrid from "@/components/AchievementsGrid";

export const metadata: Metadata = {
  title: "Guild Achievements",
  description:
    "Track milestones you unlock while studying and hosting multiplayer quiz parties on RunePrep.",
  alternates: { canonical: "/achievements" },
  openGraph: {
    title: "Guild Achievements | RunePrep",
    description:
      "Track milestones you unlock while studying and hosting multiplayer quiz parties on RunePrep.",
    url: "/achievements",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Guild Achievements | RunePrep",
    description:
      "Track milestones you unlock while studying and hosting multiplayer quiz parties on RunePrep.",
  },
};

export default async function AchievementsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const isAuthed = Boolean(userId);
  const userEmail = (session?.user as any)?.email as string | undefined;
  const metrics = userId ? await getAchievementMetrics(userId) : emptyAchievementMetrics;
  const achievements = buildAchievements(metrics);

  return (
    <div className="page stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Guild achievements</h1>
          <p className="page-sub">
            Track every milestone you unlock while studying and hosting parties.
          </p>
        </div>
        <div className="row">
          <Link className="btn btn-outline" href="/how-it-works">
            Leaderboard
          </Link>
          {isAuthed ? (
            <Link className="btn btn-primary" href="/dashboard">
              View dashboard
            </Link>
          ) : (
            <Link className="btn btn-primary" href="/signup?callbackUrl=/achievements">
              Create free account
            </Link>
          )}
        </div>
      </div>

      <section className="card stack rpg-reveal">
        <AchievementsGrid
          achievements={achievements}
          userId={userId ?? null}
          userEmail={userEmail ?? null}
        />
        {!isAuthed ? (
          <p className="muted achievement-note">Sign in to track achievements across parties.</p>
        ) : null}
      </section>
    </div>
  );
}
