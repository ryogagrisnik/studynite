'use client';

import { useEffect } from 'react';
import type { RefObject } from 'react';

let mathJaxPromise: Promise<void> | null = null;

function loadMathJax(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  const global = window as typeof window & { MathJax?: any };
  if (global.MathJax?.typesetPromise) {
    return global.MathJax.startup?.promise ?? Promise.resolve();
  }

  if (mathJaxPromise) return mathJaxPromise;

  mathJaxPromise = new Promise((resolve) => {
    if (!global.MathJax) {
      global.MathJax = {
        tex: {
          inlineMath: [
            ['\\(', '\\)'],
            ['$', '$'],
          ],
          displayMath: [
            ['\\[', '\\]'],
            ['$$', '$$'],
          ],
          processEscapes: true,
        },
        svg: {
          fontCache: 'global',
        },
        startup: {
          typeset: false,
        },
      };
    }

    const existing = document.getElementById('mathjax-script');
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.id = 'mathjax-script';
    script.type = 'text/javascript';
    script.async = true;
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
    script.onload = () => {
      const MJ = global.MathJax;
      if (MJ?.startup?.promise) {
        MJ.startup.promise
          .then(() => resolve())
          .catch((err: unknown) => {
            console.warn('[MathJax] startup failed', err);
            resolve();
          });
      } else {
        resolve();
      }
    };
    script.onerror = () => {
      console.warn('[MathJax] failed to load from CDN');
      resolve();
    };

    document.head.appendChild(script);
  });

  return mathJaxPromise;
}

export function useMathJax(
  ref: RefObject<HTMLElement | null>,
  deps: React.DependencyList
) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = ref.current;
    if (!root) return;

    loadMathJax()
      .then(() => {
        const MJ = (window as any).MathJax;
        if (!MJ?.typesetPromise) return;
        MJ.typesetPromise([root]).catch((err: unknown) => {
          console.warn('[MathJax] typeset failed', err);
        });
      })
      .catch((err) => {
        console.warn('[MathJax] load error', err);
      });
  }, deps);
}
