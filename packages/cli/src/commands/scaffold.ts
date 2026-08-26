/**
 * `create-propeller-shop <name>` command implementation.
 *
 * Atomic per attempt: any failure rolls back the target directory so the
 * user never lands on a half-scaffolded shop.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { execa } from 'execa';
import { collectShopConfig, type PromptDefaults, type ShopConfig } from '../prompts';
import {
  PropellerJsonSchema,
  buildPropellerJson,
} from '../schema/propellerJson';
import { buildContext, type SubstitutionContext } from '../template/substitute';
import { scaffoldFromBoilerplate } from '../template/clone';
import { buildCmsReadme } from '../template/cmsReadme';
import { removeEnvKeys, setEnvVar } from '../template/envEdit';
import { pruneLockDependencies } from '../template/lockfile';
import { pruneLocales } from '../template/locales';
import { getCliVersion } from '../util/version';

/** npm package per PSP — removed from the manifest when it isn't chosen. */
const PSP_PACKAGES = {
  mollie: '@propeller-commerce/propeller-v2-mollie',
  multisafepay: '@propeller-commerce/propeller-v2-msp',
} as const;

/** The PunchOut package — removed from the manifest when --punchout=no. */
const PUNCHOUT_PACKAGE = '@propeller-commerce/propeller-v2-punchout';

/**
 * CMS npm deps — removed from the manifest (by overlay-no-cms/package.patch.json)
 * when --cms=none, so they must be pruned from the lockfile too or `npm ci`
 * reinstalls them. The CMS render package plus the Contentful rich-text libs the
 * Contentful provider pulls in.
 */
const CMS_PACKAGES = [
  '@propeller-commerce/propeller-v2-cms-react',
  '@contentful/rich-text-html-renderer',
  '@contentful/rich-text-types',
] as const;

/** Env-file name per stack (Next reads `.env.local`, Vue/Nuxt read `.env`). */
const ENV_EXAMPLE: Record<ShopConfig['stack'], string> = {
  next: '.env.local.example',
  vue: '.env.example',
  nuxt: '.env.example',
};

/**
 * The public (client-visible) mirror of `PAYMENT_PROVIDER`. Every boilerplate
 * needs both set to the same value: the server routes read the private one, the
 * checkout page reads the public one.
 */
const PUBLIC_PAYMENT_PROVIDER_VAR: Record<ShopConfig['stack'], string> = {
  next: 'NEXT_PUBLIC_PAYMENT_PROVIDER',
  vue: 'VITE_PAYMENT_PROVIDER',
  nuxt: 'NUXT_PUBLIC_PAYMENT_PROVIDER',
};

/**
 * Where each boilerplate keeps the shop's default language.
 *
 * This is the value `--default-locale` is asking for, and it is load-bearing
 * well beyond a label: every boilerplate derives its URL locale prefixes as
 * "the locales that are not the default", so leaving the template default in
 * place inverts the routing. A shop scaffolded `--locales=en,nl
 * --default-locale=en` kept `NL`, which made `en` the prefixed locale and
 * served Dutch at `/`.
 *
 * Next's public twin is derived in `next.config.ts`, so only the server-side
 * key is set here. Vue reads a build-time `VITE_` var directly.
 */
const DEFAULT_LANGUAGE_VAR: Record<ShopConfig['stack'], string> = {
  next: 'BOILERPLATE_DEFAULT_LANGUAGE',
  vue: 'VITE_DEFAULT_LANGUAGE',
  nuxt: 'BOILERPLATE_DEFAULT_LANGUAGE',
};

/**
 * Where each boilerplate keeps the full list of languages it ships.
 *
 * Vue and Nuxt hardcoded `['NL','EN']`, so `--locales` decided which locale
 * FOLDERS were kept but not which languages the router prefixed — a shop
 * scaffolded `--locales=en,fr` still prefixed `en` and left `fr` unrouted.
 * Next derives the list from the folders on disk and needs no var.
 */
const LOCALES_VAR: Partial<Record<ShopConfig['stack'], string>> = {
  vue: 'VITE_LOCALES',
  nuxt: 'BOILERPLATE_LOCALES',
};

export interface ScaffoldOptions extends PromptDefaults {
  yes?: boolean;
  cwd?: string;
}

