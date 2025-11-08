import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { consumePasswordResetToken } from "@/lib/tokens";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { token, password } = parsed.data;
  const userId = await consumePasswordResetToken(token);
  if (!userId) {
    return NextResponse.json({ error: "Token expired or invalid" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return NextResponse.json({ success: true });
}
