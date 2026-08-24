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
 *   - `with: ""` deletes the matched snippet.
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

interface TextPatchOp {
  find: string;
  with: string;
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
    const find = op.find.replace(/\r\n/g, '\n');
    const replacement = renderTemplate(op.with, args.ctx).replace(/\r\n/g, '\n');
    if (!target.includes(find)) {
      throw new Error(
        `Text patch ${path.basename(args.patchPath)} is stale: the snippet ` +
          `it expected to find in ${path.basename(args.targetPath)} is no ` +
          `longer present. The boilerplate likely changed — update the patch.\n` +
          `Missing snippet:\n${find}`
      );
    }
    target = target.split(find).join(replacement);
  }

  const out = hadCrlf ? target.replace(/\n/g, '\r\n') : target;
  await fs.writeFile(args.targetPath, out, 'utf8');
}
