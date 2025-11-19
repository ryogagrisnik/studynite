// Utility to sanitize messy LLM/plaintext into consistently readable prose
// – removes control characters, tabs, and stray HTML-like fragments
// – strips leaked KaTeX/MathJax renderer markup when it appears as text
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

  // Strip obvious KaTeX/MathJax renderer artifacts if they have leaked into the
  // explanation as plain text (e.g., "spanclass=\"katex\" … pstrut … vlist-t …").
  // This situation can happen when upstream markup is double‑escaped before it
  // reaches the normalizer.
  text = text.replace(/\u2212/g, "-"); // normalize Unicode minus
  text = text.replace(
    /\b(?:spanclass|katex(?:−|-)?html|mathjax-pending|vlist(?:-t|-r|-s)?|pstrut|sizing(?:reset)?|mtight|mord|mspace|msupsub|mopen(?:nulldelimiter)?|mclose(?:nulldelimiter)?|base|strut|aria(?:−|-)?hidden)\b[^\n]*/gi,
    " ",
  );
  // Remove leaked data/aria attributes and any leftover angle‑bracket chunks
  // that are not part of LaTeX.
  text = text.replace(/data-mathjax\s*=\s*"[^"]*"/gi, " ");
  text = text.replace(/data-mathjax\s*=\s*'[^']*'/gi, " ");
  text = text.replace(/aria-hidden\s*=\s*"[^"]*"/gi, " ");
  // Drop any literal HTML tags and also encoded tags like "&lt;span ...&gt;"
  text = text.replace(/<[\s\S]*?>/g, " ");
  text = text.replace(/&lt;[\s\S]*?&gt;/gi, " ");
  text = text.replace(/&quot;|"|&#39;/g, " ");
  // Decode remaining common entities so inequalities like "0 &lt; d &lt; 1"
  // become readable math again.
  text = text.replace(/&nbsp;/gi, " ");
  text = text.replace(/&amp;/gi, "&");
  text = text.replace(/&lt;/gi, "<");
  text = text.replace(/&gt;/gi, ">");

  // Drop SVG/path-style coordinate gibberish that sometimes leaks from icons or
  // math renderers, e.g. "c34,79.3,68.167,158.7,102.5,238c34.3,79.3,...".
  // These sequences carry no pedagogical value and make explanations unreadable.
  text = text.replace(/[MmLlCcSsQqTtAaZz][0-9.,\s-]{40,}/g, " ");

  // Fix common math word typos to readable symbols (without forcing LaTeX)
  text = text.replace(/\bimes\b/gi, "×");
  text = text.replace(/\bdiv\b/gi, "÷");

  text = collapseDuplicateSubstrings(text);
  text = dedupeSentences(text);

  return text.trim();
}
