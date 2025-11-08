import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createPasswordResetToken } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";
import { getAppBaseUrl } from "@/lib/urls";
import { passwordResetTemplate } from "@/lib/emailTemplates";

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

  if (user) {
    const token = await createPasswordResetToken(user.id);
    const resetUrl = `${getAppBaseUrl()}/reset-password?token=${token}`;

    try {
      await sendEmail({
        to: email,
        subject: "Reset your BlobPrep password",
        html: passwordResetTemplate(resetUrl),
      });
    } catch (error) {
      console.error("password reset email send failed", error);
    }
  }

  return NextResponse.json({ success: true });
}
