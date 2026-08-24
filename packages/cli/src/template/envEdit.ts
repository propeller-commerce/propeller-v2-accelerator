/**
 * Surgical edits to a scaffolded shop's env example file.
 *
 * The boilerplates ship one `.env.local.example` / `.env.example` documenting
 * EVERY capability (both PSPs, machines, CMS, …) with the optional ones
 * commented out. A scaffold that removed a capability should not leave its
 * credentials block behind as a to-do the shop owner can never satisfy — the
 * package isn't installed and the routes are gone.
 *
 * Two primitives, both line-based so they work identically across the three
 * boilerplates' env files:
 *
 *   - `setEnvVar`   — set a key's value, uncommenting it if the boilerplate
 *     ships it commented out (`# PAYMENT_PROVIDER=mollie`). No-op when the key
 *     isn't present at all, so an older boilerplate never breaks the scaffold.
 *   - `removeEnvKeys` — delete every (commented or live) assignment whose key
 *     matches a predicate, together with the comment lines documenting it, and
 *     then any `# ── Section ──` heading left with nothing under it.
 *
 * Both are deliberately forgiving: env examples are documentation, and a
 * scaffold must never fail because a comment moved.
 */

/** Matches `KEY=…` and `# KEY=…` (the boilerplates' commented-out style). */
const ASSIGNMENT = /^(\s*#\s*)?([A-Z][A-Z0-9_]*)\s*=/;
/** Matches the boilerplates' section headings: `# ── Title ─────…`. */
const SECTION_HEADING = /^#\s*─{2,}/;

/**
 * Set `KEY=value`, uncommenting the line if needed. Returns the env text
 * unchanged when the key doesn't appear.
 *
 * Only the FIRST occurrence is set; later ones are dropped. The Next
 * boilerplate documents `PAYMENT_PROVIDER` once per PSP section (commented out,
 * one showing `=mollie` and one `=multisafepay`), and writing the chosen value
 * into both would leave the file with two live assignments of the same key.
 */
export function setEnvVar(env: string, key: string, value: string): string {
  const lines = env.split('\n');
  let found = false;
  const out: string[] = [];
  for (const line of lines) {
    const m = ASSIGNMENT.exec(line);
    if (!m || m[2] !== key) {
      out.push(line);
      continue;
    }
    if (found) continue; // duplicate documentation of the same key — drop it
    found = true;
    out.push(`${key}=${value}`);
  }
  return found ? collapseBlankRuns(out).join('\n') : env;
}

/**
 * Remove every assignment whose key matches `matches`, the contiguous comment
 * lines immediately above it (its documentation), and any section heading that
 * ends up with no assignments beneath it.
 *
 * Keys that don't match are never touched — which is why this is key-level and
 * not "delete the whole Payments section": in the Next boilerplate that section
 * also carries `ON_ACCOUNT_PAYMENTS` and `NEXT_PUBLIC_CURRENCY_CODE`, which a
 * no-PSP shop still needs.
 */
export function removeEnvKeys(env: string, matches: (key: string) => boolean): string {
  const lines = env.split('\n');
  const drop = new Array<boolean>(lines.length).fill(false);

  lines.forEach((line, i) => {
    const m = ASSIGNMENT.exec(line);
    if (!m || !matches(m[2])) return;
    drop[i] = true;
    // Walk up over this key's own doc comment. Stop at a blank line (end of the
    // block), a section heading (belongs to the section, not the key), or a
    // line already dropped.
    for (let j = i - 1; j >= 0; j -= 1) {
      const above = lines[j];
      if (above.trim() === '' || SECTION_HEADING.test(above)) break;
      if (!above.trimStart().startsWith('#')) break;
      // A commented assignment above is another key's line — it drops on its
      // own pass if it matches, so don't claim it here.
      if (ASSIGNMENT.test(above)) break;
      drop[j] = true;
    }
  });

  // Drop headings whose section no longer has any assignment left.
  lines.forEach((line, i) => {
    if (!SECTION_HEADING.test(line) || drop[i]) return;
    let hasContent = false;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (SECTION_HEADING.test(lines[j])) break;
      if (!drop[j] && ASSIGNMENT.test(lines[j])) {
        hasContent = true;
        break;
      }
    }
    if (!hasContent) {
      drop[i] = true;
      // Take the section's surviving prose with it — it documents nothing now.
      for (let j = i + 1; j < lines.length; j += 1) {
        if (SECTION_HEADING.test(lines[j])) break;
        if (lines[j].trim() === '' || lines[j].trimStart().startsWith('#')) {
          drop[j] = true;
        } else {
          break;
        }
      }
    }
  });

  const kept = lines.filter((_, i) => !drop[i]);
  return collapseBlankRuns(kept).join('\n');
}

/** Squeeze runs of 2+ blank lines left behind by deletions down to one. */
function collapseBlankRuns(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (line.trim() === '' && out.length > 0 && out[out.length - 1].trim() === '') continue;
    out.push(line);
  }
  return out;
}
