/**
 * `propeller` — post-scaffold ops for a Propeller shop.
 *
 * Sub-commands:
 *   propeller doctor             sanity-check the current shop
 *   propeller check-anchors      verify this CLI's text patches still fit
 *                                a boilerplate checkout (for boilerplate CI)
 *
 * Phase B (deferred):
 *   propeller upgrade [--to X.Y.Z]
 *   propeller eject <path>
 *
 * Phase C (deferred):
 *   propeller migrate-mode <new-mode>
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { runDoctor } from '../commands/doctor';
import { runCheckAnchors } from '../commands/checkAnchors';
import { getCliVersion } from '../util/version';

async function main(): Promise<void> {
  const cli = new Command();
  const version = await getCliVersion();

  cli
    .name('propeller')
    .description('Post-scaffold tooling for Propeller Commerce shops.')
    .version(version);

  cli
    .command('doctor')
    .description('Sanity-check the current shop (validates propeller.json, version pins, route shape).')
    .option('--cwd <dir>', 'Run as if invoked from <dir>')
    .action(async (options: { cwd?: string }) => {
      try {
        const code = await runDoctor({ cwd: options.cwd });
        process.exit(code);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(chalk.red(`Doctor failed: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  cli
    .command('check-anchors')
    .description(
      "Verify this CLI's text-patch anchors still match a boilerplate checkout. " +
        "Intended for the boilerplates' own CI: a boilerplate change can invalidate " +
        'an anchor in an ALREADY-PUBLISHED CLI, which our publish-time gate cannot see.'
    )
    .requiredOption('--stack <stack>', 'next | vue | nuxt')
    .option('--boilerplate <dir>', 'Boilerplate repo root', process.cwd())
    .option('--templates <dir>', "Override the CLI's templates directory")
    .action((options: { stack: string; boilerplate: string; templates?: string }) => {
      const problems = runCheckAnchors({
        stack: options.stack,
        boilerplate: options.boilerplate,
        templates: options.templates,
      });
      process.exit(problems === 0 ? 0 : 1);
    });

  cli
    .command('upgrade')
    .description('(Phase B, not yet implemented) Apply template diffs to this shop.')
    .action(() => {
      // eslint-disable-next-line no-console
      console.log(
        chalk.yellow(
          'propeller upgrade is reserved for v0.2. The propeller.json schema records the template version so the upgrade path is non-breaking once shipped.'
        )
      );
      process.exit(2);
    });

  cli
    .command('eject')
    .description('(Phase B, not yet implemented) Mark a file as customised.')
    .argument('<path>')
    .action(() => {
      // eslint-disable-next-line no-console
      console.log(
        chalk.yellow(
          'propeller eject is reserved for v0.2. v0.1 ships the customisations.ejected list in propeller.json so manual entries are forward-compatible.'
        )
      );
      process.exit(2);
    });

  await cli.parseAsync(process.argv);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(chalk.red(`Unexpected error: ${(err as Error).message}`));
  process.exit(1);
});
