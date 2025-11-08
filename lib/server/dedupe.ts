// lib/server/dedupe.ts
import crypto from "crypto";

// In-memory seen set (per server instance). For production, move to Redis.
const seen = new Set<string>();

function hash(text: string) {
  return crypto.createHash("sha1").update(text).digest("hex");
}

/** Returns true if this stem was seen before; otherwise marks and returns false. */
export function markSeen(stemHTML?: string | null): boolean {
  if (!stemHTML) return false;
  const h = hash(stemHTML);
  if (seen.has(h)) return true;
  seen.add(h);
  return false;
}
