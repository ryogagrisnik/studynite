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
      output: "htmlAndMathml",
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
