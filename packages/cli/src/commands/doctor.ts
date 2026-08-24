/**
 * `propeller doctor` — sanity-check the current shop.
 *
 * Reads `frontend/propeller.json` (or the file at the given
 * path) and verifies the shop matches what the manifest declares.
 *
 * v0.1 checks:
 *   - propeller.json validates against the Zod schema
 *   - All `propeller-v2-*` packages declared in package.json resolve
 *     against installed copies (no missing deps)
 *   - data/config.ts (or src/lib/config.ts) contains the declared
 *     portalMode literal (grep — not a full parse)
 *   - B2B routes exist iff mode !== 'b2c'
 *   - the configured channel resolves against the live backend, and its
 *     catalog root actually holds products
 *
 * Exit 0 = all green, 1 = at least one red. Yellow checks log warnings
 * but do not fail.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import { PropellerJsonSchema, type PropellerJson } from '../schema/propellerJson';

export interface DoctorOptions {
  cwd?: string;
}

type Finding = { level: 'ok' | 'warn' | 'fail'; message: string };

export async function runDoctor(opts: DoctorOptions): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const findings: Finding[] = [];

  // Resolve the propeller.json — try ./propeller.json then ./frontend/propeller.json.
  const manifestPath = await locateManifest(cwd);
  if (!manifestPath) {
    findings.push({
      level: 'fail',
      message:
        'propeller.json not found in current dir or ./frontend/. Run from inside a scaffolded shop.',
    });
    return report(findings);
  }
  const frontend = path.dirname(manifestPath);

  // 1. Schema check.
  let manifest: PropellerJson;
  try {
    const raw = await fs.readFile(manifestPath, 'utf8');
    manifest = PropellerJsonSchema.parse(JSON.parse(raw));
    findings.push({ level: 'ok', message: `propeller.json valid (v1, ${manifest.shop.name}, ${manifest.shop.mode}).` });
  } catch (err) {
    findings.push({ level: 'fail', message: `propeller.json invalid: ${(err as Error).message}` });
    return report(findings);
  }

  // 2. Package presence.
  const pkgPath = path.join(frontend, 'package.json');
  if (await pathExists(pkgPath)) {
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const name of Object.keys(deps).filter((d) => d.startsWith('propeller-v2-'))) {
      const installed = path.join(frontend, 'node_modules', name);
      if (await pathExists(installed)) {
        findings.push({ level: 'ok', message: `${name} installed.` });
      } else {
        findings.push({ level: 'warn', message: `${name} declared but not installed — run \`npm install\`.` });
      }
    }
  } else {
    findings.push({ level: 'warn', message: 'frontend/package.json missing.' });
  }

  // 3. Portal mode literal in config.
  await checkPortalMode(frontend, manifest.shop.portalMode, findings);

  // 4. B2B routes presence vs mode.
  await checkB2BRoutesShape(frontend, manifest, findings);

  // 5. CMS adapter wiring.
  await checkCmsAdapter(frontend, manifest, findings);

  // 6. Live backend check.
  await checkBackend(frontend, findings);

  return report(findings);
}

async function locateManifest(cwd: string): Promise<string | null> {
  const candidates = [
    path.join(cwd, 'propeller.json'),
    path.join(cwd, 'frontend', 'propeller.json'),
  ];
  for (const c of candidates) {
    if (await pathExists(c)) return c;
  }
  return null;
}

async function checkPortalMode(
  frontend: string,
  expected: string,
  findings: Finding[]
): Promise<void> {
  const candidates = [
    path.join(frontend, 'data', 'config.ts'),
    path.join(frontend, 'src', 'lib', 'config.ts'),
    path.join(frontend, 'app', 'utils', 'config.ts'),
  ];
  for (const c of candidates) {
    if (await pathExists(c)) {
      const body = await fs.readFile(c, 'utf8');
      // Find any line that mentions portalMode, then check the expected literal nearby.
      const hasMode = body.includes('portalMode') || body.includes('PORTAL_MODE');
      if (!hasMode) {
        findings.push({ level: 'warn', message: `${path.relative(frontend, c)} has no portalMode reference.` });
        return;
      }
      if (body.includes(`'${expected}'`)) {
        findings.push({ level: 'ok', message: `portalMode '${expected}' matches ${path.relative(frontend, c)}.` });
      } else {
        findings.push({
          level: 'fail',
          message: `propeller.json declares portalMode '${expected}' but ${path.relative(frontend, c)} does not contain that literal.`,
        });
      }
      return;
    }
  }
  findings.push({ level: 'warn', message: 'No data/config.ts or src/lib/config.ts found — skipping portalMode check.' });
}

async function checkB2BRoutesShape(
  frontend: string,
  manifest: PropellerJson,
  findings: Finding[]
): Promise<void> {
  // Only routes the boilerplates actually still ship. Price requests were
  // dropped upstream, and keeping them here failed this check on every
  // scaffolded shop — a red doctor for a shop that is in fact correct.
  const b2bDirs =
    manifest.template.stack === 'next'
      ? ['app/account/quotes', 'app/account/authorization-requests']
      : manifest.template.stack === 'nuxt'
        ? ['app/pages/account/quotes', 'app/pages/account/authorization-requests.vue']
        : [
            'src/views/account/QuotesView.vue',
            'src/views/account/AuthorizationRequestsView.vue',
          ];
  const shouldHaveB2B = manifest.shop.mode !== 'b2c';
  for (const rel of b2bDirs) {
    const full = path.join(frontend, rel);
    const present = await pathExists(full);
    if (shouldHaveB2B && !present) {
      findings.push({ level: 'fail', message: `${rel} missing (mode=${manifest.shop.mode} expects B2B routes).` });
    } else if (!shouldHaveB2B && present) {
      findings.push({
        level: 'warn',
        message: `${rel} present despite mode=b2c — should not have been scaffolded.`,
      });
    }
  }
  if (findings.every((f) => !f.message.includes('B2B routes'))) {
    findings.push({
      level: 'ok',
      message: `B2B route presence matches mode=${manifest.shop.mode}.`,
    });
  }
}

async function checkCmsAdapter(
  frontend: string,
  manifest: PropellerJson,
  findings: Finding[]
): Promise<void> {
  if (manifest.cms.adapter === null) {
    findings.push({ level: 'ok', message: 'No CMS adapter declared — frontend falls back to static homepage.' });
    return;
  }

  // The CMS provider is built into the frontend's lib/cms and chosen at runtime
  // from CMS_PROVIDER — there is no adapter package to install. Verify two
  // things: (1) the provider engine actually ships in this shop, and (2) the
  // env selects the declared provider.
  const adapter = manifest.cms.adapter;
  const libCms = path.join(frontend, 'lib', 'cms');
  if (!(await pathExists(libCms))) {
    findings.push({
      level: 'warn',
      message: `propeller.json declares cms.adapter='${adapter}' but ${path.relative(frontend, libCms)} is missing — the CMS provider engine isn't present in this shop.`,
    });
    return;
  }

  // Check the active env first (.env.local), falling back to the example.
  const envActive = path.join(frontend, '.env.local');
  const envExample = path.join(frontend, '.env.local.example');
  const envPath = (await pathExists(envActive)) ? envActive : envExample;
  const which = envPath === envActive ? '.env.local' : '.env.local.example';
  let envText = '';
  try {
    envText = await fs.readFile(envPath, 'utf8');
  } catch {
    /* no env file — handled below */
  }

  const m = envText.match(/^CMS_PROVIDER=(.+)$/m);
  const selected = m?.[1]?.trim();
  if (selected === adapter) {
    findings.push({ level: 'ok', message: `CMS provider '${adapter}' wired in ${which} (CMS_PROVIDER=${adapter}).` });
  } else if (selected) {
    findings.push({
      level: 'warn',
      message: `propeller.json declares cms.adapter='${adapter}' but ${which} has CMS_PROVIDER=${selected} — they should match.`,
    });
  } else {
    findings.push({
      level: 'warn',
      message: `propeller.json declares cms.adapter='${adapter}' but CMS_PROVIDER is not set in ${which} — set CMS_PROVIDER=${adapter} to activate the provider.`,
    });
  }
}

