#!/usr/bin/env node
/**
 * Fixture checks for the doctor's portal-mode, dependency and CMS checks, and
 * for the scaffolder rejecting `--cms=cms`. Runs the built CLI in dist/.
 *
 * Plain node, no framework — same shape as check-doctor-b2b.mjs beside it.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(here, '..', 'packages', 'cli', 'dist', 'bin');
const ROOT = path.join(tmpdir(), `propeller-doctor-config-${process.pid}`);

const manifest = ({ stack = 'next', portalMode = 'open', adapter = null }) => ({
  template: { name: `propeller-shop-template-${stack}`, version: '0.0.0', stack },
  shop: {
    name: 'doctor-config-fixture',
    mode: 'b2c',
    locales: ['en'],
    defaultLocale: 'en',
    currency: '€',
    currencyCode: 'EUR',
    portalMode,
    siteUrl: 'https://example.test',
  },
  features: { quotes: false, authorization: false, favorites: true, clusters: true, search: true, contacts: false },
  cms: { adapter, endpoint: '', preview: false },
  customisations: { ejected: [] },
});

/** Write a fixture shop; `files` maps relative path → contents. */
function fixture(name, m, files = {}) {
  const dir = path.join(ROOT, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'propeller.json'), JSON.stringify(m, null, 2));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}

function run(bin, args, cwd) {
  const r = spawnSync(process.execPath, [path.join(BIN, bin), ...args], { cwd, encoding: 'utf8' });
  return { code: r.status ?? 1, out: `${r.stdout}${r.stderr}` };
}

const pkg = (deps) => JSON.stringify({ name: 'x', version: '1.0.0', dependencies: deps });

