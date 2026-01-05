import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasActiveProSession } from "@/lib/server/membership";
import { FREE_REGENERATE_LIMIT, PRO_REGENERATE_LIMIT } from "@/lib/studyhall/constants";
import DeckEditClient from "./DeckEditClient";

export default async function DeckEditPage({
  params,
  searchParams,
}: {
  params: { deckId: string };
  searchParams?: { editId?: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const editId = searchParams?.editId ?? null;
  const isPro = hasActiveProSession(session);

  const deck = await prisma.studyDeck.findUnique({
    where: { id: params.deckId },
    include: {
      questions: { orderBy: { order: "asc" } },
    },
  });

  const shareExpired = deck?.shareExpiresAt ? deck.shareExpiresAt.getTime() < Date.now() : false;
  const isOwner = Boolean(userId && deck?.userId === userId);
  const isEditShared = Boolean(editId && deck?.shareEditId === editId && !shareExpired);

  if (!deck || (!isOwner && !isEditShared)) {
    if (!userId) {
      return (
        <div className="page">
          <div className="card stack">
            <h1 className="page-title">Sign in to edit this quiz</h1>
            <Link className="btn btn-primary" href={`/signin?callbackUrl=/decks/${params.deckId}/edit`}>
              Sign in
            </Link>
          </div>
        </div>
      );
    }
    return (
      <div className="page">
        <div className="card stack">
          <h1 className="page-title">Quiz not found</h1>
          <Link className="btn btn-outline" href="/dashboard">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <DeckEditClient
      deck={{
        id: deck.id,
        title: deck.title,
        questions: deck.questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          choices: q.choices,
          correctIndex: q.correctIndex,
          explanation: q.explanation ?? "",
          order: q.order,
        })),
        regenerateCount: deck.regenerateCount ?? 0,
        regenerateLimit: isPro ? PRO_REGENERATE_LIMIT : FREE_REGENERATE_LIMIT,
      }}
      editId={isOwner ? null : editId}
    />
  );
}