export async function runScaffold(opts: ScaffoldOptions): Promise<void> {
  const cwd = opts.cwd ?? process.cwd();

  // 1. Collect config (mix of CLI flags + prompts).
  const config = await collectShopConfig(opts);

  // 2. Validate destination.
  const root = path.resolve(cwd, config.name);
  // Layout: a CMS-backed shop is split into `frontend/` (the app) + `cms/`
  // (the CMS backend install). A shop with no CMS has nothing to split, so the
  // app is scaffolded flat at the shop root and there is no `cms/` folder.
  const hasCms = config.cmsAdapter !== null;
  const frontend = hasCms ? path.join(root, 'frontend') : root;
  const cmsFolder = hasCms ? path.join(root, 'cms') : null;

  if (await pathExists(root)) {
    throw new Error(
      `Destination "${root}" already exists. Pick a different name or remove the existing folder.`
    );
  }

  // 3. Scaffold inside a try/rollback frame.
  const spinner = ora({ text: `Scaffolding ${config.name}…`, color: 'cyan' }).start();
  try {
    await fs.mkdir(frontend, { recursive: true });
    if (cmsFolder) await fs.mkdir(cmsFolder, { recursive: true });

    const templateVersion = await getCliVersion();
    const ctx: SubstitutionContext = buildContext(config, templateVersion);

    // 4. Clone the upstream boilerplate, then apply our thin overlay
    //    of templated files. This replaces the previous approach of keeping
    //    a stale copy of each boilerplate inside templates/shop-*/shared/ —
    //    that model required manual sync every time the boilerplate moved
    //    and silently produced out-of-date shops between syncs.
    spinner.text = 'Cloning boilerplate…';
    const copyStats = await scaffoldFromBoilerplate({
      stack: config.stack,
      mode: config.mode,
      cmsAdapter: config.cmsAdapter,
      psp: config.psp,
      spareParts: config.spareParts,
      punchout: config.punchout,
      destFrontend: frontend,
      ctx,
    });

    // 4a2. Drop the translation folders the shop didn't ask for, and note any
    //      it asked for that the boilerplate has no strings for.
    const localeResult = await pruneLocales({
      stack: config.stack,
      destFrontend: frontend,
      locales: config.locales,
    });

    // 4b. Keep the lockfile honest about the packages the overlays just removed
    //     from package.json — otherwise `npm ci` reinstalls them. That's the
    //     unchosen PSP(s), the punchout package when --punchout=no, and the CMS
    //     deps when --cms=none.
    await pruneLockDependencies(
      path.join(frontend, 'package-lock.json'),
      [
        ...(Object.keys(PSP_PACKAGES) as Array<keyof typeof PSP_PACKAGES>)
          .filter((p) => p !== config.psp)
          .map((p) => PSP_PACKAGES[p]),
        ...(config.punchout ? [] : [PUNCHOUT_PACKAGE]),
        ...(config.cmsAdapter === null ? CMS_PACKAGES : []),
      ]
    );

    // 5. Write propeller.json.
    const propellerJson = buildPropellerJson({
      templateName: `propeller-shop-template-${config.stack}`,
      templateVersion,
      stack: config.stack,
      shopName: config.name,
      mode: config.mode,
      locales: config.locales,
      defaultLocale: config.defaultLocale,
      currency: config.currency,
      currencyCode: config.currencyCode,
      portalMode: config.portalMode,
      siteUrl: config.siteUrl,
      cmsAdapter: config.cmsAdapter,
      psp: config.psp,
      spareParts: config.spareParts,
      punchout: config.punchout,
      tracking: config.tracking,
    });
    // Re-parse to confirm we emit a valid manifest.
    PropellerJsonSchema.parse(propellerJson);
    // Escape every non-ASCII code-point to its `\uXXXX` form so the file is
    // pure ASCII on disk — currency symbols (€, £, ¥, …) render correctly in
    // every terminal / PR-review tool regardless of the host's default
    // encoding (PowerShell on Windows defaults to cp1252 and would otherwise
    // show multibyte UTF-8 glyphs as mojibake like `â‚¬`). `JSON.parse`
    // decodes `\uXXXX` transparently — runtime value is unchanged. Chosen
    // over a UTF-8 BOM because Node's `JSON.parse` does NOT skip a leading
    // BOM (so a BOM would break `propeller doctor` and downstream readers).
    const asciiSafeJson = JSON.stringify(propellerJson, null, 2).replace(
      /[\u0080-\uFFFF]/g,
      (c) => '\\u' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')
    );
    await fs.writeFile(
      path.join(frontend, 'propeller.json'),
      asciiSafeJson + '\n',
      'utf8'
    );

    // 5b. Activate the chosen CMS provider in the env example. The boilerplate
    //     ships every provider and selects one at runtime from CMS_PROVIDER
    //     (default `none`); a `--cms=<x>` shop just needs that var flipped and
    //     the matching credential lines uncommented. Next-only — the other
    //     stacks force cmsAdapter=null (no CMS engine), so this is a no-op there.
    if (config.cmsAdapter) {
      await activateCmsProviderEnv(frontend, config.stack, config.cmsAdapter);
    }

    // 5c. Same idea for the PSP and the spare-parts section: activate what was
    //     chosen, and strip the env keys for what was removed so the example
    //     file only documents capabilities this shop actually has.
    await applyFeatureEnv(frontend, config);

    // 6. Write the CMS folder README (only when there is a cms/ folder — a
    //    no-CMS shop has no CMS folder and no CMS install instructions).
    if (cmsFolder) {
      await fs.writeFile(
        path.join(cmsFolder, 'README.md'),
        buildCmsReadme(config.cmsAdapter, config.name),
        'utf8'
      );
    }

    spinner.succeed(
      `Scaffolded ${config.name} — ${copyStats.filesCloned} files from ` +
        `boilerplate@${copyStats.upstreamCommit.slice(0, 8)} ` +
        `+ ${copyStats.filesOverlaid + copyStats.filesTemplated} overlay ` +
        `(${copyStats.filesTemplated} templated)` +
        (copyStats.filesTrimmed ? ` − ${copyStats.filesTrimmed} trimmed` : '') +
        (localeResult.removed.length ? ` − ${localeResult.removed.join(', ')} locale(s)` : '') +
        '.'
    );

    if (localeResult.missing.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        chalk.yellow(
          `Note: the boilerplate ships no translations for ${localeResult.missing.join(', ')}. ` +
            `Those locales route and build, but their strings fall back to English until you ` +
            `add the files under the shop's locales folder.`
        )
      );
    }
  } catch (err) {
    spinner.fail(`Scaffolding failed: ${(err as Error).message}`);
    await safeRemove(root);
    throw err;
  }

  // 7. Optional: npm install.
  if (!config.skipInstall) {
    const installSpinner = ora({ text: 'Running npm install in frontend…' }).start();
    try {
      await execa('npm', ['install'], { cwd: frontend, stdio: 'pipe' });
      installSpinner.succeed('npm install complete.');
    } catch (err) {
      installSpinner.warn(
        `npm install failed — you can re-run it manually. (${(err as Error).message})`
      );
    }
  }

  // 8. Optional: git init for the parent shop folder.
  try {
    await execa('git', ['init', '--initial-branch=main'], { cwd: root, stdio: 'pipe' });
    await execa('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
    await execa(
      'git',
      ['commit', '-m', `Scaffolded with create-propeller-shop@${await getCliVersion()}`],
      { cwd: root, stdio: 'pipe' }
    );
  } catch {
    // Non-fatal — the shop is still usable without git.
  }

  // 9. Print next steps.
  //
  //    Whether the schema installer exists is READ FROM the shop we just built,
  //    never assumed from a version number. The CLI and the boilerplates release
  //    independently, so a freshly published CLI is routinely paired with an
  //    older boilerplate — printing `npm run tracking:init` at someone whose
  //    package.json has no such script is worse than saying nothing.
  printNextSteps(config, root, await hasScript(frontend, 'tracking:init'));
}

