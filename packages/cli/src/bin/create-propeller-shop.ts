/**
 * `create-propeller-shop` — scaffold a new Propeller Commerce shop.
 *
 *   npx create-propeller-shop@latest my-shop --stack=next --mode=hybrid --cms=prepr
 *
 * Any missing flag is asked interactively. `--yes` skips confirmations and
 * uses defaults where prompts would have run.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { runScaffold, type ScaffoldOptions } from '../commands/scaffold';
import { getCliVersion } from '../util/version';

async function main(): Promise<void> {
  const cli = new Command();
  const version = await getCliVersion();

  cli
    .name('create-propeller-shop')
    .description('Scaffold a Propeller Commerce shop.')
    .version(version)
    .argument('[name]', 'Shop name (kebab-case)')
    .option('--stack <stack>', 'Frontend stack: next | vue | nuxt')
    .option('--mode <mode>', 'Shop mode: b2b | b2c | hybrid')
    .option('--cms <cms>', 'CMS adapter: strapi | prepr | contentful | cms | none')
    .option('--psp <psp>', 'Payment service provider: mollie | multisafepay | none')
    .option('--spare-parts <yes|no>', 'Include the spare-parts machines section (default: yes)')
    .option('--punchout <yes|no>', 'Include OCI + cXML PunchOut e-procurement (default: no)')
    .option('--tracking <yes|no>', 'Set up the behaviour-tracking dashboard /tracker (default: no)')
    .option('--locales <list>', 'Comma-separated locale list (e.g. en,nl)')
    .option('--default-locale <code>', 'Default locale')
    .option('--currency-code <iso>', 'ISO 4217 currency code (e.g. EUR)')
    .option('--portal-mode <mode>', 'open | semi-closed | closed')
    .option('--site-url <url>', 'Public site origin (no trailing slash)')
    .option('--skip-install', 'Skip npm install after scaffolding')
    .option('-y, --yes', 'Accept defaults for non-critical prompts')
    .action(async (name: string | undefined, options: Record<string, unknown>) => {
      const scaffoldOpts: ScaffoldOptions = {
        name: name ?? undefined,
        stack: options.stack as 'next' | 'vue' | 'nuxt' | undefined,
        mode: options.mode as 'b2b' | 'b2c' | 'hybrid' | undefined,
        cms: options.cms as 'strapi' | 'prepr' | 'cms' | 'none' | undefined,
        psp: options.psp as 'mollie' | 'multisafepay' | 'none' | undefined,
        // `--spare-parts=no` (or `false`/`0`) opts out; anything else opts in.
        // Absent flag stays undefined so the prompt still runs.
        spareParts:
          options.spareParts === undefined
            ? undefined
            : !/^(no|false|0)$/i.test(String(options.spareParts)),
        // `--punchout` opts IN; absent flag stays undefined so the prompt runs
        // (and defaults to no). `yes`/`true`/`1` enable it.
        punchout:
          options.punchout === undefined
            ? undefined
            : /^(yes|true|1)$/i.test(String(options.punchout)),
        // `--tracking` opts IN. Same shape as punchout: absent leaves the prompt
        // to run, and the prompt defaults to no.
        tracking:
          options.tracking === undefined
            ? undefined
            : /^(yes|true|1)$/i.test(String(options.tracking)),
        locales: options.locales
          ? String(options.locales).split(',').map((s) => s.trim())
          : undefined,
        defaultLocale: options.defaultLocale as string | undefined,
        currencyCode: options.currencyCode as string | undefined,
        portalMode: options.portalMode as 'open' | 'semi-closed' | 'closed' | undefined,
        siteUrl: options.siteUrl as string | undefined,
        skipInstall: options.skipInstall === true,
        yes: options.yes === true,
      };
      try {
        await runScaffold(scaffoldOpts);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(chalk.red(`\nScaffold failed: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  await cli.parseAsync(process.argv);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(chalk.red(`Unexpected error: ${(err as Error).message}`));
  process.exit(1);
});
