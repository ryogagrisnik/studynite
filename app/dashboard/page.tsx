import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import DashboardClient from "./DashboardClient";

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  if (!userId) {
    return (
      <div className="page">
        <div className="card stack">
          <h1 className="page-title">Your RunePrep quizzes</h1>
          <p className="page-sub">
            Sign in to save quizzes, track accuracy, and host multiplayer parties.
          </p>
          <div className="row">
            <Link className="btn btn-primary" href="/signup?callbackUrl=/dashboard">
              Create free account
            </Link>
            <Link className="btn btn-outline" href="/signin?callbackUrl=/dashboard">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const [decks, user] = await Promise.all([
    prisma.studyDeck.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { questions: true },
        },
      },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { avatarId: true } }),
  ]);

  const userAny = session?.user as any;
  const isPro =
    Boolean(userAny?.isPro) ||
    (userAny?.proExpiresAt ? new Date(userAny.proExpiresAt).getTime() > Date.now() : false);
  const proExpiresAt = userAny?.proExpiresAt ? new Date(userAny.proExpiresAt).toISOString() : null;

  return (
    <DashboardClient
      decks={decks.map((deck) => ({
        id: deck.id,
        title: deck.title,
        description: deck.description,
        shareId: deck.shareId,
        updatedAt: deck.updatedAt.toISOString(),
        questionCount: deck._count.questions,
      }))}
      userName={userAny?.name ?? null}
      userAvatarId={user?.avatarId ?? null}
      isPro={isPro}
      proExpiresAt={proExpiresAt}
      userEmail={userAny?.email ?? null}
      userId={userId}
    />
  );
}