/** Does the scaffolded app define this npm script? False if anything is unreadable. */
async function hasScript(frontend: string, name: string): Promise<boolean> {
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(frontend, 'package.json'), 'utf8'));
    return typeof pkg?.scripts?.[name] === 'string';
  } catch {
    return false;
  }
}

function printNextSteps(config: ShopConfig, root: string, hasTrackingInstaller: boolean): void {
  const hasCms = config.cmsAdapter !== null;
  // CMS shops nest the app under `frontend/`; no-CMS shops are flat at root.
  const relApp = hasCms ? path.join(config.name, 'frontend') : config.name;
  const relCms = path.join(config.name, 'cms');
  // Env-template filename differs per stack: Next ships `.env.local.example`
  // (Next reads `.env.local`); Vue/Nuxt ship `.env.example` (read `.env`).
  const [envExample, envTarget] =
    config.stack === 'next'
      ? ['.env.local.example', '.env.local']
      : ['.env.example', '.env'];
  // eslint-disable-next-line no-console
  console.log(
    [
      '',
      chalk.bold.green(`✓ ${config.name} is ready.`),
      '',
      chalk.bold('Next steps:'),
      `  1. cd ${relApp}`,
      `  2. Copy ${envExample} to ${envTarget} and fill in the backend endpoints.`,
      `  3. npm run dev`,
      '',
      `  A git repo was initialised in ${config.name}/ with a baseline commit`,
      `  recording the template version — delete ${config.name}/.git if you are`,
      `  scaffolding into an existing repository.`,
      '',
      hasCms
        ? `  See ${relCms}/README.md to install the ${config.cmsAdapter} backend.`
        : `  No CMS configured — the homepage uses the built-in static page.`,
      config.psp
        ? `  Payments via ${config.psp} — add its API keys to ${envTarget}.`
        : `  No payment provider — checkout places the order and goes straight to thank-you.`,
      config.spareParts ? null : `  Spare-parts machines removed (no /machines section).`,
      config.punchout
        ? `  PunchOut (OCI + cXML) enabled — set PUNCHOUT_ENABLED + CXML_CONTACT_ID in ${envTarget}.`
        : null,
      // Both steps are named: setting the vars without creating the schema
      // leaves a dashboard that silently reports zeros.
      config.tracking && hasTrackingInstaller
        ? `  Behaviour tracking enabled — set TRACKING_DB_* in ${envTarget}, then run\n` +
          `  \`npm run tracking:init\` to create the schema (MariaDB / MySQL / Cloud SQL).`
        : null,
      // Older boilerplate, no installer. Say what IS true rather than naming a
      // script this shop does not have.
      config.tracking && !hasTrackingInstaller
        ? `  Behaviour tracking enabled — set TRACKING_DB_* in ${envTarget}. This\n` +
          `  boilerplate predates the schema installer, so create the tables from its\n` +
          `  db/ directory by hand, or update it to get \`npm run tracking:init\`.`
        : null,
      '',
    ]
      .filter((line) => line !== null)
      .join('\n')
  );
}

