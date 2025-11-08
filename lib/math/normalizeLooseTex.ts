const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;

const COMMANDS_WITH_BRACE = [
  "begin",
  "end",
  "text",
  "textbf",
  "textit",
  "mathrm",
  "operatorname",
];

const SIMPLE_COMMANDS = [
  "frac",
  "sqrt",
  "pi",
  "times",
  "cdot",
  "div",
  "pm",
  "leq",
  "geq",
  "neq",
  "approx",
  "theta",
  "alpha",
  "beta",
  "gamma",
  "delta",
  "lambda",
  "mu",
  "sigma",
  "rho",
  "phi",
  "varphi",
  "omega",
  "sum",
  "int",
  "lim",
  "log",
  "ln",
  "tan",
  "sin",
  "cos",
  "cot",
  "sec",
  "csc",
];

const SPECIFIC_FIXES: Array<[RegExp, string]> = [
  [/\\\s*ext/gi, "\\text"],
  [/\\\s*mathrm/gi, "\\mathrm"],
  [/\\\s*operatorname/gi, "\\operatorname"],
];

const ASCIIMATH_PATTERNS: Array<[RegExp, string | ((...matches: string[]) => string)]> = [
  [
    /sum_\s*\(\s*([^=]+)=([^)]*?)\)\s*\^([\w.+-]+)/gi,
    (_m, variable, lower, upper) =>
      `\\sum_{${variable.trim()}=${lower.trim()}}^{${upper.trim()}}`,
  ],
  [
    /prod_\s*\(\s*([^=]+)=([^)]*?)\)\s*\^([\w.+-]+)/gi,
    (_m, variable, lower, upper) =>
      `\\prod_{${variable.trim()}=${lower.trim()}}^{${upper.trim()}}`,
  ],
  [
    /int_\s*\(\s*([^=]+)=([^)]*?)\)\s*\^([\w.+-]+)/gi,
    (_m, variable, lower, upper) =>
      `\\int_{${lower.trim()}}^{${upper.trim()}} \\! d${variable.trim()}`,
  ],
  [
    /\\?sqrt\(\s*([^)]+?)\s*\)/gi,
    (_m, inner) => `\\sqrt{${inner.trim()}}`,
  ],
  [
    /abs\(\s*([^)]+?)\s*\)/gi,
    (_m, inner) => `\\left|${inner.trim()}\\right|`,
  ],
  [
    /([A-Za-z0-9])_\(\s*([^)]+?)\s*\)/g,
    (_m, base, sub) => `${base}_{${sub.trim()}}`,
  ],
  [
    /([A-Za-z0-9])\^\(\s*([^)]+?)\s*\)/g,
    (_m, base, sup) => `${base}^{${sup.trim()}}`,
  ],
  [
    /([0-9A-Za-z]+)\s*\/\s*([0-9A-Za-z]+)/g,
    (_m, num, den) => `\\frac{${num.trim()}}{${den.trim()}}`,
  ],
];

export function normalizeLooseTex(value: string): string {
  if (!value) return value;

  let text = value.replace(CONTROL_CHARS_REGEX, "");

  for (const [pattern, replacement] of SPECIFIC_FIXES) {
    text = text.replace(pattern, replacement);
  }

  for (const cmd of COMMANDS_WITH_BRACE) {
    const regex = new RegExp(`(^|[^\\\\])${cmd}\\s*\\{`, "gi");
    text = text.replace(regex, (match, prefix) => `${prefix}\\${cmd}{`);
  }

  for (const cmd of SIMPLE_COMMANDS) {
    const regex = new RegExp(`(^|[^\\\\])${cmd}(?=\\b)`, "gi");
    text = text.replace(regex, (match, prefix) => `${prefix}\\${cmd}`);
  }

  // Common missing-letter/typo fixes
  // 'egin{...}' -> '\\begin{...}'
  text = text.replace(/(^|\s)egin\s*\{/gi, (_m, pre) => `${pre}\\begin{`);
  // 'nd{...}' -> '\\end{...}'
  text = text.replace(/(^|\s)nd\s*\{/gi, (_m, pre) => `${pre}\\end{`);
  // 'rac{...}{...}' -> '\\frac{...}{...}'
  text = text.replace(/(^|[^a-z])rac\s*\{/gi, (m, pre) => `${pre}\\frac{`);
  // ' ext{...}' (missing backslash) -> '\\text{...}'
  text = text.replace(/(^|[^\\])ext\s*\{/gi, (_m, pre) => `${pre}\\text{`);
  // Fix broken 'point' that became 'po\\int'
  text = text.replace(/po\\int/gi, "point");
  // Remove stray backslashes before spaces or punctuation
  text = text.replace(/\\(?=\s|[,.!?;:])/g, "");
  // Remove stray backslashes before capitalized words not commands (e.g., \\Next)
  text = text.replace(/\\([A-Z][a-z]+)/g, (_m, word) => word);

  // Convert patterns like \text{\sqrt}(...) -> \sqrt{...}
  text = text.replace(/\\text\{\s*\\?sqrt\s*\}\s*\(\s*([^)]+?)\s*\)/gi, (_m, inner) => `\\sqrt{${inner.trim()}}`);
  // Convert patterns like \text{\sqrt}\s*{...} -> \sqrt{...}
  text = text.replace(/\\text\{\s*\\?sqrt\s*\}\s*\{\s*([^}]+?)\s*\}/gi, (_m, inner) => `\\sqrt{${inner.trim()}}`);

  for (const [pattern, replacement] of ASCIIMATH_PATTERNS) {
    text = text.replace(pattern, replacement as any);
  }

  return text;
}
