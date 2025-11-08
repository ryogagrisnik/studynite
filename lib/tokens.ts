import { randomBytes } from "crypto";
import prisma from "./prisma";

const EMAIL_TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
const RESET_TOKEN_TTL_MS = 1000 * 60 * 30; // 30 minutes

function generateToken() {
  return randomBytes(32).toString("hex");
}

export async function createEmailVerificationToken(userId: string) {
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });
  const token = generateToken();
  const expires = new Date(Date.now() + EMAIL_TOKEN_TTL_MS);
  await prisma.emailVerificationToken.create({
    data: { userId, token, expires },
  });
  return token;
}

export async function consumeEmailVerificationToken(token: string) {
  const stored = await prisma.emailVerificationToken.findUnique({ where: { token } });
  if (!stored) return null;
  if (stored.expires < new Date()) {
    await prisma.emailVerificationToken.delete({ where: { token } });
    return null;
  }
  await prisma.emailVerificationToken.deleteMany({ where: { userId: stored.userId } });
  return stored.userId;
}

export async function createPasswordResetToken(userId: string) {
  await prisma.passwordResetToken.deleteMany({ where: { userId } });
  const token = generateToken();
  const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await prisma.passwordResetToken.create({
    data: { userId, token, expires },
  });
  return token;
}

export async function consumePasswordResetToken(token: string) {
  const stored = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!stored) return null;
  if (stored.expires < new Date()) {
    await prisma.passwordResetToken.delete({ where: { token } });
    return null;
  }
  await prisma.passwordResetToken.deleteMany({ where: { userId: stored.userId } });
  return stored.userId;
}
