/**
 * Strip the boilerplate's own publishing jobs out of a scaffolded shop's
 * `.gitlab-ci.yml`.
 *
 * The boilerplate repo mirrors itself to a PUBLIC GitHub repo on every push to
 * master. Those jobs belong to that repo alone, but the scaffolder clones the
 * boilerplate verbatim, so every generated shop inherited them: a customer
 * project with a `GITHUB_TOKEN` CI variable would publish its own storefront —
 * branding, copy, tenant endpoints, custom code — to a public repo, and
 * force-overwrite the public boilerplate on the way. The only thing preventing
 * it was the absence of that variable.
 *
 * `check_anchors` goes too: it validates the CLI's text patches against the
 * boilerplate, which is meaningless in a shop that is no longer a boilerplate.
 *
 * Implemented as a line filter rather than a YAML round-trip on purpose — the
 * file keeps its comments and formatting, and the scaffolder gains no
 * dependency. Top-level keys are the only thing at column 0, so a block runs
 * from its key to the next column-0 line.
 */

import { promises as fs, existsSync } from 'node:fs';

/** Top-level jobs that must never reach a customer's pipeline. */
export const BOILERPLATE_ONLY_JOBS = ['mirror_to_github', 'release_to_github', 'check_anchors'];

/** Stages that exist only to host those jobs. */
const BOILERPLATE_ONLY_STAGES = ['anchors', 'mirror', 'release'];

export function stripBoilerplateJobs(source: string): string {
  const lines = source.split('\n');
  const out: string[] = [];
  let skipping = false;

  for (const line of lines) {
    const isTopLevelKey = /^[A-Za-z_.][\w.-]*:/.test(line);
    if (isTopLevelKey) {
      const key = line.slice(0, line.indexOf(':'));
      skipping = BOILERPLATE_ONLY_JOBS.includes(key);
      if (skipping) continue;
    }
    if (skipping) continue;

    // Drop the now-unused stages, and any `needs:` on a job we just removed.
    const stageEntry = line.match(/^\s+-\s+(\S+)\s*$/);
    if (stageEntry && BOILERPLATE_ONLY_STAGES.includes(stageEntry[1]) && inStagesBlock(out)) continue;
    if (/^\s+needs:/.test(line) && BOILERPLATE_ONLY_JOBS.some((job) => line.includes(job))) {
      const remaining = line.replace(
        /\[([^\]]*)\]/,
        (_all, inner: string) =>
          `[${inner
            .split(',')
            .map((item) => item.trim())
            .filter((item) => !BOILERPLATE_ONLY_JOBS.some((job) => item.includes(job)))
            .join(', ')}]`
      );
      out.push(remaining);
      continue;
    }
    out.push(line);
  }

  return out.join('\n').replace(/\n{3,}$/, '\n');
}

/** True when the lines emitted so far are still inside the `stages:` block. */
function inStagesBlock(out: string[]): boolean {
  for (let i = out.length - 1; i >= 0; i -= 1) {
    const line = out[i];
    if (!line.trim()) continue;
    if (/^\s/.test(line)) continue;
    return line.startsWith('stages:');
  }
  return false;
}

/** True when the YAML declares at least one job (a top-level key that isn't config). */
function hasJobs(source: string): boolean {
  const RESERVED = new Set([
    'stages', 'variables', 'default', 'include', 'workflow', 'image', 'services',
    'before_script', 'after_script', 'cache',
  ]);
  return [...source.matchAll(/^([A-Za-z_][\w:.-]*):/gm)].some(
    (match) => !RESERVED.has(match[1]) && !match[1].startsWith('.')
  );
}

/**
 * Rewrites the file in place, or deletes it when nothing but the boilerplate's
 * own publishing jobs was in it — propeller-nuxt's CI is exactly that, and a
 * `.gitlab-ci.yml` with stages and no jobs is a pipeline that fails on every
 * push rather than a pipeline that does nothing.
 *
 * No-op when the shop has no `.gitlab-ci.yml`.
 */
export async function stripCiFile(ciPath: string): Promise<'unchanged' | 'stripped' | 'removed'> {
  if (!existsSync(ciPath)) return 'unchanged';
  const before = await fs.readFile(ciPath, 'utf8');
  const after = stripBoilerplateJobs(before);
  if (after === before) return 'unchanged';
  if (!hasJobs(after)) {
    await fs.rm(ciPath, { force: true });
    return 'removed';
  }
  await fs.writeFile(ciPath, after, 'utf8');
  return 'stripped';
}
