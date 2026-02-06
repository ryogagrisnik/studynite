import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { toSafeTitle } from "@/lib/studyhall/utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { deckId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  const { searchParams } = new URL(req.url);
  const shareId = searchParams.get("shareId");
  const editId = searchParams.get("editId");

  const deck = await prisma.studyDeck.findUnique({
    where: { id: params.deckId },
    include: {
      questions: { orderBy: { order: "asc" } },
      flashcards: { orderBy: { order: "asc" } },
    },
  });

  if (!deck) {
    return NextResponse.json({ ok: false, error: "Quiz not found" }, { status: 404 });
  }

  const isOwner = userId && deck.userId === userId;
  const shareExpired = deck.shareExpiresAt ? deck.shareExpiresAt.getTime() < Date.now() : false;
  const isShared = Boolean(shareId && shareId === deck.shareId && !shareExpired);
  const isEditShared = Boolean(editId && editId === deck.shareEditId && !shareExpired);

  if (!isOwner && !isShared && !isEditShared) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    deck: {
      id: deck.id,
      title: deck.title,
      description: deck.description,
      shareId: deck.shareId,
      shareEditId: isOwner ? deck.shareEditId : null,
      shareExpiresAt: isOwner && deck.shareExpiresAt ? deck.shareExpiresAt.toISOString() : null,
      questions: deck.questions,
      flashcards: deck.flashcards,
    },
  });
}

export async function PATCH(req: Request, { params }: { params: { deckId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const deck = await prisma.studyDeck.findUnique({
    where: { id: params.deckId },
    select: { userId: true, shareEditId: true, shareExpiresAt: true },
  });

  if (!deck) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  const editId = typeof payload.editId === "string" ? payload.editId : null;
  const shareExpired = deck.shareExpiresAt ? deck.shareExpiresAt.getTime() < Date.now() : false;
  const canEdit =
    (userId && deck.userId === userId) ||
    Boolean(editId && deck.shareEditId && editId === deck.shareEditId && !shareExpired);

  if (!canEdit) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  const updates: Prisma.PrismaPromise<unknown>[] = [];

  if (payload.title !== undefined) {
    updates.push(
      prisma.studyDeck.update({
        where: { id: params.deckId },
        data: { title: toSafeTitle(payload.title) },
      })
    );
  }

  const hasQuestions = Array.isArray(payload.questions);
  const hasFlashcards = Array.isArray(payload.flashcards);
  const deletedQuestionIds = Array.isArray(payload.deletedQuestionIds)
    ? payload.deletedQuestionIds.map(String)
    : [];
  const deletedFlashcardIds = Array.isArray(payload.deletedFlashcardIds)
    ? payload.deletedFlashcardIds.map(String)
    : [];

  if (hasQuestions) {
    for (const question of payload.questions) {
      if (!question?.id) continue;
      const data: Record<string, any> = {
        prompt: String(question.prompt ?? ""),
        choices: Array.isArray(question.choices) ? question.choices.map(String).slice(0, 4) : [],
        correctIndex: Number.isFinite(question.correctIndex)
          ? Math.max(0, Math.min(3, question.correctIndex))
          : 0,
        explanation: question.explanation ? String(question.explanation) : null,
      };
      if (Number.isFinite(question.order)) {
        data.order = Math.max(1, Number(question.order));
      }
      updates.push(
        prisma.studyQuestion.updateMany({
          where: { id: question.id, deckId: params.deckId },
          data,
        })
      );
    }
  }

  if (hasFlashcards) {
    for (const card of payload.flashcards) {
      if (!card?.id) continue;
      const data: Record<string, any> = {
        front: String(card.front ?? ""),
        back: String(card.back ?? ""),
      };
      if (Number.isFinite(card.order)) {
        data.order = Math.max(1, Number(card.order));
      }
      updates.push(
        prisma.studyFlashcard.updateMany({
          where: { id: card.id, deckId: params.deckId },
          data,
        })
      );
    }
  }

  if (deletedQuestionIds.length) {
    updates.push(
      prisma.studyQuestion.deleteMany({
        where: { deckId: params.deckId, id: { in: deletedQuestionIds } },
      })
    );
  }

  if (deletedFlashcardIds.length) {
    updates.push(
      prisma.studyFlashcard.deleteMany({
        where: { deckId: params.deckId, id: { in: deletedFlashcardIds } },
      })
    );
  }

  if (hasQuestions || hasFlashcards || deletedQuestionIds.length || deletedFlashcardIds.length) {
    updates.push(
      prisma.studyDeck.update({
        where: { id: params.deckId },
        data: { updatedAt: new Date() },
      })
    );
  }

  if (!updates.length) {
    return NextResponse.json({ ok: true });
  }

  await prisma.$transaction(updates);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { deckId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const deck = await prisma.studyDeck.findUnique({
    where: { id: params.deckId },
    select: { userId: true },
  });

  if (!deck || deck.userId !== userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  await prisma.studyDeck.delete({ where: { id: params.deckId } });

  return NextResponse.json({ ok: true });
}
