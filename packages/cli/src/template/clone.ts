/**
 * Boilerplate clone-and-overlay scaffolder.
 *
 * The old `templates/shop-<stack>/shared/` approach kept a stale duplicate of each
 * boilerplate inside the accelerator repo. Boilerplate fixes silently fell
 * out of sync until someone manually ported them, and scaffolded shops would
 * miss recent work. This module replaces that with a `git clone --depth 1`
 * of the upstream boilerplate at scaffold time, followed by a thin overlay
 * of templated values (shop name, currency, locales, mode flags).
 *
 * Source-of-truth diagram:
 *
 *   git clone --depth 1 <boilerplate>      # upstream truth, always fresh
 *      └── frontend/                       # used as the scaffold base
 *   templates/shop-<stack>/overlay/        # accelerator overrides only
 *      ├── package.template.json
 *      ├── propeller.json placeholder
 *      └── (a handful of templated files)
 *
 * The overlay is applied LAST so it overwrites whatever the boilerplate
 * shipped. B2C-mode trimming runs after that to delete account routes that
 * don't apply (quotes / quote-requests / authorization-*).
 */

import { promises as fs, existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import {
  isTemplateFile,
  renderTemplate,
  stripTemplateSuffix,
  type SubstitutionContext,
} from './substitute';
import {
  applyJsonPatch,
  isJsonPatch,
  jsonPatchTargetName,
} from './jsonPatch';
import { stripCiFile } from './ciStrip';
import {
  applyTextPatch,
  isTextPatch,
  textPatchTargetName,
} from './textPatch';
import type { ShopConfig } from '../prompts';

/**
 * Upstream boilerplate repositories, keyed by stack.
 *
 * These are the PUBLIC GitHub mirrors (so `npx create-propeller-shop` works
 * for unauthenticated users). Each is a one-way, scrubbed mirror of the
 * private GitLab boilerplate — the mirror CI strips internal dev files
 * (.claude/, CLAUDE.md, memory/, Taskfile.yml) before publishing.
 */
export const BOILERPLATE_REPOS: Record<ShopConfig['stack'], string> = {
  next: 'https://github.com/propeller-commerce/propeller-v2-next-boilerplate.git',
  vue: 'https://github.com/propeller-commerce/propeller-v2-vue-boilerplate.git',
  nuxt: 'https://github.com/propeller-commerce/propeller-v2-nuxt-boilerplate.git',
};

/**
 * Sub-path within the cloned boilerplate that becomes the scaffolded
 * `frontend/`. propeller-vue puts its app code at `frontend/`; the others
 * are flat repos so it's the root.
 */
const BOILERPLATE_FRONTEND_SUBPATH: Record<ShopConfig['stack'], string> = {
  next: '.',
  vue: 'frontend',
  nuxt: '.',
};

/**
 * Default boilerplate branch to clone. Override per-shop via
 * `propeller.json -> boilerplate.ref`. Most consumers want `master`; users
 * trying a bleeding-edge feature can pass `develop` or a tag.
 */
const DEFAULT_BOILERPLATE_REF = 'master';

/** Override for local dev: `file:` paths to use already-cloned boilerplates. */
const LOCAL_BOILERPLATE_ENV_VARS: Record<ShopConfig['stack'], string> = {
  next: 'PROPELLER_NEXT_BOILERPLATE_LOCAL',
  vue: 'PROPELLER_VUE_BOILERPLATE_LOCAL',
  nuxt: 'PROPELLER_NUXT_BOILERPLATE_LOCAL',
};

export interface CloneResult {
  filesCloned: number;
  filesOverlaid: number;
  filesTemplated: number;
  filesPatched: number;
  filesTrimmed: number;
  upstreamRef: string;
  upstreamCommit: string;
}

/** Resolve the accelerator's `templates/` directory. Identical logic to copy.ts. */
function resolveTemplatesRoot(): string {
  if (process.env.PROPELLER_TEMPLATES_DIR) return process.env.PROPELLER_TEMPLATES_DIR;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const published = path.resolve(here, '..', '..', 'templates');
  if (existsSync(published)) return published;
  const dev = path.resolve(here, '..', '..', '..', '..', 'templates');
  return dev;
}

/**
 * Step 1: clone the boilerplate into a temp directory, then move its
 * frontend sub-path into the destination.
 *
 * Local override: if `PROPELLER_<STACK>_BOILERPLATE_LOCAL` is set to a
 * directory path, we copy from that directory instead of cloning. Saves
 * minutes during accelerator development and lets you test in-flight
 * boilerplate changes without pushing first.
 */
async function cloneBoilerplate(args: {
  stack: ShopConfig['stack'];
  ref: string;
  destFrontend: string;
}): Promise<{ filesCloned: number; upstreamCommit: string }> {
  const localOverride = process.env[LOCAL_BOILERPLATE_ENV_VARS[args.stack]];
  if (localOverride) {
    const subpath = BOILERPLATE_FRONTEND_SUBPATH[args.stack];
    const src = subpath === '.' ? localOverride : path.join(localOverride, subpath);
    if (!existsSync(src)) {
      throw new Error(
        `Local boilerplate override ${LOCAL_BOILERPLATE_ENV_VARS[args.stack]}=${localOverride} ` +
          `points at ${src} which doesn't exist.`
      );
    }
    const filesCloned = await copyDirVerbatim(src, args.destFrontend);
    return { filesCloned, upstreamCommit: 'local-override' };
  }

  const repo = BOILERPLATE_REPOS[args.stack];
  const tmpRoot = await fs.mkdtemp(path.join(
    process.env.TEMP || process.env.TMPDIR || '/tmp',
    `propeller-boilerplate-${args.stack}-`
  ));
  try {
    await execa('git', [
      'clone',
      '--depth', '1',
      '--branch', args.ref,
      '--single-branch',
      repo,
      tmpRoot,
    ], { stdio: 'pipe' });
    const { stdout: commit } = await execa('git', ['-C', tmpRoot, 'rev-parse', 'HEAD']);
    const subpath = BOILERPLATE_FRONTEND_SUBPATH[args.stack];
    const src = subpath === '.' ? tmpRoot : path.join(tmpRoot, subpath);
    if (!existsSync(src)) {
      throw new Error(
        `Cloned boilerplate at ${repo}#${args.ref} doesn't have a "${subpath}" subdirectory.`
      );
    }
    const filesCloned = await copyDirVerbatim(src, args.destFrontend);
    return { filesCloned, upstreamCommit: commit.trim() };
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
}

/**
 * Step 2: walk the overlay tree and either copy-as-is or render-and-strip
 * `.template.*` files on top of the cloned boilerplate.
 */
async function applyOverlay(args: {
  overlaySrc: string;
  destFrontend: string;
  ctx: SubstitutionContext;
}): Promise<{ filesOverlaid: number; filesTemplated: number; filesPatched: number }> {
  let filesOverlaid = 0;
  let filesTemplated = 0;
  let filesPatched = 0;
  if (!existsSync(args.overlaySrc)) {
    return { filesOverlaid, filesTemplated, filesPatched };
  }
  await walk(args.overlaySrc, async (entry) => {
    const rel = path.relative(args.overlaySrc, entry.fullPath);
    const destPath = path.join(args.destFrontend, rel);
    if (entry.isDirectory) {
      await fs.mkdir(destPath, { recursive: true });
      return;
    }
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    if (isJsonPatch(entry.name)) {
      const targetName = jsonPatchTargetName(entry.name);
      const targetPath = path.join(path.dirname(destPath), targetName);
      await applyJsonPatch({
        patchPath: entry.fullPath,
        targetPath,
        ctx: args.ctx,
      });
      filesPatched += 1;
    } else if (isTextPatch(entry.name)) {
      const targetName = textPatchTargetName(entry.name);
      const targetPath = path.join(path.dirname(destPath), targetName);
      await applyTextPatch({
        patchPath: entry.fullPath,
        targetPath,
        ctx: args.ctx,
      });
      filesPatched += 1;
    } else if (isTemplateFile(entry.name)) {
      const source = await fs.readFile(entry.fullPath, 'utf8');
      const rendered = renderTemplate(source, args.ctx);
      const finalPath = path.join(
        path.dirname(destPath),
        stripTemplateSuffix(entry.name)
      );
      await fs.writeFile(finalPath, rendered, 'utf8');
      filesTemplated += 1;
    } else {
      await fs.copyFile(entry.fullPath, destPath);
      filesOverlaid += 1;
    }
  });
  return { filesOverlaid, filesTemplated, filesPatched };
}

/**
 * Step 3: trim files from the cloned tree by a JSON manifest of paths.
 *
 * Used for the conditional trims:
 *   - b2c mode: the boilerplate ships every route (quotes, quote-requests,
 *     authorization-*) because it's b2b/hybrid by default — a b2c shop has no
 *     use for them. `templates/shop-<stack>/b2c-trim.json`.
 *   - no CMS (`--cms=none`): the boilerplate ships a full CMS integration
 *     (providers, block renderers, blog, CMS page route, global data) — a shop
 *     with no CMS deletes all of it. `templates/shop-<stack>/no-cms-trim.json`.
 *     The handful of core files that merely reference CMS are NOT deleted here;
 *     they are replaced by the `overlay-no-cms/` overlay.
 *   - PSP choice (`--psp=…`): the boilerplate ships BOTH payment integrations
 *     (Mollie + MultiSafepay) and picks one at runtime from PAYMENT_PROVIDER. A
 *     shop only ever uses one, so the unchosen provider's route handlers and
 *     server wiring are deleted — `psp-<choice>-trim.json`, where `none` drops
 *     both. The matching `overlay-psp-<choice>/` removes the npm package(s).
 *   - no spare parts (`--spare-parts=no`): drops the `/machines` pages and
 *     helpers — `no-machines-trim.json` + `overlay-no-machines/` for the files
 *     that merely link to them (header nav, router, config).
 *
 * Manifest shape: `{ "remove": ["rel/path", ...] }`. Missing manifest or
 * missing targets are silently skipped, so the same trim is safe across stacks
 * whose layouts differ.
 */
async function trimByManifest(args: {
  trimManifestPath: string;
  destFrontend: string;
}): Promise<number> {
  if (!existsSync(args.trimManifestPath)) return 0;
  const raw = await fs.readFile(args.trimManifestPath, 'utf8');
  const manifest = JSON.parse(raw) as { remove: string[] };
  let count = 0;
  for (const rel of manifest.remove) {
    const target = path.join(args.destFrontend, rel);
    if (existsSync(target)) {
      await fs.rm(target, { recursive: true, force: true });
      count += 1;
    }
  }
  return count;
}

/**
 * Top-level: clone → overlay → trim. Replaces the old `scaffoldTemplateTree`.
 *
 * Order matters:
 *   1. clone the boilerplate (full CMS integration included)
 *   2. apply the standard overlay (templated package.json, README, etc.)
 *   3. when `cmsAdapter` is null (`--cms=none`): apply the `overlay-no-cms/`
 *      overlay (no-CMS variants of the few core files that reference CMS) THEN
 *      trim every dedicated CMS file via `no-cms-trim.json`. Overlay-before-trim
 *      so the replacements land first and the deletions remove what's left.
 *   4. PSP choice: same overlay-then-trim pair, keyed by the chosen provider
 *      (`none` | `mollie` | `multisafepay`).
 *   5. spare parts opt-out: same overlay-then-trim pair.
 *   6. b2c trim (independent of everything above).
 */
export async function scaffoldFromBoilerplate(args: {
  stack: ShopConfig['stack'];
  mode: ShopConfig['mode'];
  cmsAdapter: ShopConfig['cmsAdapter'];
  psp: ShopConfig['psp'];
  spareParts: ShopConfig['spareParts'];
  punchout: ShopConfig['punchout'];
  ref?: string;
  destFrontend: string;
  ctx: SubstitutionContext;
}): Promise<CloneResult> {
  const ref = args.ref ?? DEFAULT_BOILERPLATE_REF;

  const clone = await cloneBoilerplate({
    stack: args.stack,
    ref,
    destFrontend: args.destFrontend,
  });

  const templatesRoot = resolveTemplatesRoot();
  const stackRoot = path.join(templatesRoot, `shop-${args.stack}`);

  const overlay = await applyOverlay({
    overlaySrc: path.join(stackRoot, 'overlay'),
    destFrontend: args.destFrontend,
    ctx: args.ctx,
  });

  let filesTrimmed = 0;

  /**
   * Apply one conditional feature slice: its `overlay-<name>/` (variants and
   * patches for files that merely REFERENCE the feature) followed by its
   * `<name>-trim.json` (the feature's own files). Overlay-before-trim so the
   * replacements land first and the deletions remove what's left. A missing
   * overlay dir or manifest is a no-op, so a slice only needs the halves it
   * actually uses, per stack.
   */
  const applySlice = async (overlayDir: string, trimManifest: string) => {
    const sliceOverlay = await applyOverlay({
      overlaySrc: path.join(stackRoot, overlayDir),
      destFrontend: args.destFrontend,
      ctx: args.ctx,
    });
    overlay.filesOverlaid += sliceOverlay.filesOverlaid;
    overlay.filesTemplated += sliceOverlay.filesTemplated;
    overlay.filesPatched += sliceOverlay.filesPatched;

    filesTrimmed += await trimByManifest({
      trimManifestPath: path.join(stackRoot, trimManifest),
      destFrontend: args.destFrontend,
    });
  };

  // No CMS: the no-CMS variants of CMS-referencing core files, then every
  // dedicated CMS file. (Overlays can contain `.template.*` files too.)
  if (args.cmsAdapter === null) {
    await applySlice('overlay-no-cms', 'no-cms-trim.json');
  }

  // PSP: drop the packages + route handlers the shop won't use. `none` drops
  // both providers; a named provider drops the other one.
  await applySlice(
    `overlay-psp-${args.psp ?? 'none'}`,
    `psp-${args.psp ?? 'none'}-trim.json`
  );

  // Spare parts opt-out: drop the /machines pages, helpers and nav entry.
  if (!args.spareParts) {
    await applySlice('overlay-no-machines', 'no-machines-trim.json');
  }

  // PunchOut opt-out (the default): drop the /api/punchout/* routes, the server
  // glue and the cart transfer button, and remove the punchout package.
  if (!args.punchout) {
    await applySlice('overlay-no-punchout', 'no-punchout-trim.json');
  }

  // B2C: drop the B2B-only routes. `overlay-b2c/` exists only where deleting the
  // files isn't enough — propeller-vue's router imports each view explicitly, so
  // its routes have to be patched out as well (Next and Nuxt are file-routed).
  if (args.mode === 'b2c') {
    await applySlice('overlay-b2c', 'b2c-trim.json');
  }

  // The boilerplate's own publish jobs must not survive into a customer's
  // pipeline — see ciStrip.ts. Runs after the overlays so it also covers a
  // `.gitlab-ci.yml` an overlay put there.
  await stripCiFile(path.join(args.destFrontend, '.gitlab-ci.yml'));

  return {
    filesCloned: clone.filesCloned,
    filesOverlaid: overlay.filesOverlaid,
    filesTemplated: overlay.filesTemplated,
    filesPatched: overlay.filesPatched,
    filesTrimmed,
    upstreamRef: ref,
    upstreamCommit: clone.upstreamCommit,
  };
}

// ── Utilities ───────────────────────────────────────────────────────────────

/**
 * Top-level dirs that the verbatim copy MUST NOT pull from the boilerplate.
 * - `.git`: heavy + confusing (shop owner runs `git init` themselves).
 * - `node_modules`, `.next`, `.nuxt`, `dist`, `.vite`: build / install
 *   artifacts; consumer reinstalls anyway.
 * - `playwright-report`, `test-results`, `coverage`: ephemeral test output.
 * - `.claude`, `memory`: dev-only assistant scratch space.
 */
const VERBATIM_SKIP_TOP = new Set([
  '.git',
  'node_modules',
  '.next',
  '.nuxt',
  '.output',
  'dist',
  '.vite',
  '.turbo',
  'playwright-report',
  'test-results',
  'coverage',
  '.claude',
  'memory',
]);

/**
 * Top-level file names that the verbatim copy MUST NOT pull. Mostly env
 * files: when the local-override is used in dev, the upstream's real `.env`
 * (with live API keys) would otherwise leak into the scaffolded shop. The
 * boilerplate's `.env.example` is the SOURCE OF TRUTH for the scaffold;
 * shops fill in real values themselves.
 */
const VERBATIM_SKIP_FILE = new Set([
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.development.local',
  '.env.production.local',
]);

/**
 * Plain recursive copy of a directory tree. Skips heavy/junk top-level
 * directories listed in VERBATIM_SKIP_TOP — both for the write AND the
 * recursion (walking into node_modules is the slow part, not the writes).
 */
async function copyDirVerbatim(src: string, dest: string): Promise<number> {
  let count = 0;
  await walkWithSkip(src, async (entry) => {
    const rel = path.relative(src, entry.fullPath);
    const destPath = path.join(dest, rel);
    if (entry.isDirectory) {
      await fs.mkdir(destPath, { recursive: true });
      return;
    }
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.copyFile(entry.fullPath, destPath);
    count += 1;
  }, VERBATIM_SKIP_TOP);
  return count;
}

interface WalkEntry {
  fullPath: string;
  name: string;
  isDirectory: boolean;
}

const SKIP_NAMES = new Set(['.gitkeep']);

async function walk(dir: string, visit: (entry: WalkEntry) => Promise<void>) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_NAMES.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    await visit({ fullPath, name: entry.name, isDirectory: entry.isDirectory() });
    if (entry.isDirectory()) {
      await walk(fullPath, visit);
    }
  }
}

/**
 * Variant of `walk` that prunes the recursion at any directory matching a
 * skip set. The skip applies to the top-level segment in the path —
 * `node_modules/foo/bar` is pruned but `app/data/node_modules.json` (file
 * with that string in the name) is fine.
 */
async function walkWithSkip(
  root: string,
  visit: (entry: WalkEntry) => Promise<void>,
  skipDirNames: Set<string>,
  current?: string,
) {
  const here = current ?? root;
  const entries = await fs.readdir(here, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_NAMES.has(entry.name)) continue;
    // Only apply skip-dir check to directories so a file with the same name
    // (rare) doesn't get pruned. Skip-file applies at the top level only,
    // because nested `.env`-like files are unrelated to the boilerplate's
    // own runtime config.
    if (entry.isDirectory() && skipDirNames.has(entry.name)) continue;
    if (!entry.isDirectory() && here === root && VERBATIM_SKIP_FILE.has(entry.name)) continue;
    const fullPath = path.join(here, entry.name);
    await visit({ fullPath, name: entry.name, isDirectory: entry.isDirectory() });
    if (entry.isDirectory()) {
      await walkWithSkip(root, visit, skipDirNames, fullPath);
    }
  }
}
