import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { resolveAvatarId } from "@/lib/studyhall/avatars";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let payload: { avatarId?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const avatarId = resolveAvatarId(payload.avatarId ?? null);

  await prisma.user.update({
    where: { id: userId },
    data: { avatarId },
  });

  return NextResponse.json({ ok: true, avatarId });
}
