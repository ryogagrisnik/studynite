import { NextResponse } from "next/server";
import { z } from "zod";

import { withApi } from "@/lib/api";
import { verificationEmailTemplate } from "@/lib/emailTemplates";
import { sendEmailWithRetry } from "@/lib/jobs";
import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { getRequestIp } from "@/lib/request";
import { createEmailVerificationToken } from "@/lib/tokens";
import { getAppBaseUrl } from "@/lib/urls";
import { env } from "@/lib/env";

const schema = z.object({
  email: z.string().email(),
});

export const POST = withApi(async (request: Request) => {
  const ip = getRequestIp(request);
  const resendMax = Math.max(1, Number(env.RATE_LIMIT_LOGIN_MAX ?? "6"));
  const limit = await rateLimit(`auth:verify:${ip}`, { max: resendMax, windowMs: 60_000 });
  if (!limit.ok) {
    const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
    const res = NextResponse.json({ error: "RATE_LIMITED", retryAfter }, { status: 429 });
    res.headers.set("Retry-After", String(retryAfter));
    return res;
  }

  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const { email } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true },
  });

  if (!user) {
    return NextResponse.json({ success: true });
  }

  if (user.emailVerified) {
    return NextResponse.json({ success: true });
  }

  const token = await createEmailVerificationToken(user.id);
  const verifyUrl = `${getAppBaseUrl()}/verify-email?token=${token}`;

  try {
    await sendEmailWithRetry({
      to: email,
      subject: "Verify your StudyNite account",
      html: verificationEmailTemplate(verifyUrl),
    });
  } catch (error) {
    console.error("resend verification email failed", error);
  }

  return NextResponse.json({ success: true });
});
