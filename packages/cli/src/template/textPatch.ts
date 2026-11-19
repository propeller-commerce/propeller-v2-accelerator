/**
 * Apply surgical find/replace patches to non-JSON boilerplate files.
 *
 * Sibling of `jsonPatch.ts`. The clone-and-overlay model deliberately avoids
 * REPLACING boilerplate files wholesale — a whole-file overlay freezes the
 * accelerator's copy against future boilerplate edits and re-introduces the
 * exact drift the redesign removed. For JSON that means deep-merge patches;
 * for source files (`.vue`, `.ts`) that means small string replacements.
 *
 * An overlay file named `<filename>.textpatch.json` carries a list of
 * find/replace operations applied to the cloned boilerplate's `<filename>`:
 *
 *   {
 *     "_comment": "why this patch exists",
 *     "replace": [
 *       { "find": "exact source snippet", "with": "replacement" }
 *     ]
 *   }
 *
 * Semantics:
 *   - Each `find` must match the target EXACTLY (whitespace included) and is
 *     replaced everywhere it occurs. A `find` that matches nothing is a hard
 *     error — a silently-ineffective patch means the boilerplate moved and the
 *     patch is stale, which is precisely what we want surfaced at scaffold time.
 *   - `find` may be an ARRAY of alternatives; the first one present wins, and
 *     only "none matched" is stale. This is what makes an anchored boilerplate
 *     line changeable at all. The anchor and the line live in repos that release
 *     separately — the boilerplate's `check_anchors` runs the PUBLISHED CLI,
 *     while this repo's `check:textpatches` reads the PUBLIC MIRROR — so for one
 *     change each side must satisfy both the old and new state of the other, and
 *     no ordering does that with a single anchor. List the new form first, keep
 *     the old until it is gone from the mirror, then drop it.
 *   - `with: ""` deletes the matched snippet.
 *   - `until` (string or alternatives, optional) turns the op into a SPAN
 *     replace: from the first `find` match up to — not including — the first
 *     `until` match after it. Use it to drop a clearly delimited block (e.g.
 *     everything from one section-header comment to the next) with two short
 *     anchors instead of a verbatim copy of the whole block, which would go
 *     stale on any edit inside it. Missing `until` after the start is stale too.
 *   - `with` is rendered through Handlebars first, so an inserted line can
 *     carry `{{shopName}}`. `find` is NOT rendered: an anchor is a verbatim
 *     copy of boilerplate source, and Vue's `{{ … }}` interpolation would
 *     otherwise be resolved as a template token and throw.
 *   - Operations apply in order, so a later `find` can match text a previous
 *     `with` introduced.
 *
 * Use this for the handful of files that merely REFERENCE an excised feature
 * (e.g. a `/blog` nav link in a 400-line header) — not as a substitute for
 * deleting dedicated files (use the trim manifest) or for whole new files
 * (use a plain overlay file).
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { renderTemplate, type SubstitutionContext } from './substitute';

const PATCH_SUFFIX = '.textpatch.json';

/** Does this overlay path identify a text patch (not a literal file)? */
export function isTextPatch(name: string): boolean {
  return name.endsWith(PATCH_SUFFIX);
}

/** Strip `.textpatch.json` to recover the target filename it patches. */
export function textPatchTargetName(name: string): string {
  return name.slice(0, -PATCH_SUFFIX.length);
}

export interface TextPatchOp {
  /**
   * The snippet to replace, or an ARRAY of alternatives of which the first one
   * present in the target wins. See the header note on release ordering.
   */
  find: string | string[];
  /** Optional end marker (kept) — makes the op replace the span `find`…`until`. */
  until?: string | string[];
  with: string;
}

const alternatives = (v: string | string[]): string[] =>
  (Array.isArray(v) ? v : [v]).map((s) => s.replace(/\r\n/g, '\n'));

