/**
 * `propeller check-anchors` — validate this package's text-patch anchors
 * against a boilerplate checkout.
 *
 * Why this is a shipped command and not just the repo's own
 * `scripts/check-textpatches.mjs`:
 *
 * A text patch anchors on a verbatim snippet of boilerplate source, so it can
 * be broken from EITHER side. The repo script guards our side — it runs in the
 * accelerator's CI and on `prepublishOnly`, so we cannot publish a CLI whose
 * anchors are already stale. It cannot guard the other side: once a version is
 * published, a later boilerplate commit can invalidate an anchor that was
 * correct when it shipped, and nothing notices until a user scaffolds.
 *
 * That is exactly what happened. 0.9.0 published on 20 Aug with anchors that
 * matched; the tracking work landed on the Vue and Nuxt boilerplates on 21 Aug
 * and added `watch` to the cart import line that one patch prunes. The gate had
 * already run and passed. The published CLI broke retroactively.
 *
 * So the boilerplates need to run this too, against the CLI version their users
 * actually get. Then the failure lands in the pipeline of the change that
 * caused it, in front of the person making it, instead of in a bug report a
 * week later.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Where the boilerplate's app root sits inside its repo. */
const SUBPATH: Record<string, string> = { next: '.', vue: 'frontend', nuxt: '.' };

export interface CheckAnchorsOptions {
  /** Stack whose patches to check. */
  stack: string;
  /** Boilerplate checkout root (the repo root, not the app sub-path). */
  boilerplate: string;
  /** Override the templates directory (defaults to this package's own). */
  templates?: string;
}

/** Resolve this package's `templates/` — published layout first, then dev. */
function resolveTemplatesRoot(): string {
  if (process.env.PROPELLER_TEMPLATES_DIR) return process.env.PROPELLER_TEMPLATES_DIR;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const published = path.resolve(here, '..', '..', 'templates');
  if (existsSync(published)) return published;
  return path.resolve(here, '..', '..', '..', '..', 'templates');
}

/** Every `*.textpatch.json` under a directory, recursively. */
function findPatches(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...findPatches(full));
    else if (entry.endsWith('.textpatch.json')) out.push(full);
  }
  return out;
}

/** Line endings are not part of an anchor; the applier normalises too. */
function readNormalised(file: string): string {
  return readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

/**
 * Returns the number of problems found. 0 means every anchor still matches.
 */
export function runCheckAnchors(options: CheckAnchorsOptions): number {
  const { stack } = options;
  const subpath = SUBPATH[stack];
  if (!subpath) {
    // eslint-disable-next-line no-console
    console.error(`x unknown stack '${stack}' (expected next, vue or nuxt)`);
    return 1;
  }

  const templateRoot = path.join(options.templates ?? resolveTemplatesRoot(), `shop-${stack}`);
  const patches = findPatches(templateRoot);
  if (patches.length === 0) {
    // eslint-disable-next-line no-console
    console.error(`x no text patches found under ${templateRoot}`);
    return 1;
  }

  const appRoot = path.resolve(options.boilerplate, subpath);
  // eslint-disable-next-line no-console
  console.log(`- ${stack}: ${patches.length} patch(es) against ${appRoot}`);

  let problems = 0;
  let checked = 0;

  for (const patchPath of patches) {
    // templates/shop-<stack>/<overlay>/<relative path>.textpatch.json
    const fromOverlay = path
      .relative(templateRoot, patchPath)
      .split(path.sep)
      .slice(1)
      .join('/');
    const rel = fromOverlay.slice(0, -'.textpatch.json'.length);

    let source: string;
    try {
      source = readNormalised(path.join(appRoot, rel));
    } catch {
      // eslint-disable-next-line no-console
      console.error(`  x ${rel} - the patch has no target in the boilerplate`);
      problems += 1;
      continue;
    }

    const patch = JSON.parse(readNormalised(patchPath)) as {
      replace?: Array<{ find: string }>;
    };
    for (const [i, op] of (patch.replace ?? []).entries()) {
      checked += 1;
      // Matching everywhere is intended (the applier replaces all occurrences);
      // matching NOWHERE is the drift this exists to catch.
      const find = op.find.replace(/\r\n/g, '\n');
      if (!source.includes(find)) {
        const first = find.split('\n').find((l) => l.trim()) ?? find;
        // eslint-disable-next-line no-console
        console.error(`  x ${rel} op#${i} - anchor not found: ${first.trim().slice(0, 90)}`);
        problems += 1;
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log('');
  if (problems > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `${problems} stale anchor(s) of ${checked}. A scaffold with these patches fails for the user.\n` +
        'Either re-cut the anchor in the accelerator, or keep the boilerplate lines the patch depends on.'
    );
    return problems;
  }
  // eslint-disable-next-line no-console
  console.log(`All ${checked} text-patch anchor(s) match this boilerplate.`);
  return 0;
}
