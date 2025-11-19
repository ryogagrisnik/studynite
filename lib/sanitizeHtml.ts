// lib/sanitizeHtml.ts
// Very conservative server-side HTML sanitizer to reduce XSS risk while
// preserving KaTeX/MathML output. Not a full HTML parser, but adequate for
// our controlled content pipeline.

const DANGEROUS_BLOCK_TAGS = [
  'script', 'iframe', 'object', 'embed', 'link', 'meta', 'style',
  'form', 'input', 'button', 'textarea', 'noscript', 'base',
  // Strip heavy MathML/SVG blocks if they slipped in from server rendering.
  // We always render math on the client from plain LaTeX, so these are unnecessary
  // and often break layout or leak unreadable markup.
  'svg', 'math', 'semantics', 'annotation', 'annotation-xml',
  'mrow', 'mi', 'mn', 'mo', 'msup', 'msub', 'msubsup', 'mfrac', 'msqrt', 'mover', 'munder', 'munderover',
  // MathJax v3 container tags
  'mjx-container', 'mjx-assistive-mml'
];

const JS_URI_PATTERN = /^(?:javascript:|data:(?!image\/))/i;

function stripDangerousBlocks(html: string): string {
  let out = html;
  for (const tag of DANGEROUS_BLOCK_TAGS) {
    const re = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\/${tag}>`, 'gi');
    out = out.replace(re, '');
    const reSelf = new RegExp(`<${tag}[^>]*\/?>`, 'gi');
    out = out.replace(reSelf, '');
  }
  return out;
}

function stripEventHandlers(html: string): string {
  // remove on*="..." and on*='...' and on*=bare
  return html
    .replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, '');
}

function sanitizeUrls(html: string): string {
  // sanitize href/src attributes with javascript: or disallowed data:
  return html
    .replace(/\s(href|src)\s*=\s*"([^"]*)"/gi, (_m, attr, val) => {
      const v = String(val).trim();
      if (JS_URI_PATTERN.test(v)) return ` ${attr}="#"`;
      return ` ${attr}="${v}"`;
    })
    .replace(/\s(href|src)\s*=\s*'([^']*)'/gi, (_m, attr, val) => {
      const v = String(val).trim();
      if (JS_URI_PATTERN.test(v)) return ` ${attr}='#'`;
      return ` ${attr}='${v}'`;
    })
    .replace(/\s(href|src)\s*=\s*([^\s>]+)/gi, (_m, attr, val) => {
      const v = String(val).trim();
      if (JS_URI_PATTERN.test(v)) return ` ${attr}="#"`;
      return ` ${attr}="${v}"`;
    });
}

function hardenAnchorTargets(html: string): string {
  // ensure rel on target=_blank links
  return html.replace(/<a(\s[^>]*?)>/gi, (m, attrs) => {
    let a = attrs || '';
    // remove any javascript: href already handled in sanitizeUrls
    if (!/\brel\s*=/.test(a)) {
      a += ' rel="nofollow noopener noreferrer"';
    }
    return `<a${a}>`;
  });
}

export function sanitizeHtml(input?: string | null): string | undefined {
  if (!input) return input ?? undefined;
  let html = String(input);
  html = stripDangerousBlocks(html);
  html = stripEventHandlers(html);
  html = sanitizeUrls(html);
  html = hardenAnchorTargets(html);
  return html;
}

export default sanitizeHtml;
