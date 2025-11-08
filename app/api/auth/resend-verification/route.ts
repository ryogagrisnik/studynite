import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createEmailVerificationToken } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";
import { getAppBaseUrl } from "@/lib/urls";
import { verificationEmailTemplate } from "@/lib/emailTemplates";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
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
    await sendEmail({
      to: email,
      subject: "Verify your BlobPrep account",
      html: verificationEmailTemplate(verifyUrl),
    });
  } catch (error) {
    console.error("resend verification email failed", error);
  }

  return NextResponse.json({ success: true });
}
