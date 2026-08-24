# {{shopName}}

Scaffolded with [`create-propeller-shop`](https://github.com/propeller-commerce/propeller-v2-accelerator) at template version `{{templateVersion}}`.

| Setting        | Value             |
|----------------|-------------------|
| Stack          | Next.js (React)   |
| Shop mode      | `{{shopMode}}`    |
| Portal mode    | `{{portalMode}}`  |
| Default locale | `{{defaultLocale}}` |
| Currency       | `{{currency}}` (`{{currencyCode}}`) |
| CMS adapter    | `{{cmsAdapterDisplay}}` |

## Getting started

```bash
cp .env.example .env.local         # fill in API URL + AUTH_SECRET
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
- The B2B-only routes (`/account/quotes`, etc.) are **not scaffolded** — requests return Next's default 404.
- No company switcher.
{{/if}}
{{#if isHybrid}}
This shop is **hybrid** (B2B + B2C in one deployment):

- Register form shows the Contact / Customer picker.
- The B2B-only routes are scaffolded and gated at runtime: a `Customer` hitting `/account/quotes` gets a 404. A `Contact` sees them.
- Company switcher renders for logged-in Contacts; hidden for Customers.
{{/if}}

## CMS

{{#if cmsAdapter}}
This shop is configured to use the **`{{cmsAdapter}}`** CMS provider. Every provider ships in `lib/cms` and is selected at runtime by the `CMS_PROVIDER` env var — there is **no adapter package to install**. The scaffolder already set `CMS_PROVIDER={{cmsAdapter}}` in `.env.local.example`.

The home page and any `/<slug>` route fetch a `CmsPage` from the active provider and render its blocks. If the provider returns null, the home page falls back to the built-in `<HomeFallback>` component and other slugs return 404.

To finish setup: copy `.env.local.example` to `.env.local` and fill in the `{{cmsAdapter}}` credentials (see the commented CMS section in that file, and `../cms/README.md`). Then run `npm run doctor` to verify.
{{else}}
This shop was scaffolded **without a CMS** (`CMS_PROVIDER=none`). The home page renders the built-in `<HomeFallback>` component and any `/<slug>` route returns 404 unless you add a static page yourself.

To enable a CMS later — the providers already ship in `lib/cms`, nothing to install: set `CMS_PROVIDER` to `strapi`, `prepr`, or `cms` in `.env.local` (plus that provider's credentials — see the commented CMS section in `.env.local.example`), update `cms.adapter` in `propeller.json` to match, then run `npm run doctor` to verify.
{{/if}}

## Upgrade path

This shop owns its code outright after scaffolding. To pull in new template
fixes, see `propeller upgrade` (Phase B — sketched, not yet shipped). Any
file you've modified that you want protected from future upgrades should be
listed in `propeller.json -> customisations.ejected`.
