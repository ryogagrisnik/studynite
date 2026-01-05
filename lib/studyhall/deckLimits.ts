import { redis } from "@/lib/redis";
import {
  DECK_COOLDOWN_MS,
  FREE_DAILY_DECK_LIMIT,
  PRO_DAILY_DECK_LIMIT,
} from "@/lib/studyhall/constants";

type CounterState = {
  count: number;
  resetAt: number;
};

function nowMs() {
  return Date.now();
}

function freshState(windowMs: number) {
  const now = nowMs();
  return { count: 0, resetAt: now + windowMs };
}

async function readCounter(key: string, windowMs: number): Promise<CounterState> {
  const raw = await redis.get(key);
  if (raw) {
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : (raw as CounterState);
      if (typeof parsed?.count === "number" && typeof parsed?.resetAt === "number") {
        if (nowMs() < parsed.resetAt) return parsed;
      }
    } catch {
      // ignore parse errors
    }
  }
  const next = freshState(windowMs);
  await redis.set(key, JSON.stringify(next));
  return next;
}

async function writeCounter(key: string, state: CounterState) {
  await redis.set(key, JSON.stringify(state));
}

async function incrementCounter(key: string, windowMs: number) {
  const state = await readCounter(key, windowMs);
  const next: CounterState = {
    count: state.count + 1,
    resetAt: state.resetAt,
  };
  await writeCounter(key, next);
  return next;
}

export async function getDeckLimitSnapshot(userId: string, isPro: boolean, hourlyMax: number) {
  const dailyLimit = isPro ? PRO_DAILY_DECK_LIMIT : FREE_DAILY_DECK_LIMIT;
  const dailyKey = `studyhall:deck:daily:${userId}`;
  const hourlyKey = `studyhall:deck:hour:${userId}`;
  const cooldownKey = `studyhall:deck:cooldown:${userId}`;

  const [dailyState, hourlyState, cooldownUntil] = await Promise.all([
    readCounter(dailyKey, 24 * 60 * 60 * 1000),
    readCounter(hourlyKey, 60 * 60 * 1000),
    redis.get(cooldownKey),
  ]);

  const cooldownMs = Math.max(0, Number(cooldownUntil ?? 0) - nowMs());

  return {
    dailyLimit,
    dailyUsed: dailyState.count,
    dailyResetAt: dailyState.resetAt,
    hourlyLimit: hourlyMax,
    hourlyUsed: hourlyState.count,
    hourlyResetAt: hourlyState.resetAt,
    cooldownMs,
    cooldownWindowMs: DECK_COOLDOWN_MS,
  };
}

export async function checkDeckLimits(userId: string, isPro: boolean, hourlyMax: number) {
  const snapshot = await getDeckLimitSnapshot(userId, isPro, hourlyMax);

  if (snapshot.dailyUsed >= snapshot.dailyLimit) {
    return {
      ok: false as const,
      error: "DAILY_LIMIT_REACHED",
      retryAfterMs: snapshot.dailyResetAt - nowMs(),
      snapshot,
    };
  }

  if (snapshot.hourlyUsed >= snapshot.hourlyLimit) {
    return {
      ok: false as const,
      error: "RATE_LIMITED",
      retryAfterMs: snapshot.hourlyResetAt - nowMs(),
      snapshot,
    };
  }

  if (snapshot.cooldownMs > 0) {
    return {
      ok: false as const,
      error: "COOLDOWN_ACTIVE",
      retryAfterMs: snapshot.cooldownMs,
      snapshot,
    };
  }

  return { ok: true as const, snapshot };
}

export async function recordDeckCreate(userId: string, isPro: boolean, hourlyMax: number) {
  const dailyKey = `studyhall:deck:daily:${userId}`;
  const hourlyKey = `studyhall:deck:hour:${userId}`;
  const cooldownKey = `studyhall:deck:cooldown:${userId}`;

  await Promise.all([
    incrementCounter(dailyKey, 24 * 60 * 60 * 1000),
    incrementCounter(hourlyKey, 60 * 60 * 1000),
    redis.set(cooldownKey, String(nowMs() + DECK_COOLDOWN_MS)),
  ]);
}