function report(findings: Finding[]): number {
  let failed = 0;
  for (const f of findings) {
    const icon =
      f.level === 'ok'
        ? chalk.green('✓')
        : f.level === 'warn'
          ? chalk.yellow('!')
          : chalk.red('✗');
    // eslint-disable-next-line no-console
    console.log(`${icon} ${f.message}`);
    if (f.level === 'fail') failed += 1;
  }
  // eslint-disable-next-line no-console
  console.log('');
  if (failed === 0) {
    // eslint-disable-next-line no-console
    console.log(chalk.green('All checks passed.'));
  } else {
    // eslint-disable-next-line no-console
    console.log(chalk.red(`${failed} check(s) failed.`));
  }
  return failed === 0 ? 0 : 1;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// ── Live backend check ──────────────────────────────────────────────────────

/**
 * Ask the backend the two questions whose wrong answers are invisible from the
 * frontend:
 *
 *  1. Does the configured channel resolve at all? A mistyped endpoint, a bad
 *     api key and a non-existent channel all look identical once the app is
 *     running — the storefront just reports "no catalog root". Here they are
 *     three distinct messages.
 *  2. Does its catalog root hold any products? A valid key pointed at an empty
 *     tenant renders a storefront that looks broken but isn't, which is a
 *     debugging round nobody should have to run.
 *
 * Needs real credentials, so it reads the ACTIVE env file only — the shipped
 * example holds placeholders and running against those proves nothing.
 */
async function checkBackend(frontend: string, findings: Finding[]): Promise<void> {
  const env = await readActiveEnv(frontend);
  if (!env) {
    findings.push({
      level: 'warn',
      message: 'No .env.local/.env found — skipping the live backend check.',
    });
    return;
  }

  const endpoint = pickEnv(env, 'GRAPHQL_ENDPOINT');
  const apiKey = pickEnv(env, 'API_KEY');
  const channelRaw = pickEnv(env, 'CHANNEL_ID');
  if (!endpoint || !apiKey) {
    findings.push({
      level: 'warn',
      message: 'Endpoint or api key missing from the env file — skipping the live backend check.',
    });
    return;
  }
  const channelId = Number(channelRaw);
  if (!Number.isFinite(channelId)) {
    findings.push({
      level: 'fail',
      message: 'CHANNEL_ID is unset or not a number. Orders, quotes and the catalog root all hang off it.',
    });
    return;
  }

  let channel: { catalogRootId?: number | null; anonymousUserId?: number | null } | null;
  try {
    const data = await graphql<{ channel: typeof channel }>(
      endpoint,
      apiKey,
      'query PropellerDoctorChannel($channelId: Int!) { channel(channelId: $channelId) { id name catalogRootId anonymousUserId } }',
      { channelId }
    );
    channel = data.channel;
  } catch (err) {
    findings.push({
      level: 'fail',
      message: `Backend unreachable or rejecting the key at ${endpoint} — ${(err as Error).message}`,
    });
    return;
  }

  if (!channel) {
    findings.push({
      level: 'fail',
      message: `Channel ${channelId} does not exist on this tenant (the key works — the id doesn't).`,
    });
    return;
  }
  findings.push({ level: 'ok', message: `Channel ${channelId} resolves at ${endpoint}.` });

  const rootId = Number(pickEnv(env, 'BASE_CATEGORY_ID') ?? '') || channel.catalogRootId;
  if (!rootId) {
    findings.push({
      level: 'fail',
      message: `Channel ${channelId} exposes no catalogRootId and no BASE_CATEGORY_ID override is set — the storefront has no catalog root.`,
    });
    return;
  }

  if (!channel.anonymousUserId) {
    findings.push({
      level: 'warn',
      message: `Channel ${channelId} has no anonymousUserId — anonymous listings fall back to the api key's own scope.`,
    });
  }

  try {
    const data = await graphql<{ category: { products?: { itemsFound?: number } } | null }>(
      endpoint,
      apiKey,
      'query PropellerDoctorCatalog($categoryId: Float!, $input: CategoryProductSearchInput) { category(categoryId: $categoryId) { categoryId products(input: $input) { itemsFound } } }',
      { categoryId: rootId, input: { page: 1, offset: 1 } }
    );
    const found = data.category?.products?.itemsFound ?? 0;
    if (!data.category) {
      findings.push({ level: 'fail', message: `Catalog root ${rootId} does not resolve as a category.` });
    } else if (found > 0) {
      findings.push({ level: 'ok', message: `Catalog root ${rootId} holds ${found} product(s).` });
    } else {
      findings.push({
        level: 'warn',
        message: `Catalog root ${rootId} resolves but holds 0 products — the storefront will render an empty catalog. Load data into the tenant, or point BASE_CATEGORY_ID at a populated category.`,
      });
    }
  } catch (err) {
    findings.push({
      level: 'warn',
      message: `Could not count products under catalog root ${rootId} — ${(err as Error).message}`,
    });
  }
}

/** POST a query and return `data`, throwing on transport or GraphQL errors. */
async function graphql<T>(
  endpoint: string,
  apiKey: string,
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: apiKey },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    // Carry the body through: a 401 answers "Invalid API key in request",
    // which is the whole point of running this check.
    const detail = (await res.text().catch(() => '')).slice(0, 200);
    throw new Error(`HTTP ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`);
  }
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '));
  if (!body.data) throw new Error('response carried no data');
  return body.data;
}

