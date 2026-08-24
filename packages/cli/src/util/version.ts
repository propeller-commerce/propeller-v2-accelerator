/**
 * Read the CLI's own version from its bundled package.json.
 * Used as the `template.version` value in the scaffolded `propeller.json`.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

let cached: string | null = null;

export async function getCliVersion(): Promise<string> {
  if (cached) return cached;
  const here = path.dirname(fileURLToPath(import.meta.url));
  // The compiled bin lives at dist/bin/foo.js. Walk up from `here` until we
  // find a package.json whose name matches our CLI — works for both the
  // bin layout (dist/bin/foo.js) and the helper layout (dist/util/foo.js).
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = path.resolve(here, ...Array(depth + 1).fill('..'), 'package.json');
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const pkg = JSON.parse(raw) as { name?: string; version?: string };
      // Match on the unscoped name: the package was published unscoped once
      // and is `@propeller-commerce/create-propeller-shop` now, and comparing
      // against the old literal silently fell through to the '0.0.0' fallback
      // — which then got stamped into `--version`, `propeller.json` and the
      // scaffold's own git commit.
      if (pkg.name?.replace(/^@[^/]+\//, '') === 'create-propeller-shop' && pkg.version) {
        cached = pkg.version;
        return cached;
      }
    } catch {
      // Try next depth.
    }
  }
  // Fallback so doctor still works in development checkouts.
  cached = '0.0.0';
  return cached;
}
