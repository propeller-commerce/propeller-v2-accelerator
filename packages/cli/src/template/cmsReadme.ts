/**
 * Generate the per-CMS README that lands in `cms/`.
 *
 * The frontend already ships every CMS provider it supports and selects one at
 * runtime from the `CMS_PROVIDER` env var — so "configuring" a CMS is setting
 * that var (the scaffolder pre-sets it to the chosen adapter) plus the
 * provider's credentials. There is NO adapter package to install and no code to
 * wire. This README tells the shop owner how to stand up / connect the backend
 * and which env values to fill in.
 *
 * Generated for the stacks with a CMS engine (Next and Vue); Nuxt shops have no
 * `cms/` folder.
 */

import type { ScaffoldCmsAdapter, Stack } from '../schema/propellerJson';

export interface CmsReadmeOptions {
  stack: Stack;
  /** True when `cms/` holds the boilerplate's Strapi app. */
  strapiApp?: boolean;
  /** npm script that seeds the Strapi app with example content, if any. */
  seedScript?: string | null;
  /** True when the scaffold wrote `cms/.env` with fresh secrets and a preview secret. */
  strapiEnvGenerated?: boolean;
}

/** Per-stack paths the README points at. */
const STACK_PATHS: Record<'next' | 'vue', { env: string; envExample: string; libCms: string }> = {
  next: { env: '.env.local', envExample: '.env.local.example', libCms: 'lib/cms' },
  vue: { env: '.env', envExample: '.env.example', libCms: 'src/lib/cms' },
};

