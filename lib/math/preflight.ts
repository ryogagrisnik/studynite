// lib/math/preflight.ts

/**
 * Pre-flight math normalizer: fixes common typos and malformed LaTeX-like
 * fragments before we render. Returns the fixed text and a list of issues
 * it corrected (best-effort, non-exhaustive).
 */
export function preflightFixMath(raw: string): { text: string; issues: string[] } {
  let s = String(raw ?? "");
  const issues: string[] = [];

  const apply = (desc: string, re: RegExp, repl: string | ((...m: any[]) => string)) => {
    const before = s;
    s = s.replace(re, repl as any);
    if (s !== before) issues.push(desc);
  };

  // nom{n}{k} -> \binom{n}{k}
  apply("nom->binom", /\bnom\s*\{/gi, '\\binom{');

  // C(n,k) -> \binom{n}{k}
  apply("C(n,k)->binom", /\bC\s*\(\s*([^,()]+)\s*,\s*([^()]+)\s*\)/g, (_m, n, k) => `\\binom{${n.trim()}}{${k.trim()}}`);

  // (n choose k) -> \binom{n}{k}
  apply("choose->binom", /\b([0-9A-Za-z]+)\s+choose\s+([0-9A-Za-z]+)/gi, (_m, n, k) => `\\binom{${n}}{${k}}`);

  // '{...}{...}' not preceded by \frac -> coerce to \frac{...}{...}
  apply("brace-pair->frac",
    /(^|[^\\])\{\s*([^{}]+?)\s*\}\s*\{\s*([^{}]+?)\s*\}/g,
    (_m, pre, a, b) => `${pre}\\frac{${a.trim()}}{${b.trim()}}`
  );

  // ext{...} -> \text{...}
  apply("ext->text", /(^|[^\\])ext\s*\{/gi, (_m, pre) => `${pre}\\text{`);

  // \text{\sqrt}(...) or \text{\sqrt}{...} -> \sqrt{...}
  apply("text-sqrt()", /\\text\{\s*\\?sqrt\s*\}\s*\(\s*([^)]+?)\s*\)/gi, (_m, inner) => `\\sqrt{${String(inner).trim()}}`);
  apply("text-sqrt{}", /\\text\{\s*\\?sqrt\s*\}\s*\{\s*([^}]+?)\s*\}/gi, (_m, inner) => `\\sqrt{${String(inner).trim()}}`);

  // Remove English commentary accidentally placed inside braces between two math groups before '='
  apply("strip stray commentary inside braces", /\}\s*[^{}=]{3,80}?\s*(?==)/g, '} ');

  // Collapse repeated punctuation
  apply("dedupe punctuation", /\.{2,}/g, '.');

  // EXTRA salvage: align* -> aligned (KaTeX-friendly)
  apply("align*->aligned", /\\begin\{align\*\}/g, '\\begin{aligned}');
  apply("end align*->aligned", /\\end\{align\*\}/g, '\\end{aligned}');

  // Collapse repeated 'frac' tokens and fix common missing backslashes
  apply("collapse repeated frac", /(\\frac\s*){2,}/g, '\\frac ');
  apply("rac->\\frac", /(^|[^a-z])rac\b/gi, (_m, pre) => `${pre}\\frac`);
  apply("imes->\\times", /(^|[^\\])imes\b/gi, (_m, pre) => `${pre}\\times`);
  apply("strip \\t", /\\t+/g, ' ');
  apply("strip tabs", /\t+/g, ' ');

  return { text: s, issues };
}
