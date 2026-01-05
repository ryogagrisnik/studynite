import { NextResponse } from "next/server";
import { z } from "zod";

import { withApi } from "@/lib/api";
import prisma from "@/lib/prisma";
import { consumeEmailVerificationToken } from "@/lib/tokens";

const schema = z.object({
  token: z.string().min(1),
});

export const POST = withApi(async (request: Request) => {
  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const { token } = parsed.data;
  const userId = await consumeEmailVerificationToken(token);

  if (!userId) {
    return NextResponse.json({ error: "Token expired or invalid" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: new Date() },
  });

  return NextResponse.json({ success: true });
});
