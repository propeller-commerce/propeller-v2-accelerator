// Strapi app env files; the preview secret goes only into gitignored real env files.

import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { ensureEnvVar, setEnvVar } from './envEdit';

/** Storefront dev origin per stack (Next `next dev`, Vue `node server.js`). */
export const STOREFRONT_DEV_URL = {
  next: 'http://localhost:3000',
  vue: 'http://localhost:5173',
  nuxt: 'http://localhost:3000',
} as const;

export function newPreviewSecret(): string {
  return randomBytes(32).toString('hex');
}

function strapiKey(): string {
  return randomBytes(16).toString('base64');
}

/** Line-ending-preserving edit of env text. */
function withLf(text: string, edit: (lf: string) => string): string {
  const crlf = text.includes('\r\n');
  const out = edit(text.replace(/\r\n/g, '\n'));
  return crlf ? out.replace(/\n/g, '\r\n') : out;
}

/** `cms/.env` text from its example: fresh secrets, the preview secret and the storefront URL. */
export function buildStrapiEnv(example: string, previewSecret: string, clientUrl: string): string {
  return withLf(example, (env) => {
    env = setEnvVar(env, 'APP_KEYS', `"${[strapiKey(), strapiKey(), strapiKey(), strapiKey()].join(',')}"`);
    env = env.replace(/toBeModified\d*|tobemodified/gi, () => strapiKey());
    env = ensureEnvVar(env, 'CLIENT_URL', clientUrl);
    return ensureEnvVar(env, 'PREVIEW_SECRET', previewSecret);
  });
}

/** Point cms/.env.example at the storefront; create cms/.env when missing (returns true if created). */
export async function writeStrapiEnv(cmsFolder: string, previewSecret: string, clientUrl: string): Promise<boolean> {
  const examplePath = path.join(cmsFolder, '.env.example');
  let example: string;
  try {
    example = await fs.readFile(examplePath, 'utf8');
  } catch {
    return false;
  }
  example = withLf(example, (env) => ensureEnvVar(env, 'CLIENT_URL', clientUrl));
  await fs.writeFile(examplePath, example, 'utf8');

  const envPath = path.join(cmsFolder, '.env');
  try {
    await fs.access(envPath);
    return false;
  } catch {
    await fs.writeFile(envPath, buildStrapiEnv(example, previewSecret, clientUrl), 'utf8');
    return true;
  }
}

/** Document `# STRAPI_PREVIEW_SECRET=` under the Strapi lines of a frontend env example. */
export function documentPreviewSecret(env: string): string {
  if (/^\s*#?\s*STRAPI_PREVIEW_SECRET\s*=/m.test(env)) return env;
  return withLf(env, (text) => {
    const lines = text.split('\n');
    const at = lines.findIndex((line) => /^\s*#?\s*STRAPI_API_TOKEN\s*=/.test(line));
    const doc = ['# Enables Strapi admin preview; must equal PREVIEW_SECRET in cms/.env.', '# STRAPI_PREVIEW_SECRET='];
    if (at === -1) return `${text.replace(/\n*$/, '')}\n${doc.join('\n')}\n`;
    lines.splice(at + 1, 0, ...doc);
    return lines.join('\n');
  });
}
