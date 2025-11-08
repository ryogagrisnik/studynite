import type { Session } from "next-auth";

const IS_DEV = process.env.NODE_ENV !== "production";

const DEV_UNLIMITED_EMAILS: string[] = (
  process.env.UNLIMITED_EMAILS
    ? process.env.UNLIMITED_EMAILS.split(",")
    : ["ryogagrisnik@gmail.com", "admin@blobprep.com", "team@blobprep.com"]
)
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function hasActiveProSession(session: Session | null): boolean {
  if (!session?.user) return false;
  const userAny = session.user as any;
  if (typeof userAny.isPro === "boolean") {
    if (userAny.isPro) return true;
  }
  const expiresAt = parseDate(userAny.proExpiresAt);
  if (expiresAt) {
    return expiresAt.getTime() > Date.now();
  }
  return false;
}

export function isDevUnlimitedEmail(email: string | null | undefined): boolean {
  if (!IS_DEV) return false;
  if (!email) return false;
  return DEV_UNLIMITED_EMAILS.includes(email.toLowerCase());
}

export function hasUnlimitedAccess(session: Session | null): boolean {
  if (!session?.user) return false;
  if (hasActiveProSession(session)) return true;
  const email = typeof (session.user as any).email === "string" ? ((session.user as any).email as string) : "";
  return isDevUnlimitedEmail(email);
}

export function getProExpiration(session: Session | null): Date | null {
  if (!session?.user) return null;
  const expiresAt = parseDate((session.user as any).proExpiresAt);
  return expiresAt && expiresAt.getTime() > 0 ? expiresAt : null;
}
