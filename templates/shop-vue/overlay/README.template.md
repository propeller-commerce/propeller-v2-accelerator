# {{shopName}}

Scaffolded with [`create-propeller-shop`](https://github.com/propeller-commerce/propeller-v2-accelerator) at template version `{{templateVersion}}`.

| Setting        | Value             |
|----------------|-------------------|
| Stack          | Vue 3 + Vite SSR  |
| Shop mode      | `{{shopMode}}`    |
| Portal mode    | `{{portalMode}}`  |
| Default locale | `{{defaultLocale}}` |
| Currency       | `{{currency}}` (`{{currencyCode}}`) |
| CMS adapter    | `{{cmsAdapterDisplay}}` |

## Getting started

```bash
cp .env.example .env.local         # fill in API URL + AUTH_SECRET
npm install
npm run dev                        # http://localhost:5173
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
- The B2B-only routes (`/account/quotes`, etc.) are **not registered** in the router — requests return Vue Router's `not-found` view.
- No company switcher.
{{/if}}
{{#if isHybrid}}
This shop is **hybrid** (B2B + B2C in one deployment):

- Register form shows the Contact / Customer picker.
- The B2B-only routes are registered and gated at runtime: a `Customer` hitting `/account/quotes` is redirected to the 404 view by `requireUserMode`. A `Contact` sees them.
- Company switcher renders for logged-in Contacts; hidden for Customers.
{{/if}}

## CMS

{{#if cmsAdapter}}
This shop is configured to use the **`{{cmsAdapter}}`** CMS adapter. The home page and any `/<slug>` route fetches a `CmsPage` from the adapter and renders its blocks. If the adapter returns null, the home page falls back to the built-in static homepage and other slugs return 404.

The adapter package itself is not yet pinned in `package.json` — install it manually:

```bash
npm install --install-links file:../../propeller-v2-accelerator/packages/cms-adapter-{{cmsAdapter}}
```

Then set `CMS_URL` (+ optional `CMS_TOKEN`) in `.env.local`.
{{else}}
This shop was scaffolded **without a CMS adapter**. The home page renders the built-in static layout and any `/<slug>` route returns 404 unless you add a static route yourself.

To add a CMS later: install `propeller-v2-cms-adapter-strapi` (or another adapter), set `cms.adapter` in `propeller.json`, set `CMS_URL` in `.env.local`, then run `npm run doctor` to verify.
{{/if}}

## Upgrade path

This shop owns its code outright after scaffolding. To pull in new template
fixes, see `propeller upgrade` (Phase B — sketched, not yet shipped). Any
file you've modified that you want protected from future upgrades should be
listed in `propeller.json -> customisations.ejected`.
