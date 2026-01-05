import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let payload: { questionId?: string; isCorrect?: boolean } = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  if (!payload.questionId) {
    return NextResponse.json({ ok: false, error: "Missing questionId" }, { status: 400 });
  }

  await prisma.studyAttempt.create({
    data: {
      userId,
      questionId: payload.questionId,
      isCorrect: Boolean(payload.isCorrect),
    },
  });

  return NextResponse.json({ ok: true });
}
