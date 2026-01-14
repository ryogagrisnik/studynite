import { NextResponse } from "next/server";
import { z } from "zod";

import { withApi } from "@/lib/api";
import { env } from "@/lib/env";
import { verificationEmailTemplate } from "@/lib/emailTemplates";
import { sendEmailWithRetry } from "@/lib/jobs";
import { hashPassword } from "@/lib/password";
import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { getRequestIp } from "@/lib/request";
import { createEmailVerificationToken } from "@/lib/tokens";
import { getAppBaseUrl } from "@/lib/urls";
import { track } from "@vercel/analytics/server";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const POST = withApi(async (request: Request) => {
  const ip = getRequestIp(request);
  const signupMax = Math.max(1, Number(env.RATE_LIMIT_SIGNUP_MAX ?? "4"));
  const limit = await rateLimit(`auth:signup:${ip}`, { max: signupMax, windowMs: 60_000 });
  if (!limit.ok) {
    const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
    const res = NextResponse.json({ error: "RATE_LIMITED", retryAfter }, { status: 429 });
    res.headers.set("Retry-After", String(retryAfter));
    return res;
  }

  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { name, email, password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (!existing.passwordHash) {
      return NextResponse.json(
        { error: "Account exists via social login. Sign in with Google, then add a password in settings." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const verificationRequired = Boolean(env.RESEND_API_KEY);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      emailVerified: verificationRequired ? null : new Date(),
    },
  });

  try {
    await track("signup", { method: "credentials" });
  } catch {
    // analytics failures should not block signup
  }

  if (verificationRequired) {
    const token = await createEmailVerificationToken(user.id);
    const verifyUrl = `${getAppBaseUrl()}/verify-email?token=${token}`;

    try {
      await sendEmailWithRetry({
        to: email,
        subject: "Verify your RunePrep account",
        html: verificationEmailTemplate(verifyUrl),
      });
    } catch (error) {
      console.error("signup email send failed", error);
    }
  }

  return NextResponse.json({ success: true, verificationRequired });
});
