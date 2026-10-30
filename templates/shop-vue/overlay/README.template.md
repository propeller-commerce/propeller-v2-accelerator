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
cp .env.example .env               # fill in the backend endpoint + API keys
npm install
npm run dev                        # http://localhost:5173
```

Run `npm run doctor` after every dependency bump to confirm `propeller.json` still matches what's installed.

{{#if cmsAdapter}}
## Directory layout

This shop is the **frontend** half of a two-tree deployment:

```
{{shopName}}/
  frontend/          # ← you are here
  cms/               # CMS backend or connection notes
```

The CMS setup instructions live in `../cms/README.md`.
{{/if}}

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
This shop is configured to use the **`{{cmsAdapter}}`** CMS provider. The Strapi and Prepr providers ship in `src/lib/cms` and are selected at runtime by the `CMS_PROVIDER` env var — there is **no adapter package to install**. The scaffolder already set `CMS_PROVIDER={{cmsAdapter}}` (and its `VITE_CMS_PROVIDER` mirror) in `.env.example`.

The home page, `/blog` and any `/<slug>` route fetch content from the active provider. If the provider returns null, the home page falls back to its built-in layout and other slugs return 404.

To finish setup: copy `.env.example` to `.env` and fill in the `{{cmsAdapter}}` credentials (see the CMS section in that file, and `../cms/README.md`). Then run `npm run doctor` to verify.
{{else}}
This shop was scaffolded **without a CMS** (`CMS_PROVIDER=none`): the blog and CMS catch-all routes were removed. The home page renders its built-in layout and any `/<slug>` route returns 404 unless you add a static route yourself.

The Strapi and Prepr providers still ship in `src/lib/cms`. To add a CMS later, restore the blog and CMS page views and their routes from the boilerplate (or scaffold with `--cms=strapi` / `--cms=prepr`), then set `CMS_PROVIDER` in `.env` and `cms.adapter` in `propeller.json`, and run `npm run doctor`.
{{/if}}

## Upgrade path

This shop owns its code outright after scaffolding. To pull in new template
fixes, see `propeller upgrade` (Phase B — sketched, not yet shipped). Any
file you've modified that you want protected from future upgrades should be
listed in `propeller.json -> customisations.ejected`.
