import { redirect } from "next/navigation";

import prisma from "@/lib/prisma";

export default async function ShareDeckPage({ params }: { params: { shareId: string } }) {
  const shareId = params.shareId;
  const deck = await prisma.studyDeck.findUnique({
    where: { shareId },
    select: { id: true, shareExpiresAt: true },
  });

  const shareExpired = deck?.shareExpiresAt ? deck.shareExpiresAt.getTime() < Date.now() : false;

  if (!deck || shareExpired) {
    return (
      <div className="page">
        <div className="card stack">
          <h1 className="page-title">Quiz not accessible</h1>
          <p className="page-sub">Ask the host for a fresh link or code.</p>
        </div>
      </div>
    );
  }

  redirect(`/decks/${deck.id}?shareId=${shareId}`);
}
