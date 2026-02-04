import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasActiveProSession } from "@/lib/server/membership";
import { FREE_REGENERATE_LIMIT, PRO_REGENERATE_LIMIT } from "@/lib/studyhall/constants";
import DeckViewClient from "./DeckViewClient";

export default async function DeckPage({
  params,
  searchParams,
}: {
  params: { deckId: string };
  searchParams?: { shareId?: string; editId?: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const shareId = searchParams?.shareId ?? null;
  const editId = searchParams?.editId ?? null;
  const isPro = hasActiveProSession(session);

  const deck = await prisma.studyDeck.findUnique({
    where: { id: params.deckId },
    include: {
      questions: { orderBy: { order: "asc" } },
    },
  });

  const isOwner = Boolean(userId && deck?.userId === userId);
  const shareExpired = deck?.shareExpiresAt ? deck.shareExpiresAt.getTime() < Date.now() : false;
  const isShared = Boolean(shareId && deck?.shareId === shareId && !shareExpired);
  const isEditShared = Boolean(editId && deck?.shareEditId === editId && !shareExpired);
  const userAvatar = isOwner
    ? await prisma.user.findUnique({ where: { id: userId! }, select: { avatarId: true } })
    : null;
  if (!deck || (!isOwner && !isShared && !isEditShared)) {
    return (
      <div className="page">
        <div className="card stack">
          <h1 className="page-title">Quiz not accessible</h1>
          <p className="page-sub">Sign in or request a valid share link.</p>
          <div className="row">
            <Link className="btn btn-primary" href={`/signin?callbackUrl=/decks/${params.deckId}`}>
              Sign in
            </Link>
            <Link className="btn btn-outline" href="/">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DeckViewClient
      deck={{
        id: deck.id,
        title: deck.title,
        shareId: deck.shareId,
        shareExpiresAt: isOwner && deck.shareExpiresAt ? deck.shareExpiresAt.toISOString() : null,
        questions: deck.questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          choices: q.choices,
          correctIndex: q.correctIndex,
          explanation: q.explanation ?? null,
        })),
        flashcards: [],
        regenerateCount: deck.regenerateCount ?? 0,
        regenerateLimit: isOwner ? (isPro ? PRO_REGENERATE_LIMIT : FREE_REGENERATE_LIMIT) : 0,
      }}
      userName={(session?.user as any)?.name ?? null}
      isPro={isPro}
      isOwner={isOwner}
      userAvatarId={userAvatar?.avatarId ?? null}
      userEmail={(session?.user as any)?.email ?? null}
      userId={userId}
    />
  );
}