const SECRET_A = 'a'.repeat(64);
const SECRET_B = 'b'.repeat(64);
/** A split shop (frontend/ + cms/) with the given preview secrets. */
function strapiShop(name, stack, { cms, frontend }) {
  const envFile = stack === 'vue' ? '.env' : '.env.local';
  const portalVar = stack === 'vue' ? 'VITE_PORTAL_MODE' : 'NEXT_PUBLIC_PORTAL_MODE';
  const libCms = stack === 'vue' ? 'src/lib/cms/index.ts' : 'lib/cms/index.ts';
  const files = {
    'package.json': pkg({ '@propeller-commerce/a': '1' }),
    [libCms]: '',
    [envFile]: `${portalVar}=open\nCMS_PROVIDER=strapi\n${frontend ? `STRAPI_PREVIEW_SECRET=${frontend}\n` : ''}`,
  };
  const dir = path.join(ROOT, name);
  fixture(path.join(name, 'frontend'), manifest({ stack, adapter: 'strapi' }), files);
  mkdirSync(path.join(dir, 'cms'), { recursive: true });
  if (cms) writeFileSync(path.join(dir, 'cms', '.env'), `HOST=0.0.0.0\nPREVIEW_SECRET=${cms}\n`);
  return dir;
}
const cases = [
  {
    name: 'portal mismatch in the env example fails',
    dir: () => fixture('portal-bad', manifest({ portalMode: 'semi-closed' }), {
      'package.json': pkg({ '@propeller-commerce/a': '1' }),
      '.env.local.example': 'NEXT_PUBLIC_PORTAL_MODE=open\n',
    }),
    expect: (r) => r.code !== 0 && r.out.includes("declares portalMode 'semi-closed'"),
  },
  {
    name: 'active env wins over the example',
    dir: () => fixture('portal-active', manifest({ portalMode: 'closed' }), {
      'package.json': pkg({ '@propeller-commerce/a': '1' }),
      '.env.local.example': 'NEXT_PUBLIC_PORTAL_MODE=open\n',
      '.env.local': 'NEXT_PUBLIC_PORTAL_MODE=closed\n',
    }),
    expect: (r) => r.out.includes("portalMode 'closed' matches .env.local"),
  },
  {
    name: 'nuxt checks both portal vars',
    dir: () => fixture('portal-nuxt', manifest({ stack: 'nuxt', portalMode: 'closed' }), {
      'package.json': pkg({ '@propeller-commerce/a': '1' }),
      '.env.example': 'BOILERPLATE_PORTAL_MODE=closed\nNUXT_PUBLIC_PORTAL_MODE=open\n',
    }),
    expect: (r) => r.code !== 0 && r.out.includes('NUXT_PUBLIC_PORTAL_MODE=open'),
  },
  {
    name: 'scoped packages are checked',
    dir: () => fixture('deps', manifest({}), {
      'package.json': pkg({ '@propeller-commerce/a': '1', '@propeller-commerce/b': '1', react: '1' }),
      'node_modules/@propeller-commerce/a/package.json': '{}',
      '.env.local.example': 'NEXT_PUBLIC_PORTAL_MODE=open\n',
    }),
    expect: (r) =>
      r.code === 0 &&
      r.out.includes('@propeller-commerce/a installed.') &&
      r.out.includes('@propeller-commerce/b declared but not installed') &&
      !r.out.includes('react'),
  },
  {
    name: 'no scoped package declared warns',
    dir: () => fixture('no-deps', manifest({}), { 'package.json': pkg({ react: '1' }) }),
    expect: (r) => r.out.includes('declares no @propeller-commerce/* package'),
  },
  {
    name: "legacy cms adapter 'cms' parses and warns",
    dir: () => fixture('legacy-cms', manifest({ adapter: 'cms' }), { 'package.json': pkg({ '@propeller-commerce/a': '1' }) }),
    expect: (r) => r.out.includes('propeller.json valid') && r.out.includes("cms.adapter='cms'"),
  },
  {
    name: 'vue CMS check reads src/lib/cms and .env.example',
    dir: () => fixture('vue-cms', manifest({ stack: 'vue', adapter: 'prepr' }), {
      'package.json': pkg({ '@propeller-commerce/a': '1' }),
      'src/lib/cms/index.ts': '',
      '.env.example': 'VITE_PORTAL_MODE=open\nCMS_PROVIDER=prepr\n',
    }),
    expect: (r) => r.out.includes("CMS provider 'prepr' wired in .env.example"),
  },
  {
    name: 'strapi preview secrets that match pass',
    dir: () => strapiShop('preview-match', 'next', { cms: SECRET_A, frontend: SECRET_A }),
    expect: (r) => r.code === 0 && r.out.includes('Strapi preview secret matches') && !r.out.includes(SECRET_A),
  },
  {
    name: 'strapi preview secret missing on the frontend warns',
    dir: () => strapiShop('preview-missing', 'next', { cms: SECRET_A }),
    expect: (r) =>
      r.code === 0 && r.out.includes('Strapi preview is off') && r.out.includes('STRAPI_PREVIEW_SECRET in .env.local'),
  },
  {
    name: 'strapi preview secret missing in cms/.env warns',
    dir: () => strapiShop('preview-no-cms', 'vue', { frontend: SECRET_A }),
    expect: (r) => r.code === 0 && r.out.includes('Strapi preview is off') && r.out.includes('PREVIEW_SECRET in ../cms/.env'),
  },
  {
    name: 'strapi preview secrets that differ fail without printing them',
    dir: () => strapiShop('preview-differ', 'vue', { cms: SECRET_A, frontend: SECRET_B }),
    expect: (r) =>
      r.code !== 0 &&
      r.out.includes('Strapi preview secrets differ') &&
      r.out.includes('STRAPI_PREVIEW_SECRET in .env.') &&
      !r.out.includes(SECRET_A) &&
      !r.out.includes(SECRET_B),
  },
];

let failures = 0;
try {
  for (const c of cases) {
    const r = run('propeller.js', ['doctor'], c.dir());
    if (c.expect(r)) console.log(`ok    ${c.name}`);
    else {
      console.error(`FAIL  ${c.name} (exit ${r.code})\n${r.out}`);
      failures++;
    }
  }
  mkdirSync(ROOT, { recursive: true });
  const reject = run('create-propeller-shop.js', ['rejected-shop', '--cms=cms', '-y', '--skip-install'], ROOT);
  if (reject.code !== 0 && reject.out.includes('Unknown --cms value "cms"')) {
    console.log('ok    --cms=cms is rejected');
  } else {
    console.error(`FAIL  --cms=cms should be rejected (exit ${reject.code})\n${reject.out}`);
    failures++;
  }
} finally {
  rmSync(ROOT, { recursive: true, force: true });
}

if (failures > 0) process.exit(1);
console.log('\nDoctor config checks pass.');
