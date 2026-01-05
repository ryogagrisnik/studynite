import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateShareId } from "@/lib/studyhall/utils";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { deckId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let payload: {
    enableEditLink?: boolean;
    shareExpiresAt?: string | null;
  } = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const deck = await prisma.studyDeck.findUnique({
    where: { id: params.deckId },
    select: { userId: true, shareEditId: true, shareExpiresAt: true },
  });

  if (!deck || deck.userId !== userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  const data: {
    shareEditId?: string | null;
    shareExpiresAt?: Date | null;
  } = {};

  if (payload.enableEditLink !== undefined) {
    data.shareEditId = payload.enableEditLink ? deck.shareEditId ?? generateShareId() : null;
  }

  if (payload.shareExpiresAt !== undefined) {
    if (payload.shareExpiresAt === null) {
      data.shareExpiresAt = null;
    } else {
      const nextDate = new Date(payload.shareExpiresAt);
      if (Number.isNaN(nextDate.getTime())) {
        return NextResponse.json({ ok: false, error: "Invalid expiry date" }, { status: 400 });
      }
      data.shareExpiresAt = nextDate;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({
      ok: true,
      shareEditId: deck.shareEditId,
      shareExpiresAt: deck.shareExpiresAt ? deck.shareExpiresAt.toISOString() : null,
    });
  }

  const updated = await prisma.studyDeck.update({
    where: { id: params.deckId },
    data,
    select: { shareEditId: true, shareExpiresAt: true },
  });

  return NextResponse.json({
    ok: true,
    shareEditId: updated.shareEditId,
    shareExpiresAt: updated.shareExpiresAt ? updated.shareExpiresAt.toISOString() : null,
  });
}
