// Build step: stage the accelerator's template overlays into the publishable
// CLI package.
//
// The template overlay source of truth lives at the repo root in `templates/`.
// At runtime the CLI resolves templates from `<cli>/../../templates` (i.e.
// `packages/cli/templates/`) when published, falling back to the repo-root
// `templates/` in local dev (see resolveTemplatesRoot in src/template/clone.ts).
//
// `npm publish` only ships what the `files` allowlist lists, and that includes
// `templates` relative to the CLI package - so we copy the root templates into
// the CLI package here (run by `build:templates`, which `prepublishOnly`
// invokes before publish). Idempotent: the destination is wiped first.

import { cp, rm, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)); // packages/cli/scripts
const cliRoot = path.resolve(here, '..'); // packages/cli
const repoRoot = path.resolve(cliRoot, '..', '..'); // accelerator repo root
const src = path.join(repoRoot, 'templates');
const dest = path.join(cliRoot, 'templates');

async function main() {
  if (!existsSync(src)) {
    console.error(`[copy-templates] source not found: ${src}`);
    process.exit(1);
  }
  const s = await stat(src);
  if (!s.isDirectory()) {
    console.error(`[copy-templates] source is not a directory: ${src}`);
    process.exit(1);
  }

  // Wipe the destination so removed template files don't linger in the package.
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });

  await cp(src, dest, { recursive: true });

  console.log(`[copy-templates] copied ${src} -> ${dest}`);
}

main().catch((err) => {
  console.error('[copy-templates] failed:', err);
  process.exit(1);
});
