const MAX_RECENT_DEFAULT = 30;
const TTL_MS_DEFAULT = 1000 * 60 * 60; // 1 hour

type CacheEntry = {
  hash: string;
  expiresAt: number;
};

type CacheConfig = {
  max?: number;
  ttlMs?: number;
};

const store: Map<string, CacheEntry[]> =
  (globalThis as any).__blobprepRecentQuestions ||
  new Map<string, CacheEntry[]>();

if (!(globalThis as any).__blobprepRecentQuestions) {
  (globalThis as any).__blobprepRecentQuestions = store;
}

function cleanup(entries: CacheEntry[], now: number): CacheEntry[] {
  return entries.filter((entry) => entry.expiresAt > now);
}

export function getRecentQuestionHashes(userId: string): string[] {
  if (!userId) return [];
  const entries = store.get(userId);
  if (!entries || !entries.length) return [];
  const now = Date.now();
  const filtered = cleanup(entries, now);
  if (filtered.length !== entries.length) {
    store.set(userId, filtered);
  }
  return filtered.map((entry) => entry.hash);
}

export function rememberQuestionHash(
  userId: string,
  hash: string,
  config?: CacheConfig
): void {
  if (!userId || !hash) return;
  const now = Date.now();
  const ttl = Math.max(config?.ttlMs ?? TTL_MS_DEFAULT, 1000);
  const max = Math.max(config?.max ?? MAX_RECENT_DEFAULT, 1);
  const next: CacheEntry[] = cleanup(store.get(userId) ?? [], now);
  if (next.some((entry) => entry.hash === hash)) {
    // refresh expiry
    const refreshed = next.map((entry) =>
      entry.hash === hash ? { ...entry, expiresAt: now + ttl } : entry
    );
    store.set(userId, refreshed);
    return;
  }
  next.push({ hash, expiresAt: now + ttl });
  while (next.length > max) {
    next.shift();
  }
  store.set(userId, next);
}
