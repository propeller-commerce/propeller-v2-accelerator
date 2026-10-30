/**
 * Merge a generated README with the one it would otherwise overwrite, so the
 * generated summary sits on top and every original section survives below.
 */

/** Generated text first, then the original under an h2 `heading`, its headings nested beneath it. */
export function combineReadme(generated: string, original: string, heading: string): string {
  const body = demoteHeadings(original.replace(/^﻿/, ''), 2).trim();
  if (!body) return generated;
  return `${generated.replace(/\s*$/, '')}\n\n---\n\n## ${heading}\n\n${body}\n`;
}

/** Push every ATX heading `by` levels deeper (capped at h6), leaving code fences alone. */
function demoteHeadings(markdown: string, by: number): string {
  let fence: string | null = null;
  return markdown
    .split(/\r?\n/)
    .map((line) => {
      const f = /^\s*(`{3,}|~{3,})/.exec(line);
      if (f) {
        if (fence === null) fence = f[1][0];
        else if (f[1][0] === fence) fence = null;
        return line;
      }
      if (fence !== null) return line;
      return line.replace(/^(#{1,6})(?=\s)/, (h) => '#'.repeat(Math.min(6, h.length + by)));
    })
    .join('\n');
}