/**
 * Activate the chosen CMS provider in the scaffolded shop's env example.
 *
 * The Next boilerplate's `.env.local.example` ships a CMS section with
 * `CMS_PROVIDER=none` and a commented block of provider credentials. Flipping a
 * shop to a real CMS is just: set CMS_PROVIDER (+ its public mirror) to the
 * chosen value and uncomment the matching credential lines so the user sees
 * exactly what to fill in. The provider code already lives in the boilerplate's
 * `lib/cms` — no package install, no code wiring.
 *
 * Only the Next stack has a CMS engine (and thus an env example with this
 * section), so this runs for `stack === 'next'` only; other stacks never reach
 * here (their cmsAdapter is forced to null upstream).
 *
 * Idempotent-ish and defensive: if the expected lines aren't present (an older
 * boilerplate without the CMS section), it leaves the file untouched rather
 * than throwing — the shop is still usable, just not pre-wired.
 */
async function activateCmsProviderEnv(
  frontend: string,
  stack: ShopConfig['stack'],
  adapter: NonNullable<ShopConfig['cmsAdapter']>
): Promise<void> {
  if (stack !== 'next') return;
  const envPath = path.join(frontend, '.env.local.example');
  if (!(await pathExists(envPath))) return;

  let env = await fs.readFile(envPath, 'utf8');

  // Flip the provider selector. There is no public mirror to set: the
  // boilerplate derives NEXT_PUBLIC_CMS_PROVIDER from this one in
  // next.config.ts so the two cannot disagree.
  env = env.replace(/^CMS_PROVIDER=none$/m, `CMS_PROVIDER=${adapter}`);

  // Uncomment the credential lines for the chosen provider so they're ready to
  // fill in. Each entry: the commented form (as shipped) → the active form.
  const CREDENTIAL_LINES: Record<typeof adapter, string[]> = {
    strapi: [
      '# STRAPI_API_URL=http://localhost:1337',
      '# NEXT_PUBLIC_STRAPI_API_URL=http://localhost:1337',
      '# STRAPI_API_TOKEN=',
    ],
    prepr: ['# PREPR_ACCESS_TOKEN=your-prepr-graphql-token'],
    contentful: [
      '# CONTENTFUL_SPACE_ID=',
      '# CONTENTFUL_ENVIRONMENT=master',
      '# CONTENTFUL_CDA_TOKEN=        # Content Delivery API token (published content)',
    ],
    // The generic 'cms' provider has no boilerplate credential lines yet; it
    // selects the provider but the user supplies connection details per the
    // CMS README.
    cms: [],
  };
  for (const commented of CREDENTIAL_LINES[adapter]) {
    const active = commented.replace(/^# /, '');
    env = env.split(commented).join(active);
  }

  await fs.writeFile(envPath, env, 'utf8');
}

/**
 * Reconcile the env example with the PSP + spare-parts choices.
 *
 * PSP:
 *   - a provider → set `PAYMENT_PROVIDER` and its public mirror to that slug
 *     (uncommenting them where the boilerplate ships them commented out), and
 *     delete the OTHER provider's key block — its package and routes are gone.
 *   - `none` → delete both providers' keys plus the provider selectors. What
 *     stays is the provider-agnostic rest of the payments section
 *     (`ON_ACCOUNT_PAYMENTS`, currency), which checkout still reads.
 *
 * Spare parts: `no` deletes the `*MACHINE*` keys (source + tree language).
 *
 * Every edit is best-effort — see `envEdit.ts`.
 */
/**
 * The 2-char uppercase language the backend expects, from `--default-locale`.
 * `en-GB` and `en` both give `EN`; the same derivation the template
 * substitution uses for `defaultLanguage`.
 */
function defaultLanguageOf(config: ShopConfig): string {
  return config.defaultLocale.split(/[_-]/)[0].toUpperCase();
}

async function applyFeatureEnv(frontend: string, config: ShopConfig): Promise<void> {
  const envPath = path.join(frontend, ENV_EXAMPLE[config.stack]);
  if (!(await pathExists(envPath))) return;

  let env = await fs.readFile(envPath, 'utf8');

  // The language the shop defaults to. Written unconditionally: the template
  // ships `NL`, and every stack computes its locale prefixes as "not the
  // default", so an unwritten value silently inverts the routing.
  env = setEnvVar(env, DEFAULT_LANGUAGE_VAR[config.stack], defaultLanguageOf(config));

  // The full locale list, for the stacks that can't derive it from the folders.
  const localesVar = LOCALES_VAR[config.stack];
  if (localesVar) {
    env = setEnvVar(env, localesVar, config.locales.join(','));
  }

  const publicVar = PUBLIC_PAYMENT_PROVIDER_VAR[config.stack];
  if (config.psp) {
    env = setEnvVar(env, 'PAYMENT_PROVIDER', config.psp);
    env = setEnvVar(env, publicVar, config.psp);
    // Drop the unchosen provider's credentials (MOLLIE_* or MSP_*).
    const dropPrefix = config.psp === 'mollie' ? 'MSP_' : 'MOLLIE_';
    env = removeEnvKeys(env, (key) => key.startsWith(dropPrefix));
  } else {
    env = removeEnvKeys(
      env,
      (key) =>
        key.startsWith('MOLLIE_') ||
        key.startsWith('MSP_') ||
        key === 'PAYMENT_PROVIDER' ||
        key === publicVar
    );
  }

  if (!config.spareParts) {
    env = removeEnvKeys(env, (key) => key.includes('MACHINE'));
  }

  // PunchOut off (the default): strip its section (PUNCHOUT_* + CXML_CONTACT_ID).
  // Only the Next boilerplate documents these keys today; a no-op elsewhere.
  if (!config.punchout) {
    env = removeEnvKeys(
      env,
      (key) => key.startsWith('PUNCHOUT') || key === 'CXML_CONTACT_ID'
    );
  }

  // Behaviour tracking off (the default): strip the whole TRACKING_* section, so
  // a shop that said no does not carry configuration for a dashboard it will
  // never open.
  //
  // On: only the feature switch is set. The connection vars are deliberately
  // left commented for the user to fill in — the boilerplate documents a local
  // dev database, and writing those values into a scaffold would point a fresh
  // shop at a server that does not exist. Alone, TRACKING_ENABLED collects
  // nothing until TRACKING_DB_* is set, which is what the next-steps text says.
  if (config.tracking) {
    env = setEnvVar(env, 'TRACKING_ENABLED', 'true');
  } else {
    env = removeEnvKeys(env, (key) => key.startsWith('TRACKING_'));
  }

  await fs.writeFile(envPath, env, 'utf8');
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function safeRemove(p: string): Promise<void> {
  try {
    await fs.rm(p, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
