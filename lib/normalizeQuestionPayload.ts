import { QuestionPayload, ensureQuestionPayload } from "@/lib/types/question";
import { renderMathToHtml } from "@/lib/math/renderMathToHtml";
import { normalizeLooseTex } from "@/lib/math/normalizeLooseTex";
import { cleanReadableText } from "@/lib/math/cleanText";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

function isLikelyHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeLatexHtml(value: string): string {
  return value
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function coerceLatex(raw: string): string {
  let text = raw;
  text = text.replace(/\\n/g, "\n").replace(/\r\n?/g, "\n");
  text = text.replace(/(^|[^\\])begin\{/g, (_m, prefix) => `${prefix}\\begin{`);
  text = text.replace(/(^|[^\\])end\{/g, (_m, prefix) => `${prefix}\\end{`);
  text = text.replace(/(^|[^\\])ext\{/g, (_m, prefix) => `${prefix}\\text{`);
  text = text.replace(/(^|[^\\])text\{/g, (_m, prefix) => `${prefix}\\text{`);
  text = text.replace(/(^|[^\\])textit\{/g, (_m, prefix) => `${prefix}\\textit{`);
  text = text.replace(/(^|[^\\])textbf\{/g, (_m, prefix) => `${prefix}\\textbf{`);
  text = text.replace(/(^|[^\\])frac\b/g, (_m, prefix) => `${prefix}\\frac`);
  text = text.replace(/(^|[^\\])sqrt\b/g, (_m, prefix) => `${prefix}\\sqrt`);
  text = text.replace(/(^|[^\\])pi\b/gi, (_m, prefix) => `${prefix}\\pi`);
  text = text.replace(/(^|[^\\])theta\b/gi, (_m, prefix) => `${prefix}\\theta`);
  text = text.replace(/(^|[^\\])times\b/g, (_m, prefix) => `${prefix}\\times`);
  text = text.replace(/(^|[^\\])cdot\b/g, (_m, prefix) => `${prefix}\\cdot`);
  text = text.replace(/(^|[^\\])div\b/g, (_m, prefix) => `${prefix}\\div`);
  text = text.replace(/(^|[^\\])pm\b/g, (_m, prefix) => `${prefix}\\pm`);
  text = text.replace(/(^|[^\\])geq\b/g, (_m, prefix) => `${prefix}\\geq`);
  text = text.replace(/(^|[^\\])leq\b/g, (_m, prefix) => `${prefix}\\leq`);
  text = text.replace(/(^|[^\\])neq\b/g, (_m, prefix) => `${prefix}\\neq`);
  text = text.replace(/(^|[^\\])approx\b/g, (_m, prefix) => `${prefix}\\approx`);
  text = text.replace(/\\\s+([A-Za-z]+)/g, (_m, word) => `\\text{ ${word.trim()} }`);
  text = text.replace(/\^\(([^)]+)\)/g, (_m, inner) => `^{${inner.trim()}}`);
  text = text.replace(/_\(([^)]+)\)/g, (_m, inner) => `_{${inner.trim()}}`);
  text = text.replace(/_(\d+)/g, (_m, digits) => `_{${digits}}`);
  text = text.replace(/\^(\d+)/g, (_m, digits) => `^{${digits}}`);
  text = text.replace(/√\s*\(([^)]+)\)/g, (_m, inner) => `\\sqrt{${inner.trim()}}`);
  text = text.replace(/\(\s*(\d+)\s*\/\s*(\d+)\s*\)/g, (_m, num, den) => `\\frac{${num}}{${den}}`);
  text = text.replace(/°/g, "^{\\circ}");
  text = text.replace(/×/g, "\\times");
  text = text.replace(/·/g, "\\cdot");
  text = text.replace(/÷/g, "\\div");
  return text.trim();
}

function stripHtmlPreservingBreaks(value: string): string {
  return value
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/p\s*>/gi, "\n\n")
    .replace(/<\s*\/div\s*>/gi, "\n\n")
    .replace(/<\s*\/h[1-6]\s*>/gi, "\n\n")
    .replace(/<\s*\/li\s*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, "");
}

function tryParseNumber(val?: string): number | null {
  if (!val) return null;
  const s = val.replace(/[,\s]/g, "").trim();
  const frac = s.match(/^(-?\d+)\/(\d+)$/);
  if (frac) {
    const num = parseFloat(frac[1]!);
    const den = parseFloat(frac[2]!);
    if (den !== 0) return num / den;
  }
  const num = Number(s.replace(/[^0-9+\-.eE]/g, ""));
  return Number.isFinite(num) ? num : null;
}

function buildOptionsFromAnswer(ansRaw: unknown): { options: { id: string|number; html: string }[]; correct: number } | null {
  if (ansRaw == null) return null;
  const ans = String(ansRaw).trim();
  if (!ans) return null;
  const qcChoices = ["Quantity A", "Quantity B", "Equal", "Cannot be determined"];
  const normalized = ans.toLowerCase().replace(/\s+/g, " ");
  const qcIndex = qcChoices.findIndex((c) => c.toLowerCase() === normalized);
  if (qcIndex >= 0) {
    return {
      options: qcChoices.map((c, i) => ({ id: i, html: c })),
      correct: qcIndex,
    };
  }
  if (/no\s+solution|impossible|none/i.test(ans)) {
    const opts = ["No solution", "Exactly one solution", "Infinitely many", "Cannot be determined"];
    return { options: opts.map((t, i) => ({ id: i, html: t })), correct: 0 };
  }
  const val = tryParseNumber(ans);
  const seen = new Set<string>();
  const opts: string[] = [];
  const add = (s: string) => { const k = s.toLowerCase(); if (!seen.has(k)) { seen.add(k); opts.push(s); } };
  add(ans);
  if (val != null) {
    const deltas = [0.05, -0.08, 0.12, -0.15, 0.2];
    for (const d of deltas) {
      const v = val * (1 + d);
      const fmt = Math.abs(v) >= 10 ? v.toFixed(1) : v.toPrecision(3);
      add(fmt.replace(/\.0$/, ""));
      if (opts.length >= 4) break;
    }
  } else {
    add("None of the above");
    add("Cannot be determined");
    add("Insufficient information");
  }
  while (opts.length < 4) add(String(opts.length + 1));
  const correct = opts.findIndex((t) => t === ans);
  return { options: opts.map((t, i) => ({ id: i, html: t })), correct: correct >= 0 ? correct : 0 };
}

function formatInlineText(rawLine: string): string {
  const segments: string[] = [];
  let cursor = 0;
  const pattern = /\\text(it|bf)?\{([^{}]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(rawLine)) !== null) {
    const [full, variant, inner] = match;
    if (match.index > cursor) {
      segments.push(escapeHtml(rawLine.slice(cursor, match.index)));
    }
    const content = escapeHtml(inner);
    if (variant === "it") {
      segments.push(`<em>${content}</em>`);
    } else if (variant === "bf") {
      segments.push(`<strong>${content}</strong>`);
    } else {
      segments.push(content);
    }
    cursor = match.index + full.length;
  }

  if (cursor < rawLine.length) {
    segments.push(escapeHtml(rawLine.slice(cursor)));
  }

  return segments.join("");
}

function formatPlainTextToHtml(raw: string): string | undefined {
  const normalizedNewlines = raw.replace(/\r\n?/g, "\n");
  const lines = normalizedNewlines.split("\n");
  const result: string[] = [];
  let textBuffer: string[] = [];
  let mathBlock: string[] | null = null;

  const flushText = () => {
    if (!textBuffer.length) return;
    result.push(`<p>${textBuffer.join(" ")}</p>`);
    textBuffer = [];
  };

  const pushDisplay = (latex: string) => {
    const coerced = coerceLatex(latex);
    if (!coerced) return;
    result.push(`<p class="math-block">\\[${escapeLatexHtml(coerced)}\\]</p>`);
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushText();
      continue;
    }

    if (mathBlock) {
      const sanitizedLine = coerceLatex(trimmed);
      mathBlock.push(sanitizedLine);
      if (sanitizedLine.startsWith("\\end{")) {
        flushText();
        pushDisplay(mathBlock.join("\n"));
        mathBlock = null;
      }
      continue;
    }

    if (/^(\\)?begin\{/.test(trimmed) || /^begin\{/.test(trimmed)) {
      const startLine = trimmed.startsWith("\\") ? trimmed : `\\${trimmed}`;
      mathBlock = [coerceLatex(startLine)];
      continue;
    }

    const hasBackslash = /\\/.test(trimmed);
    const tokens = trimmed.split(/[^A-Za-z]+/).filter(Boolean);
    const hasLongWord = tokens.some((word) => word.length > 3);
    const hasMathSymbols = /[=^_]/.test(trimmed);

    if ((hasBackslash || hasMathSymbols) && !hasLongWord) {
      flushText();
      const coerced = coerceLatex(trimmed);
      result.push(`<p class="math-block">\\(${escapeLatexHtml(coerced)}\\)</p>`);
      continue;
    }

    textBuffer.push(formatInlineText(trimmed));
  }

  flushText();

  if (mathBlock && mathBlock.length) {
    pushDisplay(mathBlock.join("\n"));
    mathBlock = null;
  }

  if (!result.length) return undefined;
  return result.join("");
}

function toReadableHtml(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = cleanReadableText(raw.trim());
  if (!trimmed) return undefined;
  if (isLikelyHtml(trimmed)) {
    const stripped = stripHtmlPreservingBreaks(trimmed);
    return formatPlainTextToHtml(stripped);
  }
  return formatPlainTextToHtml(trimmed);
}

function clampIndex(n: any, len: number): number {
  const x = Number(n);
  if (!Number.isFinite(x) || len <= 0) return 0;
  if (x < 0) return 0;
  if (x >= len) return 0;
  return x;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  return Array.isArray(v) ? v : v == null ? [] : [v];
}

function coerceString(v: unknown): string | undefined {
  if (typeof v === "string") return v.trim();
  if (v == null) return undefined;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return undefined;
}

function pickString(keys: string[], ...sources: any[]): string | undefined {
  for (const src of sources) {
    if (!src || typeof src !== "object") continue;
    for (const key of keys) {
      const value = coerceString((src as any)[key]);
      if (value) return value;
    }
  }
  return undefined;
}

function pickStringArray(key: string, ...sources: any[]): string[] | undefined {
  for (const src of sources) {
    if (!src || typeof src !== "object") continue;
    const raw = (src as any)[key];
    if (Array.isArray(raw)) {
      const strings = raw
        .map((item) => coerceString(item))
        .filter((item): item is string => typeof item === "string" && item.length > 0);
      if (strings.length) return strings;
    }
  }
  return undefined;
}

export function normalizeQuestionPayload(rawIn: any): QuestionPayload {
  try {
    const root = rawIn?.question ?? rawIn ?? {};
    const metaSource = root.meta ?? rawIn?.meta ?? {};

    const section = root.section === "Verbal" ? ("Verbal" as const) : ("Quant" as const);
    const mode = root.mode === "topic" ? ("topic" as const) : ("random" as const);

    const stemHTML =
      coerceString(root.stemHTML) ??
      coerceString(root.promptHTML) ??
      coerceString(root.stem) ??
      coerceString(root.prompt) ??
      "";

    const stemLatex = coerceString(root.stemLatex) ?? coerceString(root.promptLatex);

    const topic =
      coerceString(root.topic) ??
      coerceString(root.category) ??
      coerceString(root.concept) ??
      coerceString(rawIn?.topic);

    const difficultyRaw =
      coerceString(root.difficulty) ??
      coerceString(root.level) ??
      coerceString(rawIn?.difficulty) ??
      "medium";
    const difficulty = difficultyRaw || "medium";
    const badge = coerceString(root.badge) ?? coerceString(rawIn?.badge);

    const optionsSrc: any[] =
      (Array.isArray(root.options) && root.options) ||
      (Array.isArray(root.choices) && root.choices) ||
      (Array.isArray(root.answers) && root.answers) ||
      [];

    let options = optionsSrc.map((op: any, i: number) => {
      if (op && typeof op === "object") {
        const html =
          coerceString(op.html) ??
          coerceString(op.text) ??
          coerceString(op.label) ??
          coerceString(op.value);
        const latex = coerceString(op.latex);
        return {
          id: (op.id ?? op.key ?? i) as string | number,
          html: html,
          latex: latex,
        };
      }
      const text = coerceString(op) || `Option ${i + 1}`;
      return { id: i, html: text };
    });

    if (!Array.isArray(options) || options.length < 2) {
      // Try to synthesize choices from a single canonical answer if provided
      const fromAnswer = buildOptionsFromAnswer(root.answer ?? (metaSource as any)?.answer ?? (rawIn as any)?.answer);
      if (fromAnswer) {
        options = fromAnswer.options as any;
        // Will set correct below if possible; fallback to index 0 otherwise
        (root as any).__synthCorrect = fromAnswer.correct;
      } else {
        options = [
          { id: 0, html: "Option A" },
          { id: 1, html: "Option B" },
        ];
      }
    }
    options = options.map((op) => {
      const htmlSource = typeof op.html === "string" ? op.html : undefined;
      const normalizedHtml = htmlSource !== undefined ? normalizeLooseTex(htmlSource) : undefined;
      const renderedHtml = normalizedHtml !== undefined ? renderMathToHtml(normalizedHtml) ?? normalizedHtml : undefined;
      return {
        ...op,
        html: renderedHtml ?? htmlSource,
      } as (typeof options)[number];
    }) as typeof options;

    let correct =
      (Array.isArray(root.correct) && root.correct.length ? root.correct : undefined) ??
      (typeof root.answerIndex === "number" ? [root.answerIndex] : undefined) ??
      (typeof root.correctIndex === "number" ? [root.correctIndex] : undefined) ??
      (typeof root.answer === "number" ? [root.answer] : undefined) ??
      (Array.isArray(root.correctIndices) && root.correctIndices.length ? root.correctIndices : undefined);

    if ((!correct || correct.length === 0) && typeof root.answer === "string") {
      const target = coerceString(root.answer)?.toLowerCase();
      if (target) {
        const matchIdx = options.findIndex((op) => {
          const text = coerceString(op?.html ?? op?.latex)?.toLowerCase();
          return text === target;
        });
        if (matchIdx >= 0) correct = [matchIdx];
      }
    }

    if (!Array.isArray(correct) || correct.length === 0) {
      const synth = (root as any)?.__synthCorrect;
      correct = [Number.isFinite(synth) ? Number(synth) : 0];
    }

    const normalizedCorrect = asArray<number>(correct)
      .map((n) => clampIndex(n, options.length))
      .filter((v, idx, arr) => arr.indexOf(v) === idx);

    const explainHTML = toReadableHtml(
      coerceString(root.explainHTML) ??
        coerceString(root.explanationHtml) ??
        coerceString(root.explanation) ??
        coerceString(rawIn?.explanation)
    );

    const source =
      coerceString(root.source) ??
      coerceString(metaSource?.source) ??
      coerceString(rawIn?.source);

    const tags = pickStringArray("tags", metaSource, root, rawIn);

    const rawKind = pickString(
      ["kind", "type", "questionType"],
      root,
      metaSource,
      rawIn
    );

    const kindLower = rawKind?.toLowerCase() ?? "";
    const normalizedKind =
      kindLower.includes("qc") || kindLower.includes("quantitative comparison")
        ? ("qc" as const)
        : kindLower
        ? ("mcq" as const)
        : undefined;

    const isQuant = normalizedKind === "qc" || section === "Quant";

    const quantityA = isQuant
      ? pickString(["quantityA", "quantity_a", "quantitya", "A"], root, metaSource, rawIn) ?? undefined
      : undefined;
    const quantityB = isQuant
      ? pickString(["quantityB", "quantity_b", "quantityb", "B"], root, metaSource, rawIn) ?? undefined
      : undefined;

    const inferredKind =
      normalizedKind === "qc" && quantityA && quantityB ? ("qc" as const) : normalizedKind ?? ("mcq" as const);

    const id =
      root.id ??
      rawIn?.id ??
      root._id ??
      root.uuid ??
      rawIn?._id ??
      rawIn?.uuid ??
      `generated-${Math.random().toString(36).slice(2)}`;

    const stemHTMLNormalized = stemHTML ? (isLikelyHtml(stemHTML) ? stemHTML : normalizeLooseTex(stemHTML)) : undefined;
    const explainHTMLNormalized = explainHTML ? (isLikelyHtml(explainHTML) ? explainHTML : normalizeLooseTex(explainHTML)) : undefined;
    const quantityANormalized = isQuant && quantityA ? (isLikelyHtml(quantityA) ? quantityA : normalizeLooseTex(quantityA)) : quantityA ?? null;
    const quantityBNormalized = isQuant && quantityB ? (isLikelyHtml(quantityB) ? quantityB : normalizeLooseTex(quantityB)) : quantityB ?? null;

    const finalStemHTML =
      stemHTMLNormalized != null
        ? renderMathToHtml(stemHTMLNormalized) ?? stemHTMLNormalized
        : undefined;
    let finalExplainHTML: string | undefined;
    if (explainHTMLNormalized != null) {
      // If the explanation still contains KaTeX/MathJax renderer markup or any
      // obvious HTML/span artifacts (including encoded tags), treat it as
      // polluted and rebuild a clean version from plain text instead of
      // trusting the existing tags.
      if (/\b(katex|mathjax|spanclass)\b/i.test(explainHTMLNormalized) || /<\/?span\b/i.test(explainHTMLNormalized) || /&lt;\/?span\b/i.test(explainHTMLNormalized)) {
        const stripped = stripHtmlPreservingBreaks(explainHTMLNormalized);
        finalExplainHTML = formatPlainTextToHtml(cleanReadableText(stripped)) ?? stripped;
      } else {
        finalExplainHTML = renderMathToHtml(explainHTMLNormalized) ?? explainHTMLNormalized;
      }
    }
    const finalQuantityA =
      isQuant && quantityANormalized != null
        ? renderMathToHtml(quantityANormalized) ?? quantityANormalized
        : quantityANormalized;
    const finalQuantityB =
      isQuant && quantityBNormalized != null
        ? renderMathToHtml(quantityBNormalized) ?? quantityBNormalized
        : quantityBNormalized;

    const safeStemHTML = finalStemHTML != null ? sanitizeHtml(finalStemHTML)! : undefined;
    let safeExplainHTML = finalExplainHTML != null ? sanitizeHtml(finalExplainHTML)! : undefined;
    // Final safety net: if any renderer markup slipped through after sanitizing,
    // strip tags and fall back to simple paragraph text so learners never see
    // raw KaTeX/MathJax HTML.
    if (
      safeExplainHTML &&
      (/\b(katex|mathjax|spanclass)\b/i.test(safeExplainHTML) ||
        /<\/?span\b/i.test(safeExplainHTML) ||
        /&lt;\/?span\b/i.test(safeExplainHTML))
    ) {
      const stripped = stripHtmlPreservingBreaks(safeExplainHTML);
      safeExplainHTML = formatPlainTextToHtml(cleanReadableText(stripped)) ?? stripped;
    }
    const safeQuantityA = finalQuantityA != null ? sanitizeHtml(String(finalQuantityA))! : null;
    const safeQuantityB = finalQuantityB != null ? sanitizeHtml(String(finalQuantityB))! : null;

    const payload = ensureQuestionPayload({
      id,
      exam: "GRE" as const,
      section,
      mode,
      topic,
      difficulty,
      stemHTML: safeStemHTML,
      stemLatex,
      kind: inferredKind,
      quantityA: isQuant ? safeQuantityA : null,
      quantityB: isQuant ? safeQuantityB : null,
      badge: badge || undefined,
      options,
      correct: normalizedCorrect.length ? normalizedCorrect : [0],
      explainHTML: safeExplainHTML,
      meta: source || tags ? { source, tags } : undefined,
    });

    return payload;
  } catch (error) {
    return {
      id: "fallback-" + Math.random().toString(36).slice(2),
      exam: "GRE",
      section: "Quant",
      mode: "random",
      topic: "Unknown",
      difficulty: "medium",
      stemHTML:
        "Malformed question source. Showing a safe fallback while you fix the bank/core.",
      options: [
        { id: 0, html: "Continue" },
        { id: 1, html: "Next" },
      ],
      correct: [0],
      explainHTML:
        "Your raw question object was missing required fields. The normalizer returned a safe fallback.",
      kind: "mcq",
      quantityA: null,
      quantityB: null,
      badge: undefined,
      meta: { error: (error as any)?.message ?? "normalize error" },
    };
  }
}
