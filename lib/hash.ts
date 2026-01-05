// lib/hash.ts

/** Exact hash (used today) — deterministic on stem + choices ordering. */
export function questionHash(stem: string, choices?: string[]): string {
  const base = `${normalize(stem)}|${(choices ?? []).map(normalize).join("||")}`;
  return djb2(base);
}

/** Stable hash for arbitrary text blobs. */
export function textHash(value: string): string {
  return djb2(normalize(value));
}

/** Loose/structure hash — collapses numerals and common surface forms to catch
 *  “same problem different numbers” so we can press GPT to diversify structure.
 */
export function looseHash(stem: string): string {
  // strip LaTeX markup, collapse numbers, normalize whitespace & common words
  const withoutMath = stem
    .replace(/\$\$[\s\S]*?\$\$/g, " ") // block LaTeX
    .replace(/\$[^$]*\$/g, " ")        // inline LaTeX
    .replace(/\\\([^\)]*\\\)/g, " ")
    .replace(/\\\[[^\]]*\\\]/g, " ");

  const collapsed = withoutMath
    .toLowerCase()
    .replace(/[0-9]+(\.[0-9]+)?/g, "<num>")
    .replace(/degrees?|percent|%/g, "<unit>")
    .replace(/\b(miles?|km|hours?|mins?|minutes?|seconds?)\b/g, "<unit>")
    .replace(/\s+/g, " ")
    .trim();

  return djb2(collapsed);
}

function normalize(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function djb2(str: string): string {
  let hash = 5381 >>> 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  // return hex for readability
  return `h${hash.toString(16)}`;
}
