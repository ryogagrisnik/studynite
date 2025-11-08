import { randomUUID } from "crypto";
import type { Session } from "next-auth";
import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";

import { redis } from "@/lib/redis";
import { hasUnlimitedAccess } from "@/lib/server/membership";

const IS_DEV = process.env.NODE_ENV !== "production";

export const PRACTICE_LIMIT = Math.max(
  1,
  Number(process.env.NEXT_QUESTION_DAILY_LIMIT ?? "15")
);

export const PRACTICE_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours
export const IS_DEV_ENV = IS_DEV;

export type PracticeUser = {
  userId: string;
  isUnlimited: boolean;
};

export type QuotaState = {
  count: number;
  resetAt: number;
};

const QUOTA_PREFIX = "quota:window:";

function freshQuotaState(now: number): QuotaState {
  return {
    count: 0,
    resetAt: now + PRACTICE_WINDOW_MS,
  };
}

function serialize(state: QuotaState): string {
  return JSON.stringify(state);
}

function parseState(raw: unknown, now: number): QuotaState {
  if (!raw) return freshQuotaState(now);
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : (raw as QuotaState);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as any).count === "number" &&
      typeof (parsed as any).resetAt === "number"
    ) {
      const count = Math.max(0, Math.floor((parsed as any).count));
      const resetAt = Number((parsed as any).resetAt);
      if (!Number.isFinite(resetAt)) {
        return freshQuotaState(now);
      }
      if (now >= resetAt) {
        return freshQuotaState(now);
      }
      return { count, resetAt };
    }
  } catch {
    // ignore parse failures
  }
  return freshQuotaState(now);
}

export function resolvePracticeUser(
  session: Session | null,
  cookieStore: ResponseCookies
): PracticeUser {
  let userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    const existing = cookieStore.get("bp_anon_id")?.value;
    if (existing && existing.trim().length > 4) {
      userId = existing;
    } else {
      const generated = `anon_${randomUUID()}`;
      cookieStore.set({
        name: "bp_anon_id",
        value: generated,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
      userId = generated;
    }
  }

  const isUnlimited = hasUnlimitedAccess(session);

  return { userId: userId!, isUnlimited };
}

export async function getQuotaState(userId: string, now: number = Date.now()): Promise<QuotaState> {
  const key = `${QUOTA_PREFIX}${userId}`;
  const raw = await redis.get(key);
  const state = parseState(raw, now);
  if (!raw || state.count === 0) {
    await redis.set(key, serialize(state));
  } else if (raw && state.resetAt !== (typeof raw === "object" && raw && (raw as any).resetAt)) {
    await redis.set(key, serialize(state));
  }
  return state;
}

export async function saveQuotaState(userId: string, state: QuotaState): Promise<void> {
  const key = `${QUOTA_PREFIX}${userId}`;
  await redis.set(key, serialize(state));
}

export async function incrementQuotaState(
  userId: string,
  state: QuotaState,
  increment = 1
): Promise<QuotaState> {
  const now = Date.now();
  let next = state;
  if (now >= state.resetAt) {
    next = freshQuotaState(now);
  }
  next = {
    count: next.count + increment,
    resetAt: next.resetAt,
  };
  await saveQuotaState(userId, next);
  return next;
}

export function quotaMeta(state: QuotaState, isUnlimited: boolean) {
  return {
    used: isUnlimited ? null : state.count,
    limit: isUnlimited ? null : PRACTICE_LIMIT,
    isUnlimited,
    nextUnlockAt: new Date(state.resetAt).toISOString(),
  };
}
