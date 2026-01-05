import { randomBytes } from "crypto";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateJoinCode(length = 6) {
  const bytes = randomBytes(length);
  let output = "";
  for (const byte of bytes) {
    output += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return output;
}

export function generateShareId(byteLength = 12) {
  return randomBytes(byteLength).toString("base64url");
}

export function clampCount(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

export function toSafeTitle(title: string | null | undefined) {
  const trimmed = (title ?? "").trim();
  return trimmed.length ? trimmed : "Untitled deck";
}
