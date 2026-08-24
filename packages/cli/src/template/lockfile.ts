/**
 * Prune dependencies from a cloned boilerplate's `package-lock.json`.
 *
 * The PSP slices remove packages from `package.json` via a `.patch.json`
 * overlay. The boilerplate's committed lockfile still lists them, and a lockfile
 * that disagrees with its manifest is a footgun: `npm ci` happily installs the
 * removed package anyway, so a `--psp=none` shop would still pull a PSP package
 * into `node_modules`.
 *
 * Deleting the lockfile outright would fix that but throws away the
 * boilerplate's pinned, known-good resolution for ~700 other packages. So we
 * prune instead: drop the root manifest entry and the package's own
 * `node_modules/<name>` entry (npm v7+ lockfile, `lockfileVersion` 2/3).
 *
 * Transitive-only deps of the removed package (e.g. Mollie's HTTP client) may
 * linger as orphan entries — npm removes them on the next `install`, and they
 * are never required by the manifest, so the lockfile still satisfies
 * `npm ci`. Not worth a full dependency-graph walk here.
 *
 * Missing or unparseable lockfile → no-op. The scaffold must not fail over it.
 */

import { promises as fs } from 'node:fs';

export async function pruneLockDependencies(
  lockPath: string,
  names: string[]
): Promise<number> {
  if (names.length === 0) return 0;
  let lock: Record<string, unknown>;
  try {
    lock = JSON.parse(await fs.readFile(lockPath, 'utf8')) as Record<string, unknown>;
  } catch {
    return 0;
  }

  let removed = 0;
  const packages = lock.packages as Record<string, unknown> | undefined;
  const root = packages?.[''] as Record<string, unknown> | undefined;

  for (const name of names) {
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
      const bucket = root?.[field] as Record<string, unknown> | undefined;
      if (bucket && name in bucket) {
        delete bucket[name];
        removed += 1;
      }
    }
    // Legacy top-level `dependencies` map (lockfileVersion 1 shape, still
    // emitted alongside `packages` for backwards compatibility).
    const legacy = lock.dependencies as Record<string, unknown> | undefined;
    if (legacy && name in legacy) delete legacy[name];
    if (packages) delete packages[`node_modules/${name}`];
  }

  if (removed === 0) return 0;
  await fs.writeFile(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8');
  return removed;
}