export function buildCmsReadme(
  adapter: ScaffoldCmsAdapter,
  shopName: string,
  opts: CmsReadmeOptions
): string {
  const p = STACK_PATHS[opts.stack === 'vue' ? 'vue' : 'next'];
  const env = `../frontend/${p.env}`;
  const envExample = `../frontend/${p.envExample}`;
  const header = `# ${shopName} — CMS\n\nThis folder hosts the CMS backend for the ${shopName} shop. The frontend\nalready contains its CMS providers in \`../frontend/${p.libCms}\` and selects one from\nthe \`CMS_PROVIDER\` env var — this scaffold pre-set it to your choice, so you\nonly need to stand up the backend and fill in the credentials below.\n\n`;
  const footer =
    `\nThe frontend resolves CMS pages at \`/{slug}\` through the catch-all\n` +
    `route. Pages not found in the CMS return 404; the homepage falls back\n` +
    `to its built-in static structure when the CMS returns null. To switch\n` +
    `provider later, change \`CMS_PROVIDER\` in \`${env}\`\n` +
    `(and keep \`propeller.json\` → \`cms.adapter\` in sync so \`npm run\n` +
    `doctor\` checks the right one).\n`;
  const copyStep = `copy \`${envExample}\` to \`${env}\``;
  switch (adapter) {
    case 'strapi': {
      const previewLine = `STRAPI_PREVIEW_SECRET=   # same value as PREVIEW_SECRET in cms/.env\n`;
      const strapiEnv =
        opts.stack === 'vue'
          ? `CMS_PROVIDER=strapi\nVITE_CMS_PROVIDER=strapi\nSTRAPI_API_URL=http://localhost:1337\nSTRAPI_API_TOKEN=\n${previewLine}`
          : `CMS_PROVIDER=strapi\nSTRAPI_API_URL=http://localhost:1337\nNEXT_PUBLIC_STRAPI_API_URL=http://localhost:1337\nSTRAPI_API_TOKEN=\n${previewLine}`;
      const runSteps = opts.strapiEnvGenerated
        ? `\`.env\` was generated with fresh secrets and a preview secret (it is gitignored).\n\n\`\`\`bash\nnpm install\nnpm run develop        # http://localhost:1337/admin\n\`\`\`\n\n`
        : `\`\`\`bash\ncp .env.example .env   # then replace every "tobemodified" secret\nnpm install\nnpm run develop        # http://localhost:1337/admin\n\`\`\`\n\n`;
      const preview =
        `## Preview\n\n` +
        `Side-by-side preview is enabled: open a page or article in the Strapi admin and\n` +
        `click **Preview**. \`PREVIEW_SECRET\` in \`.env\` must equal \`STRAPI_PREVIEW_SECRET\`\n` +
        `in \`${env}\`, and \`CLIENT_URL\` must point at the storefront. Keep the two\n` +
        `secrets equal in every deployment; while either is unset, preview is off.\n\n`;
      const install = opts.strapiApp
        ? `## Run Strapi\n\n` +
          `This folder is the boilerplate's Strapi 5 app, with the content types the\n` +
          `frontend's Strapi provider reads (pages, articles, global, category banners).\n\n` +
          runSteps +
          (opts.seedScript
            ? `To load the example content, run \`npm run ${opts.seedScript}\` once after the first start.\n\n`
            : '') +
          `Create an API token under **Settings → API Tokens** if your instance needs one.\n\n` +
          preview
        : `## Install Strapi\n\n` +
          `The scaffold could not fetch the boilerplate's Strapi app. Copy the \`cms/\`\n` +
          `folder of https://github.com/propeller-commerce/propeller-v2-next-boilerplate\n` +
          `into this folder — it carries the content types the provider reads — then run\n` +
          `\`npm install\` and \`npm run develop\`.\n\n`;
      return (
        header +
        install +
        `\`CMS_PROVIDER=strapi\` is already set in \`${envExample}\` —\n` +
        `${copyStep} and set the Strapi URL (and token, if your instance requires one):\n\n` +
        `\`\`\`\n${strapiEnv}\`\`\`\n` +
        footer
      );
    }
    case 'prepr':
      return (
        header +
        `## Connect Prepr\n\n` +
        `Prepr is a hosted headless CMS — there is no backend to install. Create\n` +
        `(or open) your environment at https://prepr.io and copy its **GraphQL\n` +
        `access token**.\n\n` +
        `Prepr authenticates by putting the token in the GraphQL URL itself, so\n` +
        `there is no CMS URL — just the token. \`CMS_PROVIDER=prepr\` is already\n` +
        `set in \`${envExample}\`; ${copyStep} and\n` +
        `fill in the token:\n\n` +
        `\`\`\`\nCMS_PROVIDER=prepr\n${opts.stack === 'vue' ? 'VITE_CMS_PROVIDER=prepr\n' : ''}PREPR_ACCESS_TOKEN=your-prepr-graphql-token\n\`\`\`\n\n` +
        `The Prepr provider introspects your environment's schema at runtime, so\n` +
        `it adapts to both rich and simple content models without code changes.\n` +
        footer
      );
    case 'contentful':
      return (
        header +
        `## Connect Contentful\n\n` +
        `Contentful is a hosted headless CMS — there is no backend to install, and\n` +
        `it cannot be self-hosted. Create (or open) a Space at\n` +
        `https://contentful.com, then from **Settings → API keys** copy the\n` +
        `**Space ID** and a **Content Delivery API** access token. The free tier\n` +
        `is enough for a shop's marketing content (25 content types, 10k records).\n\n` +
        `\`CMS_PROVIDER=contentful\` is already set in\n` +
        `\`${envExample}\`; ${copyStep} and fill in the\n` +
        `Space ID and token:\n\n` +
        `\`\`\`\nCMS_PROVIDER=contentful\nCONTENTFUL_SPACE_ID=your-space-id\nCONTENTFUL_ENVIRONMENT=master\nCONTENTFUL_CDA_TOKEN=your-delivery-token\n\`\`\`\n\n` +
        `To preview unpublished drafts, also set \`CONTENTFUL_CPA_TOKEN\` (a Content\n` +
        `Preview API token) and \`CONTENTFUL_PREVIEW=true\`.\n\n` +
        `The provider expects the content models documented in the boilerplate\n` +
        `(\`page\`, \`article\`, \`global\`, \`categoryBanner\`, plus the block types) —\n` +
        `create these in your Space to match the GraphQL queries in\n` +
        `\`../frontend/${p.libCms}/providers/contentful.ts\`.\n` +
        footer
      );
    case null:
      return (
        header +
        `## No CMS configured\n\n` +
        `This shop was scaffolded without a CMS (\`CMS_PROVIDER=none\`).\n` +
        `Marketing-content slugs (About Us, FAQ, …) will return 404 and the\n` +
        `homepage uses its built-in static fallback.\n`
      );
  }
}
