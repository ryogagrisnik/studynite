import { redis } from "@/lib/redis";

type RateLimitOptions = {
  max: number;
  windowMs: number;
};

type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

const memBuckets = new Map<string, { count: number; resetAt: number }>();

function nowMs() {
  return Date.now();
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function rateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const now = nowMs();
  const windowMs = Math.max(1000, options.windowMs);
  const max = Math.max(1, options.max);

  const fallback = () => {
    const existing = memBuckets.get(key);
    if (!existing || now >= existing.resetAt) {
      const resetAt = now + windowMs;
      memBuckets.set(key, { count: 1, resetAt });
      return { ok: true, remaining: Math.max(0, max - 1), resetAt };
    }
    const nextCount = existing.count + 1;
    existing.count = nextCount;
    memBuckets.set(key, existing);
    return {
      ok: nextCount <= max,
      remaining: Math.max(0, max - nextCount),
      resetAt: existing.resetAt,
    };
  };

  if (!redis.raw) {
    return fallback();
  }

  try {
    const windowSeconds = Math.ceil(windowMs / 1000);
    const resetKey = `${key}:reset`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
      await redis.set(resetKey, String(now + windowMs), { ex: windowSeconds });
    }
    const resetRaw = await redis.get(resetKey);
    const resetAt = toNumber(resetRaw) ?? now + windowMs;
    return {
      ok: count <= max,
      remaining: Math.max(0, max - count),
      resetAt,
    };
  } catch {
    return fallback();
  }
}
