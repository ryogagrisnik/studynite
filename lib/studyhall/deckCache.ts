import { redis } from "@/lib/redis";
import { textHash } from "@/lib/hash";
import type { GeneratedDeck } from "@/lib/studyhall/generator";

const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const CACHE_VERSION = "v1";
const memCache = new Map<string, { value: GeneratedDeck; expiresAt: number }>();

type DeckCacheKeyInput = {
  userId: string;
  sourceText: string;
  includeQuestions: boolean;
  includeFlashcards: boolean;
  includeExplanations: boolean;
  questionCount: number;
  flashcardCount: number;
};

function buildKey(input: DeckCacheKeyInput) {
  const base = [
    input.userId,
    CACHE_VERSION,
    input.includeQuestions ? "q1" : "q0",
    input.includeFlashcards ? "f1" : "f0",
    input.includeExplanations ? "e1" : "e0",
    String(input.questionCount),
    String(input.flashcardCount),
    textHash(input.sourceText || ""),
  ].join(":");
  return `studyhall:deckcache:${base}`;
}

function nowMs() {
  return Date.now();
}

export async function getCachedDeck(input: DeckCacheKeyInput): Promise<GeneratedDeck | null> {
  const key = buildKey(input);
  if (redis.raw) {
    const value = await redis.get(key);
    if (!value) return null;
    try {
      return typeof value === "string" ? (JSON.parse(value) as GeneratedDeck) : (value as GeneratedDeck);
    } catch {
      return null;
    }
  }

  const cached = memCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt < nowMs()) {
    memCache.delete(key);
    return null;
  }
  return cached.value;
}

export async function setCachedDeck(input: DeckCacheKeyInput, deck: GeneratedDeck) {
  const key = buildKey(input);
  if (redis.raw) {
    await redis.set(key, JSON.stringify(deck), { ex: CACHE_TTL_SECONDS });
    return;
  }
  memCache.set(key, { value: deck, expiresAt: nowMs() + CACHE_TTL_SECONDS * 1000 });
}
