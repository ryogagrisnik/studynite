// app/api/qotd/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redis } from "@/lib/redis";

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

function json(x: any, status = 200) { return NextResponse.json(x, { status }); }

function keyIssued(uid: string) { return `qotd:issued:${uid}`; }
function keyLocked(uid: string) { return `qotd:locked:${uid}`; }

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return json({ error: "UNAUTHENTICATED" }, 401);
  const uid = (session.user as any)?.id || "";
  try {
    const [issuedStr, lockedStr] = await Promise.all([
      redis.get(keyIssued(uid)),
      redis.get(keyLocked(uid)),
    ]);
    const issuedAt = typeof issuedStr === 'string' ? Number(issuedStr) : null;
    const lockedUntil = typeof lockedStr === 'string' ? Number(lockedStr) : null;
    const now = Date.now();
    const remaining = lockedUntil && lockedUntil > now ? lockedUntil - now : 0;
    return json({ issuedAt, lockedUntil, remainingMs: remaining });
  } catch {
    return json({ issuedAt: null, lockedUntil: null, remainingMs: 0 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return json({ error: "UNAUTHENTICATED" }, 401);
  const uid = (session.user as any)?.id || "";
  let body: any = {};
  try { body = await req.json(); } catch {}
  const action = typeof body?.action === 'string' ? body.action : '';
  const now = Date.now();
  try {
    if (action === 'issue') {
      await redis.set(keyIssued(uid), String(now));
      // Clear any existing lock on new issuance
      await redis.del(keyLocked(uid)).catch(() => {});
      return json({ ok: true, issuedAt: now });
    }
    if (action === 'lock') {
      const until = now + TWELVE_HOURS_MS;
      await redis.set(keyLocked(uid), String(until));
      return json({ ok: true, lockedUntil: until });
    }
    return json({ error: 'UNKNOWN_ACTION' }, 400);
  } catch {
    return json({ error: 'SERVER_ERROR' }, 500);
  }
}

