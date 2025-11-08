import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createEmailVerificationToken } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";
import { getAppBaseUrl } from "@/lib/urls";
import { verificationEmailTemplate } from "@/lib/emailTemplates";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
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

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
    },
  });

  const token = await createEmailVerificationToken(user.id);
  const verifyUrl = `${getAppBaseUrl()}/verify-email?token=${token}`;

  try {
    await sendEmail({
      to: email,
      subject: "Verify your BlobPrep account",
      html: verificationEmailTemplate(verifyUrl),
    });
  } catch (error) {
    console.error("signup email send failed", error);
  }

  return NextResponse.json({ success: true });
}
