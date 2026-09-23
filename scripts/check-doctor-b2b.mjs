#!/usr/bin/env node
/**
 * Fail the build if `propeller doctor` goes back to demanding B2B routes from
 * `shop.mode` alone.
 *
 * The check used to key off the mode only, so a shop that deliberately removed
 * quotes and purchase authorisation could never pass: setting
 * `features.quotes=false` changed nothing, output was byte-identical, and the
 * doctor exited 1 forever. A gate that can never go green is not a gate — it
 * trains people to ignore it, which is worse than the finding it reports
 * (PWP-997).
 *
 * Two fixtures differing ONLY in the `features` flags, with the B2B routes
 * absent from both. Flags on must fail; flags off must pass.
 *
 * Plain node, no framework — same shape as check-textpatches.mjs beside it.
 * Run it in CI and before publishing.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(here, '..', 'packages', 'cli', 'dist', 'bin', 'propeller.js');
const ROOT = path.join(tmpdir(), `propeller-doctor-b2b-${process.pid}`);

/** A minimal but schema-complete manifest — only `features` varies. */
const manifest = (quotes, authorization) => ({
  $schema: 'https://propeller.dev/schemas/shop.v1.json',
  template: { name: 'propeller-shop-template-next', version: '0.0.0', stack: 'next' },
  shop: {
    name: 'doctor-b2b-fixture',
    mode: 'hybrid',
    locales: ['en'],
    defaultLocale: 'en',
    currency: '€',
    currencyCode: 'EUR',
    portalMode: 'open',
    siteUrl: 'https://example.test',
  },
  features: {
    quotes,
    authorization,
    favorites: true,
    clusters: true,
    search: true,
    contacts: true,
    spareParts: true,
    punchout: false,
    tracking: false,
  },
  cms: { adapter: null, endpoint: '', preview: false },
  payments: { provider: null },
  customisations: { paths: [] },
});

function fixture(name, quotes, authorization) {
  const dir = path.join(ROOT, name);
  mkdirSync(path.join(dir, 'app', 'account'), { recursive: true });
  // app/account/quotes and app/account/authorization-requests are deliberately
  // NOT created — that is the whole point.
  writeFileSync(path.join(dir, 'propeller.json'), JSON.stringify(manifest(quotes, authorization), null, 2));
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: name, version: '1.0.0' }, null, 2));
  return dir;
}

function doctorExitCode(dir) {
  try {
    execFileSync(process.execPath, [CLI, 'doctor'], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
    return 0;
  } catch (err) {
    return err.status ?? 1;
  }
}

let failures = 0;
try {
  const withFlags = doctorExitCode(fixture('flags-on', true, true));
  if (withFlags === 0) {
    console.error('FAIL  features.quotes/authorization=true with the routes absent should FAIL the doctor.');
    failures++;
  } else {
    console.log('ok    flags on  + routes absent -> doctor fails (exit ' + withFlags + ')');
  }

  const withoutFlags = doctorExitCode(fixture('flags-off', false, false));
  if (withoutFlags !== 0) {
    console.error(
      'FAIL  features.quotes/authorization=false with the routes absent should PASS the doctor, ' +
        'got exit ' + withoutFlags + '. The B2B check is keying off shop.mode again (PWP-997).'
    );
    failures++;
  } else {
    console.log('ok    flags off + routes absent -> doctor passes');
  }
} finally {
  rmSync(ROOT, { recursive: true, force: true });
}

if (failures > 0) process.exit(1);
console.log('\nDoctor honours the features flags.');
