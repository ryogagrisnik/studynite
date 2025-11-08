import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.$transaction([
    prisma.attempt.deleteMany({ where: { userId } }),
    prisma.missedQuestion.deleteMany({ where: { userId } }),
    prisma.quotaLog.deleteMany({ where: { userId } }),
    prisma.dailyQueueItem.deleteMany({ where: { userId } }),
  ]);

  return NextResponse.json({ success: true });
}
