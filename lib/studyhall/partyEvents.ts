import { redis } from "@/lib/redis";

const EVENT_TTL_MS = 24 * 60 * 60 * 1000;
const memEvents = new Map<string, { value: number; expiresAt: number }>();

function nowMs() {
  return Date.now();
}

function keyFor(partyId: string) {
  return `studyhall:party:event:${partyId}`;
}

export async function markPartyEvent(partyId: string) {
  const now = nowMs();
  const key = keyFor(partyId);
  if (redis.raw) {
    await redis.set(key, String(now), { ex: Math.ceil(EVENT_TTL_MS / 1000) });
    return now;
  }
  memEvents.set(key, { value: now, expiresAt: now + EVENT_TTL_MS });
  return now;
}

export async function getPartyEventStamp(partyId: string) {
  const key = keyFor(partyId);
  if (redis.raw) {
    const value = await redis.get(key);
    const parsed =
      typeof value === "number"
        ? value
        : typeof value === "string"
        ? Number(value)
        : null;
    return Number.isFinite(parsed) ? (parsed as number) : 0;
  }
  const cached = memEvents.get(key);
  if (!cached) return 0;
  if (nowMs() > cached.expiresAt) {
    memEvents.delete(key);
    return 0;
  }
  return cached.value;
}