/** Parse the shop's active env file. Returns null when there isn't one. */
async function readActiveEnv(frontend: string): Promise<Record<string, string> | null> {
  for (const name of ['.env.local', '.env']) {
    const file = path.join(frontend, name);
    if (!(await pathExists(file))) continue;
    const env: Record<string, string> = {};
    for (const line of (await fs.readFile(file, 'utf8')).split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      // Strip a trailing `# comment` from unquoted values the way dotenv does.
      // Without this, `CHANNEL_ID=621 # the channel` parses as the whole
      // string and every check downstream reports a nonsense id.
      const value = m[2].trim();
      env[m[1]] = /^["']/.test(value)
        ? value.replace(/^["']|["']$/g, '')
        : value.split(/\s+#/)[0].trim();
    }
    return env;
  }
  return null;
}

/**
 * Look up a setting by its base name, ignoring the framework prefix. The three
 * stacks spell the same value `BOILERPLATE_`, `VITE_` and `NUXT_PUBLIC_`, and
 * the doctor has no reason to care which.
 */
function pickEnv(env: Record<string, string>, base: string): string | undefined {
  const key = Object.keys(env).find((k) => k === base || k.endsWith(`_${base}`));
  const value = key ? env[key] : undefined;
  return value ? value : undefined;
}
