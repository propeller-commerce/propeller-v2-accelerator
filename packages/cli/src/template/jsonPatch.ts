/**
 * Merge JSON patch files onto an existing JSON file.
 *
 * Overlay model: instead of an overlay `package.json` that REPLACES the
 * boilerplate's `package.json` (which drags the overlay's stale dependency
 * versions over the boilerplate's up-to-date ones — exactly the drift the
 * clone-and-overlay redesign was supposed to fix), we ship overlay patches
 * named `<filename>.patch.json`. The CLI reads the cloned boilerplate's
 * `<filename>.json`, deep-merges the patch on top, and writes the result
 * back. The boilerplate's version always wins for anything the patch
 * doesn't explicitly override.
 *
 * Semantics:
 *   - Plain values overwrite.
 *   - Arrays REPLACE the boilerplate's array. (Mixing-by-index would be
 *     surprising; if you need additive arrays, ask in a code review.)
 *   - Nested objects deep-merge.
 *   - To DELETE a key (e.g. remove a script from the boilerplate's scripts),
 *     set its value to `null` in the patch.
 *   - Handlebars tokens (`{{shopName}}`) in the patch are rendered before
 *     the merge.
 *   - A top-level `_comment` documents the patch for maintainers and is
 *     dropped before merging (same convention as the trim manifests and
 *     `.textpatch.json` files) — it never lands in the scaffolded shop.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { renderTemplate, type SubstitutionContext } from './substitute';

const PATCH_SUFFIX = '.patch.json';

/** Does this overlay path identify a JSON patch (not a literal file)? */
export function isJsonPatch(name: string): boolean {
  return name.endsWith(PATCH_SUFFIX);
}

/** Strip `.patch.json` and replace with `.json` for the target filename. */
export function jsonPatchTargetName(name: string): string {
  return name.slice(0, -PATCH_SUFFIX.length) + '.json';
}

/**
 * Apply a `.patch.json` overlay to an existing JSON file in the destination.
 * Throws if the target doesn't exist (the boilerplate is supposed to ship
 * the base file — if it doesn't, the overlay author has the wrong assumption).
 */
export async function applyJsonPatch(args: {
  patchPath: string;
  targetPath: string;
  ctx: SubstitutionContext;
}): Promise<void> {
  const patchRaw = await fs.readFile(args.patchPath, 'utf8');
  const patchRendered = renderTemplate(patchRaw, args.ctx);
  let patch: unknown;
  try {
    patch = JSON.parse(patchRendered);
  } catch (e) {
    throw new Error(
      `JSON patch ${args.patchPath} is not valid JSON after rendering: ${(e as Error).message}`
    );
  }
  // Maintainer note, not shop content.
  if (patch && typeof patch === 'object' && !Array.isArray(patch)) {
    delete (patch as Record<string, unknown>)._comment;
  }

  let target: unknown;
  try {
    const targetRaw = await fs.readFile(args.targetPath, 'utf8');
    target = JSON.parse(targetRaw);
  } catch (e) {
    throw new Error(
      `Cannot apply patch ${path.basename(args.patchPath)}: target ${args.targetPath} ` +
        `missing or unparseable. The boilerplate is supposed to ship this file. ` +
        `(${(e as Error).message})`
    );
  }

  const merged = deepMerge(target, patch);
  await fs.writeFile(args.targetPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
}

/**
 * Deep-merge `patch` onto `base`. See module doc for semantics.
 * Exported for unit testing.
 */
export function deepMerge(base: unknown, patch: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return patch; // arrays + primitives + mismatched shapes → replace
  }
  const out: Record<string, unknown> = { ...base };
  for (const [key, patchValue] of Object.entries(patch)) {
    if (patchValue === null) {
      delete out[key];
      continue;
    }
    if (isPlainObject(out[key]) && isPlainObject(patchValue)) {
      out[key] = deepMerge(out[key], patchValue);
    } else {
      out[key] = patchValue;
    }
  }
  return out;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
