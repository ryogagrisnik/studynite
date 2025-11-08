// Utility to sanitize messy LLM/plaintext into consistently readable prose
// – removes control characters, tabs, and stray HTML-like fragments
// – fixes common math typos (imes -> ×)
// – collapses accidental duplicate substrings/sentences

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

function collapseDuplicateSubstrings(input: string): string {
  let out = input;
  // Collapse immediate repeated chunks of 15–120 chars (seen in some noisy explanations)
  // e.g., "1+2+...+10=55 1+2+...+10=55" -> one copy
  const rx = /([\w\s+*\\/=.,;:'"()\[\]^_–-]{15,120})\s*\1{1,3}/g;
  for (let i = 0; i < 3; i++) {
    const next = out.replace(rx, "$1");
    if (next === out) break;
    out = next;
  }
  return out;
}

function dedupeSentences(input: string): string {
  const parts = input
    .split(/([.!?]+)\s+/)
    .reduce<string[]>((acc, cur, idx, arr) => {
      if (idx % 2 === 0) {
        const sentence = (cur + (arr[idx + 1] || "")).trim();
        if (!sentence) return acc;
        const key = sentence.replace(/\s+/g, " ").toLowerCase();
        if (!acc.some((s) => s.replace(/\s+/g, " ").toLowerCase() === key)) acc.push(sentence);
      }
      return acc;
    }, []);
  return parts.join(" ");
}

export function cleanReadableText(raw: string): string {
  if (!raw) return raw;
  let text = raw
    .replace(CONTROL, " ")
    .replace(/\t+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\"]?>/g, " "); // drop stray attribute closers

  // Fix common math word typos to readable symbols (without forcing LaTeX)
  text = text.replace(/\bimes\b/gi, "×");
  text = text.replace(/\bdiv\b/gi, "÷");

  text = collapseDuplicateSubstrings(text);
  text = dedupeSentences(text);

  return text.trim();
}

