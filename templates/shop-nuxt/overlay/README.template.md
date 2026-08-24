# {{shopName}}

Scaffolded with [`create-propeller-shop`](https://github.com/propeller-commerce/propeller-v2-accelerator) at template version `{{templateVersion}}`.

| Setting        | Value             |
|----------------|-------------------|
| Stack          | Nuxt 3 (SSR)      |
| Shop mode      | `{{shopMode}}`    |
| Portal mode    | `{{portalMode}}`  |
| Default locale | `{{defaultLocale}}` |
| Currency       | `{{currency}}` (`{{currencyCode}}`) |
| CMS adapter    | `{{cmsAdapterDisplay}}` |

## Getting started

```bash
cp .env.example .env               # fill in the backend endpoint + API keys
npm install
npm run dev                        # http://localhost:3000
```

Run `npm run doctor` after every dependency bump to confirm `propeller.json` still matches what's installed.

## Directory layout

This shop is the **frontend** half of a two-tree deployment:

```
{{shopName}}/
  frontend/          # ← you are here
  cms/               # CMS backend (Strapi / Propeller-CMS), installed separately
```

The CMS install instructions live in `../cms/README.md`.

## Architecture

This is a **Nuxt 3 SSR consumer** of the `propeller-v2-vue-ui` Vue component package. The same package powers the SPA-only `propeller-vue` consumer; the Nuxt build adds server-side rendering, hybrid islands, and a Nitro-backed anonymous data cache.

- **Tier 1 (per-request) wiring**: `app/plugins/propeller.ts` installs the `propellerVue` plugin with a per-request `GraphQLClient` (server uses `securityMode: 'direct'` with the API key; client uses `securityMode: 'proxy'` against `/api/graphql` so secrets never reach the browser).
- **Tier 2 (per-scope) wiring**: `app/app.vue` renders `<PropellerProvider>` with reactive `user`, `companyId`, `language`, `includeTax`, `portalMode` props derived from Pinia stores. Components read from this provider via `useInfraProps`, with explicit prop overrides taking precedence.
- **Hybrid SSR catalog pages**: `category/[id]/[slug]`, `cluster/[clusterId]/[slug]`, `product/[productId]/[slug]`, `search` each call `useFetch('/api/catalog/...')` server-side and hydrate the interactive grid/filters/toolbar client-side inside `<ClientOnly>` (the package's interactive components aren't designed for server-only render).
- **Anonymous data cache**: `server/utils/cache.ts:cachedSdkFetch` wraps Nitro's `useStorage('cache')` with per-entity tags (`product:42`, `category:13`, `catalog` umbrella). Authenticated requests bypass via the cookie read in `getServerInfra()`. `POST /api/revalidate` (secret-gated) busts by tag.

## Mode-specific surface

{{#if isB2B}}
This shop is B2B-only:

- Register form forces `Contact` registration (no picker shown).
- `/account/quotes`, `/account/quote-requests`, `/account/authorization-requests`, `/account/authorization-settings`, `/account/price-requests` are present and accessible.
- Company switcher is visible in the header for logged-in Contacts.
{{/if}}
{{#if isB2C}}
This shop is B2C-only:

- Register form forces `Customer` registration (no picker shown).
- The B2B-only routes (`/account/quotes`, etc.) are **not present** — pages return Nuxt's 404 view.
- No company switcher.
{{/if}}
{{#if isHybrid}}
This shop is **hybrid** (B2B + B2C in one deployment):

- Register form shows the Contact / Customer picker.
- The B2B-only routes are present and gated at runtime: a `Customer` hitting `/account/quotes` is redirected by `requireUserMode`. A `Contact` sees them.
- Company switcher renders for logged-in Contacts; hidden for Customers.
{{/if}}

## CMS

{{#if cmsAdapter}}
This shop is configured to use the **`{{cmsAdapter}}`** CMS adapter. The home page and any `/<slug>` route fetches a `CmsPage` from the adapter and renders its blocks. If the adapter returns null, the home page falls back to the built-in static homepage and other slugs return 404.

The adapter package itself is not yet pinned in `package.json` — install it manually:

```bash
npm install --install-links file:../../propeller-v2-accelerator/packages/cms-adapter-{{cmsAdapter}}
```

Then set `CMS_URL` (+ optional `CMS_TOKEN`) in `.env`.
{{else}}
This shop was scaffolded **without a CMS adapter**. The home page renders the built-in static layout and any `/<slug>` route returns 404 unless you add a static route yourself.

To add a CMS later: install `propeller-v2-cms-adapter-strapi` (or another adapter), set `cms.adapter` in `propeller.json`, set `CMS_URL` in `.env`, then run `npm run doctor` to verify.
{{/if}}

## Caching contract

Anonymous catalog GraphQL fetches go through `server/utils/cache.ts:cachedSdkFetch` with per-entity tags from `server/utils/tags.ts`. TTL is `ANONYMOUS_CACHE_TTL_SECONDS = 300`. Logged-in users bypass via the cookie read in `getServerInfra()`. `POST /api/revalidate` with header `x-revalidate-secret: $REVALIDATE_SECRET` and body `{ "tag": "..." }` busts by tag; `{ "tag": "*" }` wipes everything under the `catalog` umbrella.

The cache key (`stableStringify(vars)`) depends on **stable variable order** in the `build…Input` blocks of `server/utils/fetchers.ts`. Don't reorder casually — Nitro hashes the request shape byte-for-byte.

## Upgrade path

This shop owns its code outright after scaffolding. To pull in new template
fixes, see `propeller upgrade` (Phase B — sketched, not yet shipped). Any
file you've modified that you want protected from future upgrades should be
listed in `propeller.json -> customisations.ejected`.
