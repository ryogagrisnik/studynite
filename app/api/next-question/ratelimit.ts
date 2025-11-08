// app/api/next-question/ratelimit.ts

/**
 * Tiny dependency-free sliding-window rate limiter.
 *  - LIMIT requests in WINDOW_MS per key (e.g., IP).
 *  - Good for dev/single-instance. Replace with Redis later if needed.
 */

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000); // 60s
const LIMIT = Number(process.env.RATE_LIMIT_MAX ?? 30);               // 30 req

// key -> array of timestamps (ms)
const buckets = new Map<string, number[]>();

export async function limit(key: string): Promise<{ success: boolean }> {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  const list = buckets.get(key) ?? [];
  // drop old entries
  const recent = list.filter((t) => t > cutoff);

  if (recent.length >= LIMIT) {
    buckets.set(key, recent);
    return { success: false };
  }

  recent.push(now);
  buckets.set(key, recent);
  return { success: true };
}
