#!/usr/bin/env node
/**
 * Fail the build when a `.textpatch.json` anchor no longer matches the
 * boilerplate it patches.
 *
 * The patches deliberately use exact-string anchors so a stale one throws
 * instead of silently applying nothing. But that throw happens at SCAFFOLD
 * time, i.e. in front of the user: one stale anchor left `--stack=vue`
 * could not run at all, because a boilerplate commit had added
 * `meta: { ssrKey }` to the blog routes and nothing on our side noticed. The
 * design was right; the feedback loop was pointed at the wrong person.
 *
 * This moves the same check to our side. Run it in CI and before publishing.
 *
 * Boilerplate source, per stack, in order:
 *   1. `PROPELLER_<STACK>_BOILERPLATE_LOCAL` — a checkout on disk (the same env
 *      var the CLI itself honours), for when a boilerplate change and the patch
 *      that follows it are both still unpushed.
 *   2. a shallow clone of the public boilerplate at `--ref` (default master).
 *
 * Usage:
 *   node scripts/check-textpatches.mjs [--ref <branch|tag>] [--stack <stack>]
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

const STACKS = {
  next: {
    repo: 'https://github.com/propeller-commerce/propeller-v2-next-boilerplate.git',
    subpath: '.',
    env: 'PROPELLER_NEXT_BOILERPLATE_LOCAL',
  },
  vue: {
    repo: 'https://github.com/propeller-commerce/propeller-v2-vue-boilerplate.git',
    subpath: 'frontend',
    env: 'PROPELLER_VUE_BOILERPLATE_LOCAL',
  },
  nuxt: {
    repo: 'https://github.com/propeller-commerce/propeller-v2-nuxt-boilerplate.git',
    subpath: '.',
    env: 'PROPELLER_NUXT_BOILERPLATE_LOCAL',
  },
};

const args = process.argv.slice(2);
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
};
const ref = valueOf('--ref') ?? 'master';
const onlyStack = valueOf('--stack');

/** Every `*.textpatch.json` under a directory, recursively. */
function findPatches(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...findPatches(full));
    else if (e.name.endsWith('.textpatch.json')) out.push(full);
  }
  return out;
}

/** Resolve a boilerplate checkout, cloning into a temp dir when needed. */
function resolveBoilerplate(stack, spec) {
  const local = process.env[spec.env];
  if (local) {
    const root = path.resolve(local, spec.subpath === '.' ? '' : spec.subpath);
    statSync(root);
    return { root, cleanup: () => {}, origin: `${spec.env}=${local}` };
  }
  const dir = mkdtempSync(path.join(tmpdir(), `bp-${stack}-`));
  execFileSync('git', ['clone', '--depth', '1', '--branch', ref, spec.repo, dir], { stdio: 'pipe' });
  return {
    root: path.resolve(dir, spec.subpath === '.' ? '' : spec.subpath),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
    origin: `${spec.repo}#${ref}`,
  };
}

/** Read a file as UTF-8 with the BOM and CRLFs normalised away. */
const readNormalised = (file) =>
  readFileSync(file, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

let problems = 0;
let checked = 0;

for (const [stack, spec] of Object.entries(STACKS)) {
  if (onlyStack && onlyStack !== stack) continue;
  const templateRoot = path.resolve(`templates/shop-${stack}`);
  const patches = findPatches(templateRoot);
  if (patches.length === 0) continue;

  let bp;
  try {
    bp = resolveBoilerplate(stack, spec);
  } catch (err) {
    console.error(`x ${stack}: could not resolve a boilerplate - ${err.message}`);
    problems += 1;
    continue;
  }
  console.log(`- ${stack}: ${patches.length} patch(es) against ${bp.origin}`);

  try {
    for (const patchPath of patches) {
      // templates/shop-<stack>/<overlay>/<relative path>.textpatch.json
      const fromOverlay = path
        .relative(templateRoot, patchPath)
        .split(path.sep)
        .slice(1)
        .join('/');
      const rel = fromOverlay.slice(0, -'.textpatch.json'.length);

      let source;
      try {
        source = readNormalised(path.join(bp.root, rel));
      } catch {
        console.error(`  x ${rel} - the patch has no target in the boilerplate`);
        problems += 1;
        continue;
      }

      const patch = JSON.parse(readNormalised(patchPath));
      for (const [i, op] of (patch.replace ?? []).entries()) {
        checked += 1;
        // Matching everywhere is intended (see textPatch.ts); matching nowhere
        // is the stale case that breaks a scaffold.
        if (!source.includes(op.find.replace(/\r\n/g, '\n'))) {
          const firstLine = op.find.split('\n').find((l) => l.trim()) ?? '';
          console.error(`  x ${rel} op#${i} - anchor not found: ${firstLine.trim().slice(0, 80)}`);
          problems += 1;
        }
      }
    }
  } finally {
    bp.cleanup();
  }
}

if (problems > 0) {
  console.error(
    `\n${problems} stale anchor(s). Re-cut them from the current boilerplate - ` +
      'a scaffold with these patches fails for the user.'
  );
  process.exit(1);
}
console.log(`\nAll ${checked} text-patch anchor(s) match their boilerplate.`);
