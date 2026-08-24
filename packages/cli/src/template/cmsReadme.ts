/**
 * Generate the per-CMS README that lands in `cms/`.
 *
 * The frontend already ships every CMS provider in its `lib/cms` and selects
 * one at runtime from the `CMS_PROVIDER` env var — so "configuring" a CMS is
 * setting that var (the scaffolder pre-sets it to the chosen adapter) plus the
 * provider's credentials. There is NO adapter package to install and no code to
 * wire. This README tells the shop owner how to stand up / connect the backend
 * and which env values to fill in.
 *
 * CMS is a Next-only capability today, so this is only generated for Next shops
 * (the other stacks have no `cms/` folder).
 */

import type { CmsAdapter } from '../schema/propellerJson';

export function buildCmsReadme(adapter: CmsAdapter, shopName: string): string {
  const header = `# ${shopName} — CMS\n\nThis folder hosts the CMS backend for the ${shopName} shop. The frontend\nalready contains every provider in \`../frontend/lib/cms\` and selects one from\nthe \`CMS_PROVIDER\` env var — this scaffold pre-set it to your choice, so you\nonly need to stand up the backend and fill in the credentials below.\n\n`;
  const footer =
    `\nThe frontend resolves CMS pages at \`/{slug}\` through the catch-all\n` +
    `route. Pages not found in the CMS return 404; the homepage falls back\n` +
    `to its built-in static structure when the CMS returns null. To switch\n` +
    `provider later, change \`CMS_PROVIDER\` in \`../frontend/.env.local\`\n` +
    `(and keep \`propeller.json\` → \`cms.adapter\` in sync so \`propeller\n` +
    `doctor\` checks the right one).\n`;
  switch (adapter) {
    case 'strapi':
      return (
        header +
        `## Install Strapi\n\n` +
        `\`\`\`bash\nnpx create-strapi-app@latest .\n\`\`\`\n\n` +
        `Pick **TypeScript** when prompted; the provider's mappers assume the\n` +
        `default content-type shape. \`CMS_PROVIDER=strapi\` is already set in\n` +
        `\`../frontend/.env.local.example\` — copy it to \`.env.local\` and set the\n` +
        `Strapi URL (and token, if your instance requires one):\n\n` +
        `\`\`\`\nCMS_PROVIDER=strapi\nSTRAPI_API_URL=http://localhost:1337\nNEXT_PUBLIC_STRAPI_API_URL=http://localhost:1337\nSTRAPI_API_TOKEN=\n\`\`\`\n` +
        footer
      );
    case 'prepr':
      return (
        header +
        `## Connect Prepr\n\n` +
        `Prepr is a hosted headless CMS — there is no backend to install. Create\n` +
        `(or open) your environment at https://prepr.io and copy its **GraphQL\n` +
        `access token**.\n\n` +
        `Prepr authenticates by putting the token in the GraphQL URL itself, so\n` +
        `there is no CMS URL — just the token. \`CMS_PROVIDER=prepr\` is already\n` +
        `set in \`../frontend/.env.local.example\`; copy it to \`.env.local\` and\n` +
        `fill in the token:\n\n` +
        `\`\`\`\nCMS_PROVIDER=prepr\nPREPR_ACCESS_TOKEN=your-prepr-graphql-token\n\`\`\`\n\n` +
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
        `\`../frontend/.env.local.example\`; copy it to \`.env.local\` and fill in the\n` +
        `Space ID and token:\n\n` +
        `\`\`\`\nCMS_PROVIDER=contentful\nCONTENTFUL_SPACE_ID=your-space-id\nCONTENTFUL_ENVIRONMENT=master\nCONTENTFUL_CDA_TOKEN=your-delivery-token\n\`\`\`\n\n` +
        `To preview unpublished drafts, also set \`CONTENTFUL_CPA_TOKEN\` (a Content\n` +
        `Preview API token) and \`CONTENTFUL_PREVIEW=true\`.\n\n` +
        `The provider expects the content models documented in the boilerplate\n` +
        `(\`page\`, \`article\`, \`global\`, \`categoryBanner\`, plus the block types) —\n` +
        `create these in your Space to match the GraphQL queries in\n` +
        `\`../frontend/lib/cms/providers/contentful.ts\`.\n` +
        footer
      );
    case 'cms':
      return (
        header +
        `## Install Propeller CMS\n\n` +
        `See the Propeller CMS install guide:\n` +
        `https://docs.propeller-commerce.com/cms/install\n\n` +
        `\`CMS_PROVIDER=cms\` is already set in \`../frontend/.env.local.example\`.\n` +
        `Copy it to \`.env.local\` and set the backend's connection details as\n` +
        `documented in the install guide.\n` +
        footer
      );
    case null:
      return (
        header +
        `## No CMS configured\n\n` +
        `This shop was scaffolded without a CMS (\`CMS_PROVIDER=none\`).\n` +
        `Marketing-content slugs (About Us, FAQ, …) will return 404 and the\n` +
        `homepage uses the built-in static \`<HomeFallback>\` component.\n\n` +
        `To enable a CMS later — no package install, the providers already ship\n` +
        `in \`../frontend/lib/cms\`:\n\n` +
        `1. Stand up Strapi or Propeller CMS, or connect a hosted Prepr\n` +
        `   environment (no backend to install).\n` +
        `2. In \`../frontend/.env.local\`, set \`CMS_PROVIDER\` to \`strapi\`,\n` +
        `   \`prepr\`, or \`cms\`, plus that provider's credentials (see the\n` +
        `   commented CMS section in \`.env.local.example\`).\n` +
        `3. Update \`propeller.json\` → \`cms.adapter\` to match so\n` +
        `   \`propeller doctor\` verifies the right provider.\n`
      );
  }
}
