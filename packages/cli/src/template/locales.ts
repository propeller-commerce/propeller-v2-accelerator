/**
 * Keep only the locales the shop asked for.
 *
 * `--locales` used to decide nothing about which translation folders shipped:
 * every scaffold got the boilerplate's own `en` + `nl` whatever was requested.
 * The consequences were quiet and only visible later:
 *
 *   --locales=en           → an `nl` nobody asked for still routed and prefixed
 *   --locales=en,fr        → no `fr` folder at all, so `/` mapped to a language
 *                            with no translations and both real locales sat
 *                            behind a prefix
 *
 * A requested locale the boilerplate has no translations for is a warning, not
 * an error: the shop still builds, and the missing strings fall back to their
 * English defaults, which is a reasonable starting point for a translator.
 */

import { promises as fs, existsSync } from 'node:fs';
import * as path from 'node:path';

/** Where each stack keeps its translation folders, relative to the app root. */
const LOCALES_DIR: Record<string, string> = {
  next: 'locales',
  vue: 'src/locales',
  nuxt: 'app/locales',
};

export interface PruneLocalesResult {
  /** Locale folders removed because the shop didn't ask for them. */
  removed: string[];
  /** Locales the shop asked for that the boilerplate has no translations for. */
  missing: string[];
  /**
   * The locale those missing ones actually read at runtime. `en` whenever it
   * survives the prune; otherwise the surviving locale with the most namespace
   * files, which is what build-locales-registry.mjs picks as canonical. Saying
   * "falls back to English" is wrong for a --locales list that excludes `en`.
   */
  fallback: string | null;
}

export async function pruneLocales(args: {
  stack: string;
  destFrontend: string;
  locales: string[];
}): Promise<PruneLocalesResult> {
  const result: PruneLocalesResult = { removed: [], missing: [], fallback: null };
  const rel = LOCALES_DIR[args.stack];
  if (!rel) return result;

  const dir = path.join(args.destFrontend, rel);
  if (!existsSync(dir)) return result;

  const wanted = new Set(args.locales.map((code) => code.trim().toLowerCase()).filter(Boolean));
  if (wanted.size === 0) return result;

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const present = new Set<string>();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const code = entry.name.toLowerCase();
    present.add(code);
    if (wanted.has(code)) continue;
    await fs.rm(path.join(dir, entry.name), { recursive: true, force: true });
    result.removed.push(entry.name);
  }

  for (const code of wanted) {
    if (!present.has(code)) result.missing.push(code);
  }

  // Mirror build-locales-registry.mjs: en when it is still there, else the
  // locale defining the most namespaces.
  const survivors = (await fs.readdir(dir, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  if (survivors.includes('en')) {
    result.fallback = 'en';
  } else if (survivors.length > 0) {
    const count = async (l: string) =>
      (await fs.readdir(path.join(dir, l))).filter((f) => f.endsWith('.json')).length;
    const sizes = await Promise.all(survivors.map(async (l) => [l, await count(l)] as const));
    result.fallback = sizes.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  }

  return result;
}
