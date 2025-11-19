import katex from "katex";
import { normalizeLooseTex } from "./normalizeLooseTex";

const MACROS: Record<string, string> = {
  "\\RR": "\\mathbb{R}",
  "\\NN": "\\mathbb{N}",
  "\\ZZ": "\\mathbb{Z}",
  "\\QQ": "\\mathbb{Q}",
  "\\EE": "\\mathbb{E}",
  "\\Var": "\\operatorname{Var}",
  "\\Cov": "\\operatorname{Cov}",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapForMathJax(tex: string, displayMode: boolean): string {
  const open = displayMode ? "\\[" : "\\(";
  const close = displayMode ? "\\]" : "\\)";
  const payload = `${open}${tex}${close}`;
  return `<span class="mathjax-pending" data-mathjax="${escapeHtml(payload)}">${escapeHtml(
    tex
  )}</span>`;
}

function tryRenderWithKatex(tex: string, displayMode: boolean): string | null {
  try {
    const rendered = katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: "ignore",
      trust: true,
      // Use HTML only to avoid bulky MathML being mangled by upstream text processors
      output: "html",
      macros: MACROS,
    });
    if (rendered.includes("katex-error")) return null;
    return rendered;
  } catch (err) {
    console.warn("[renderMathToHtml] KaTeX render failed:", tex, err);
    return null;
  }
}

function renderSegment(tex: string, displayMode: boolean): string {
  const normalized = normalizeLooseTex(tex.trim());
  if (!normalized) return "";
  const katexHtml = tryRenderWithKatex(normalized, displayMode);
  if (katexHtml) return katexHtml;
  return wrapForMathJax(normalized, displayMode);
}

function replacePattern(
  value: string,
  regex: RegExp,
  displayMode: boolean,
  useFullMatch = false
): string {
  return value.replace(regex, (match: string, tex: string) =>
    renderSegment(useFullMatch ? match : tex ?? match, displayMode)
  );
}

const DISPLAY_PATTERNS: Array<{ regex: RegExp; full?: boolean }> = [
  { regex: /\\\[([\s\S]+?)\\\]/g },
  { regex: /\$\$([\s\S]+?)\$\$/g },
  { regex: /\\begin\{([\s\S]+?)\}([\s\S]*?)\\end\{\1\}/g, full: true },
];

const INLINE_PATTERNS: Array<{ regex: RegExp }> = [
  { regex: /\\\(([\s\S]+?)\\\)/g },
];

const INLINE_DOLLAR = /(^|[^\\$])\$([^\s][^$]*?)\$/g;

export function renderMathToHtml(input?: string | null): string | undefined {
  if (!input) return input ?? undefined;
  if (input.includes('class="katex') || input.includes("mathjax-pending")) return input;

  let output = input;

  for (const { regex, full } of DISPLAY_PATTERNS) {
    output = replacePattern(output, regex, true, Boolean(full));
  }

  for (const { regex } of INLINE_PATTERNS) {
    output = replacePattern(output, regex, false);
  }

  output = output.replace(INLINE_DOLLAR, (match, prefix, tex) => {
    const candidate = tex?.trim();
    if (!candidate) return match;
    // Render even pure numbers in math mode to keep consistent typography
    return `${prefix}${renderSegment(candidate, false)}`;
  });

  // Pass 4: render common loose TeX fragments that appear inline without
  // delimiters (e.g., "… new average: \\frac{1010}{13} ≈ …").
  // We conservatively target well‑formed fragments to avoid false positives.
  const LOOSE_INLINE_PATTERNS: Array<{ regex: RegExp }> = [
    // Core structures
    { regex: /(\\frac\s*\{[^{}]+\}\s*\{[^{}]+\})/g },
    { regex: /(\\sqrt\s*\{[^{}]+\})/g },
    { regex: /(\\binom\s*\{[^{}]+\}\s*\{[^{}]+\})/g },
    // Simple commands and Greek letters
    { regex: /(\\(?:pi|theta|alpha|beta|gamma|delta|lambda|mu|sigma|rho|phi|varphi|omega|leq|geq|neq|approx|times|cdot|div|pm))\b/g },
    // Superscripts/subscripts with explicit braces on a single token
    { regex: /([A-Za-z0-9]\\?)(\^\s*\{[^}]+\})/g },
    { regex: /([A-Za-z0-9]\\?)(_\s*\{[^}]+\})/g },
  ];

  for (const { regex } of LOOSE_INLINE_PATTERNS) {
    output = output.replace(regex, (match: string) => renderSegment(match, false));
  }

  // Pass 5: salvage unclosed \[ ... and \( ... sequences by treating the rest
  // of the line (until newline or end) as the math payload. This handles
  // explanations that contain lines like "\[ Average Speed =" without a closing
  // delimiter.
  function salvageUnclosedDelimiters(text: string): string {
    const apply = (s: string, open: string, close: string, displayMode: boolean) => {
      let start = 0;
      while (true) {
        const i = s.indexOf(open, start);
        if (i === -1) break;
        const j = s.indexOf(close, i + open.length);
        if (j !== -1) {
          start = j + close.length;
          continue; // already balanced
        }
        // No closing delimiter found; capture up to newline or end
        const lineEndIdx = (() => {
          const n = s.indexOf('\n', i + open.length);
          return n === -1 ? s.length : n;
        })();
        const payload = s.slice(i + open.length, lineEndIdx).trim();
        const rendered = renderSegment(payload, displayMode);
        s = s.slice(0, i) + rendered + s.slice(lineEndIdx);
        start = i + rendered.length;
      }
      return s;
    };

    let s = text;
    s = apply(s, '\\[', '\\]', true);
    s = apply(s, '\\(', '\\)', false);
    return s;
  }
  output = salvageUnclosedDelimiters(output);

  // Pass 6: convert simple subscript shorthand like x1 -> x_{1} and render inline
  // Avoid matching parts of longer tokens (e.g., A100). Limit to single digit.
  output = output.replace(/\b([xyabnkmprst])([0-9])\b/gi, (_m, v, d) => renderSegment(`${v}_{${d}}`, false));

  const trimmed = output.trim();
  if (!trimmed) return trimmed;

  const isPureMath =
    !/[<]/.test(trimmed) &&
    /[\\^{}_]/.test(trimmed) &&
    /^[\s\\0-9A-Za-z^{}_+\-*/().,=<>|:;'"%]+$/.test(trimmed);

  if (isPureMath) {
    return renderSegment(trimmed, /\n/.test(trimmed) || trimmed.includes("\\\\"));
  }

  return output;
}