/**
 * Where an op applies in an LF-normalised `source`: the chosen `find`, and for a
 * span op the `[start, end)` range up to the `until` marker. `null` when the op
 * is stale (no `find` present, or no `until` after it). Shared with
 * `propeller check-anchors` so both judge an anchor the same way.
 */
export function locateTextPatchOp(
  source: string,
  op: Pick<TextPatchOp, 'find' | 'until'>
): { find: string; span?: [number, number] } | null {
  const find = alternatives(op.find).find((c) => source.includes(c));
  if (find === undefined) return null;
  if (op.until === undefined) return { find };
  const start = source.indexOf(find);
  const from = start + find.length;
  const ends = alternatives(op.until)
    .map((u) => source.indexOf(u, from))
    .filter((i) => i !== -1);
  return ends.length > 0 ? { find, span: [start, Math.min(...ends)] } : null;
}

/**
 * Apply a `.textpatch.json` overlay to an existing file in the destination.
 * Throws if the target doesn't exist, the patch is malformed, or any `find`
 * matches nothing (a stale patch).
 */
export async function applyTextPatch(args: {
  patchPath: string;
  targetPath: string;
  ctx: SubstitutionContext;
}): Promise<void> {
  const patchRaw = await fs.readFile(args.patchPath, 'utf8');
  let patch: { replace?: TextPatchOp[] };
  try {
    patch = JSON.parse(patchRaw) as { replace?: TextPatchOp[] };
  } catch (e) {
    throw new Error(
      `Text patch ${args.patchPath} is not valid JSON: ${(e as Error).message}`
    );
  }

  let raw: string;
  try {
    raw = await fs.readFile(args.targetPath, 'utf8');
  } catch (e) {
    throw new Error(
      `Cannot apply patch ${path.basename(args.patchPath)}: target ` +
        `${args.targetPath} missing. The boilerplate is supposed to ship this ` +
        `file. (${(e as Error).message})`
    );
  }

  // Match in LF-space so patches authored with LF snippets apply regardless of
  // the target's on-disk line endings (Windows git checkouts / autocrlf give
  // CRLF). Restore the target's original ending convention on write so the
  // scaffolded file keeps the boilerplate's style.
  const hadCrlf = raw.includes('\r\n');
  let target = raw.replace(/\r\n/g, '\n');

  for (const op of patch.replace ?? []) {
    // `find` is LITERAL — never rendered. An anchor is a verbatim copy of the
    // boilerplate, so its content is not the patch author's to choose, and Vue
    // templates are full of `{{ … }}` interpolation that Handlebars then tries
    // to resolve: anchoring on the PunchOut block in `CartView.vue` blew up
    // with `"punchoutIntro" not defined` the moment that block was localized
    //. `with` IS still rendered — that text is the author's, so
    // `{{shopName}}` in an inserted line keeps working.
    const replacement = renderTemplate(op.with, args.ctx).replace(/\r\n/g, '\n');
    const hit = locateTextPatchOp(target, op);
    if (hit === null) {
      const candidates = alternatives(op.find);
      const ends = op.until === undefined ? [] : alternatives(op.until);
      throw new Error(
        `Text patch ${path.basename(args.patchPath)} is stale: ` +
          (candidates.length > 1
            ? `none of its ${candidates.length} alternative snippets were found in `
            : `the snippet it expected to find in `) +
          `${path.basename(args.targetPath)}` +
          (ends.length > 0 ? ' (or its `until` end marker after it)' : '') +
          `. The boilerplate likely changed — ` +
          `update the patch.\nMissing snippet${candidates.length > 1 ? 's' : ''}:\n` +
          [...candidates, ...ends.map((u) => `until: ${u}`)].join('\n  --- or ---\n')
      );
    }
    target = hit.span
      ? target.slice(0, hit.span[0]) + replacement + target.slice(hit.span[1])
      : target.split(hit.find).join(replacement);
  }

  const out = hadCrlf ? target.replace(/\n/g, '\r\n') : target;
  await fs.writeFile(args.targetPath, out, 'utf8');
}
