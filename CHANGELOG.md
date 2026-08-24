# Changelog

All notable changes to `propeller-v2-accelerator` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.9.3] - 2026-08-24

### Added

- **`propeller check-anchors --stack <next|vue|nuxt> --boilerplate <dir>`.**
  A text patch anchors on a verbatim snippet of boilerplate source, so it can
  be broken from either side. `check:textpatches` guards ours: it runs here and
  on `prepublishOnly`, so a CLI cannot ship with stale anchors. It cannot guard
  the other side - once a version is published, a later boilerplate commit can
  invalidate an anchor that was correct when it shipped, and nothing notices
  until someone scaffolds. That is exactly how 0.9.0 broke. This command is the
  same check, shipped, so a boilerplate pipeline can run it against the CLI
  version its users actually get and fail the change that causes the drift.

### Fixed

- **`--default-locale` was ignored by the generated env file.** The scaffolder
  derived the default language and never wrote it, so every shop got `NL`. Each
  stack derives its route prefixes as "the locales that are not the default",
  so an `--default-locale=en` shop served Dutch at `/` and put English behind
  `/en`. Now written for all three stacks (`BOILERPLATE_DEFAULT_LANGUAGE`, or
  `VITE_DEFAULT_LANGUAGE` on Vue).
- **`npm run doctor` could not run in a scaffolded shop.** The overlay added a
  dependency on this repo's root package, which has no `bin` - so it never
  provided the `propeller` command, and it cloned the whole scaffolder into
  every shop's `node_modules`. Dropped; the script now calls the published CLI
  through `npx`, and works from a fresh scaffold with nothing installed.
## [0.9.2] - 2026-08-21

### Fixed

- **Issue-tracker references were still being written INTO scaffolded shops.**
  The no-CMS `layout.tsx` and `page.tsx` patches carry replacement text, and
  that text is what lands in the generated app - so the references in it
  shipped to users even after the templates elsewhere were cleaned. Found by
  scaffolding from the published CLI and grepping the output rather than the
  repo. A `--cms=none` Next shop now has none.

## [0.9.1] - 2026-08-21

### Fixed

- **Four stale text-patch anchors, three of which were already broken.**
  `check:textpatches` caught them: the Next no-CMS layout anchor, and three
  older ones the boilerplates had drifted past - the Vue and Nuxt cart import
  lines (a `watch` import arrived and is not PunchOut-only, so the prune has to
  keep it) and the Nuxt header, whose contact-only block gained a Quick order
  link that a whole-block deletion would have taken with it. All 51 anchors
  match again.
- Issue-tracker references removed from the README and `check-textpatches.mjs`;
  they ship to people who cannot resolve them.

## [0.9.0] - 2026-08-20

### Added

- **`--tracking <yes|no>` — the behaviour-tracking dashboard (`/tracker`).**
  Opt-in and Next-only; the Vue and Nuxt boilerplates ship no `/tracker`, and a
  `--tracking` there warns and is ignored, matching how `--cms` already behaves.

  Answering yes sets `TRACKING_ENABLED` and records `features.tracking` in
  `propeller.json`; answering no strips the whole `TRACKING_*` section, so a shop
  that declined does not carry configuration for a dashboard it will never open.

  It deliberately does **not** provision a database. The scaffold runs on a
  laptop with no route to the shop's server, so the connection vars are left
  commented for the user to fill in and the closing next-steps name both
  remaining steps — setting `TRACKING_DB_*` and running `npm run tracking:init`
  (boilerplate 1.14.0), which creates the schema on MariaDB, MySQL or Cloud SQL.
  Naming only the first would leave a dashboard silently reporting zeros.

  Version-adaptive rather than version-pinned: the CLI reads whether the shop it
  just cloned actually defines `tracking:init` and tailors the instructions to
  that. The CLI and the boilerplates release independently, so a new CLI is
  routinely paired with an older boilerplate, and naming a script that shop does
  not have is worse than saying nothing. Best paired with next-boilerplate
  1.14.0+, where the installer lives and the connection variables ship
  commented out.

## [0.8.0] - 2026-08-20

### Fixed

- **The Next `--cms=none` layout patch kept the analytics tag.** Its Prepr
  deletion was one span, and boilerplate 1.13.0 inserted `<GoogleTags />` into
  the middle of it. Re-cut as two spans, so a no-CMS shop drops Prepr and keeps
  GA4/GTM. Caught by `check:textpatches` before release, which is the point of
  it.

- **`--stack=vue` could not scaffold at all.** The no-CMS router
  patch anchored to the blog routes as they were before boilerplate 1.11.8
  added `meta: { ssrKey }` to them, so every Vue scaffold — on every `--cms`
  value — died with "text patch is stale". Anchor re-cut from the current
  boilerplate.
- **A second stale anchor, hidden behind the first.** The `--punchout=no`
  patch for `CartView.vue` anchored to the PunchOut block's hardcoded English,
  which had since been localized to `{{ t.punchoutIntro }}`. It was
  unreachable while the router patch failed first.
- **Text-patch anchors are no longer rendered as templates.** `find` used to
  go through Handlebars, so an anchor containing Vue's `{{ … }}` interpolation
  threw `"punchoutIntro" not defined` — which made the CartView anchor above
  impossible to re-cut. `find` is now matched literally; `with` is still
  rendered, so `{{shopName}}` in an inserted line keeps working.
- **`--version`, `propeller.json` and the scaffold's baseline commit all
  reported `0.0.0`.** The version lookup compared against the
  package's old unscoped name and silently fell through to its fallback.
- **The Next `--cms=none` overlay had drifted.**
  `app/layout.tsx` and `app/page.tsx` were whole-file copies frozen at the
  June boilerplate, so a no-CMS shop 500'd on every route (no
  `BaseCategoryProvider`), served the wrong language's HTML (no
  `initialLanguage`), and asked for a hardcoded category id. Both are surgical
  text patches now, so they track the boilerplate and fail loudly instead of
  drifting.
- **`npm run clean` in the CLI package was PowerShell-only** — now a small
  Node script, so it works on macOS and Linux.

### Added

- **`npm run check:textpatches`** — validates every text-patch anchor against
  the boilerplate it patches, across all three stacks. Wired into CI's
  `verify` stage and the CLI's `prepublishOnly`, so a stale anchor is caught
  here rather than by whoever next runs the scaffolder. Currently 50 anchors.
- **`propeller doctor` now checks the live backend.** It
  resolves the configured channel and counts products under the catalog root,
  so a bad api key, a wrong channel id, an empty tenant and a healthy shop are
  four distinct messages instead of one silent empty storefront. Skipped when
  the shop has no `.env.local`/`.env`.
- **The scaffold's next-steps output mentions the git repo it initialised**,
  and how to drop it when scaffolding into an existing repository.

## [0.7.1] - 2026-08-07

### Fixed

- **`--cms=none` (Next) now builds.** The no-CMS scaffold shipped a stale
  whole-file overlay of the category page that predated the SDK-0.14 `Category`
  field pluralisation (`name`→`names`, `description`→`descriptions`,
  `shortDescription`→`shortDescriptions`) and the stock-availability filter, so
  `next build` failed with 6 type errors. Replaced the whole-file overlay with a
  surgical `page.tsx.textpatch.json` that removes only the three CMS-banner touch
  points (imports, server fetch, render) — the page now tracks the boilerplate
  automatically, and a stale anchor errors loudly at scaffold time instead of
  silently shipping a broken page. Mirrors the earlier vue/nuxt un-stale fix.
- **`--cms=none` (Next) fully strips the CMS surface.** The trim left three
  categories of dead/broken CMS code behind: `components/cms/blockRenderers.tsx`
  (imported the 15 deleted block components + `propeller-v2-cms-react` → 15 more
  type errors), the Prepr widgets (`PreprTrack`, `PreprPreviewBar`,
  `PreprSegmentsSync` + their `lib/preprSegments` helper), and the CMS npm deps
  (`propeller-v2-cms-react`, `@contentful/rich-text-html-renderer`,
  `@contentful/rich-text-types`). All are now removed via `no-cms-trim.json`, a
  new `overlay-no-cms/package.patch.json` (drops the deps), and lockfile pruning
  (`CMS_PACKAGES` in `scaffold.ts`). `lib/preprEvent.ts` is deliberately KEPT — a
  no-op tracking seam the surviving product/checkout pages still call.

## [0.7.0] - 2026-07-30

### Added

- **`--punchout=<yes|no>`** — opt into OCI + cXML PunchOut, the B2B
  e-procurement handshake (SAP / Ariba / Coupa punch out to the shop and transfer
  the cart back as a requisition), on all three stacks. **Default is `no`** — only
  e-procurement catalogues need it. A `--punchout=no` scaffold deletes the
  `/api/punchout/*` route handlers and server glue, removes the
  `@propeller-commerce/propeller-v2-punchout` package from `package.json` **and
  prunes it from `package-lock.json`**, patches the cart page back to a plain
  checkout surface, and (for Next) drops the `config.punchout` mapping block, the
  `CXML_SHARED_SECRET` contact attribute and the `PUNCHOUT_*` / `CXML_CONTACT_ID`
  env keys. The choice is recorded in `propeller.json` → `features.punchout`.

## [0.6.0] - 2026-07-24

### Added

- **`--psp=<mollie|multisafepay|none>`** — pick the payment service provider at
  scaffold time, on all three stacks. The unchosen provider is fully removed:
  its npm package is dropped from `package.json` **and pruned from
  `package-lock.json`** (so `npm ci` can't reinstall it), its route handlers and
  server wiring are deleted, and its credential keys are stripped from the env
  example. The chosen provider is pre-set as `PAYMENT_PROVIDER` + the stack's
  public mirror, and recorded in `propeller.json` → `payments.provider`.
  `--psp=none` installs no PSP package at all — checkout places the order and
  goes straight to the thank-you page.
  The Vue shop is the one asymmetry: it registers its PSP routes inline in
  `server.js`, so the unused provider module is replaced by a "not configured"
  stub (routes answer 503) instead of being deleted.
- **`--spare-parts=<yes|no>`** — opt out of the `/machines` section (the
  contact-only browser over the company's `MY_INSTALLATIONS` machines). `no`
  deletes the pages and helper modules, unlinks the route and header nav entry,
  drops the machine config block, and strips the `*MACHINE*` env keys.
  Recorded in `propeller.json` → `features.spareParts`.

### Fixed

- **Un-stale the `--cms=none` overlays for Vue and Nuxt.** The Nuxt AppHeader
  text patch anchored on `const navLinks = ref([`, which the machines feature
  turned into `computed(() => {…})` — the patch matched nothing and every
  `--cms=none` Nuxt scaffold aborted. The Vue no-CMS `router/index.ts` was a
  whole-file overlay that had drifted: it routed to account views the
  boilerplate had removed (so the shop wouldn't build) and lacked the machines
  route. Both are now surgical patches that track the boilerplate.
- **`--cms=none` on Next builds again.** The Prepr CMS work added
  `app/api/preview`, `app/api/cms-revalidate` and a `@/lib/cms/core` import in
  `proxy.ts`; with `lib/cms` trimmed, the build failed on three unresolved
  imports. The two CMS-only endpoints are now trimmed, and `proxy.ts` — the
  locale-rewrite middleware, not CMS code — gets a patch that inlines the one
  helper it borrowed (`isHomeSlug`).
- **`--mode=b2c` on Vue builds again.** `b2c-trim.json` deletes the six B2B
  account views, but propeller-vue's router imports each one explicitly, so
  `vue-tsc` failed with TS2307 on all six (the manifest's claim that routes were
  "folder-imported" was wrong). Added an `overlay-b2c/` slice with a router
  patch; Next and Nuxt are file-routed and need no equivalent.
- **`propeller doctor` no longer fails every shop over `price-requests`.** The
  B2B-route check still expected an account route the boilerplates dropped, so
  a correctly scaffolded shop reported a red check and exited 1.

### Documentation

- Rewrote `docs/content/templates.mdx` to the clone-and-overlay model it has
  used since 0.5.0 (it still described the old `shared/` + `b2b-routes/` copy
  model and only two stacks), including the overlay/trim slice order and the
  per-stack PSP and route-removal differences.
- Documented `--psp` / `--spare-parts` in both READMEs, the CLI reference, the
  quick-start snippets, and the `propeller.json` schema page
  (`features.spareParts`, `payments.provider`).

### Changed

- `_comment` in a `*.patch.json` overlay is now stripped before merging, so
  maintainer notes stay out of the scaffolded shop's JSON.

## [0.5.6] - 2026-06-25

### Added

- **Contentful as a selectable CMS provider.** The Next boilerplate now ships a
  Contentful provider in `lib/cms/providers/contentful.ts`, so the scaffolder
  offers it alongside Strapi and Prepr: `--cms=contentful` (and the interactive
  prompt). Contentful is hosted — no adapter package to install; selecting it
  sets `CMS_PROVIDER=contentful` and uncomments the `CONTENTFUL_SPACE_ID` /
  `CONTENTFUL_ENVIRONMENT` / `CONTENTFUL_CDA_TOKEN` credential lines in the
  shop's `.env.local.example`. The generated `cms/README.md` gains a Contentful
  setup section (Space ID + Delivery API token, optional preview token).

### Documentation

- **Rewrite `docs/cms.mdx` to the env-activation model.** The page still
  described the obsolete adapter-package flow (`npm install` a
  `cms-adapter-*` package and wire a `CmsAdapterProvider`), which no scaffolded
  shop uses. Replaced it with the real model — providers ship in the boilerplate
  and are selected at runtime by `CMS_PROVIDER` — plus a built-in-providers
  table (including Contentful) and a credentials-per-provider table.
- List Contentful in the accelerator README and the CLI package README.

## [0.5.5] - 2026-06-24

### Documentation

- **Fix the Propeller Commerce link in the package README** — pointed at
  `propellercommerce.com` (no hyphen); corrected to `https://propeller-commerce.com/`.

## [0.5.4] - 2026-06-24

### Documentation

- **CLI package README now documents the CMS flow.** The npm package page
  (`packages/cli/README.md`) had no CMS section — added one covering
  `--cms=<provider>`, that CMS is Next-only, env-based activation via
  `CMS_PROVIDER` (no package to install), and the `--cms=none` flat layout.
  Also flagged that a no-CMS shop is flat at the root (`cd my-shop`, not
  `my-shop/frontend`). Docs-only; a version bump is required for npm to
  re-render the package README.

## [0.5.3] - 2026-06-24

### Fixed

- **`--cms=<provider>` now actually activates the CMS.** The Next boilerplate
  ships every CMS provider in `lib/cms` and selects one at runtime from the
  `CMS_PROVIDER` env var, but the scaffolder never set it — so a `--cms=prepr`
  shop silently behaved as no-CMS. Scaffolding with a CMS now writes
  `CMS_PROVIDER=<provider>` (+ its public mirror) into the shop's
  `.env.local.example` and uncomments that provider's credential lines, so the
  built-in provider is wired and the user sees exactly what to fill in. No
  package to install.
- **Generated CMS README / `propeller doctor` no longer point at a
  non-existent npm package.** Both referenced `propeller-v2-cms-adapter-*`
  packages that are not published. The README now explains env-based activation
  (the provider already ships in `lib/cms`), and `doctor` verifies
  `CMS_PROVIDER` matches `propeller.json` → `cms.adapter` (and that `lib/cms`
  exists) instead of looking for the phantom package.

### Changed

- **CMS is a Next-only choice.** Only the Next boilerplate has a CMS engine;
  Vue and Nuxt have none. The CMS prompt is now shown only for the Next stack,
  and `--cms=<x>` on a Vue/Nuxt scaffold prints a notice and proceeds with no
  CMS instead of scaffolding a shop whose CMS selection does nothing.

## [0.5.2] - 2026-06-24

### Added

- **`--cms=none` scaffold option for all three stacks.** A shop with no CMS is
  now laid out flat at the shop root (no `frontend/` split, no sibling `cms/`
  folder) with the entire CMS surface stripped. Next replaces the few
  CMS-referencing core files with CMS-free variants; Vue ships a no-CMS router
  variant (its routes are an array, not files); Nuxt deletes the file-based CMS
  pages and patches the dead `/blog` nav links. The homepage falls back to the
  built-in static page.
- **Prepr as a first-class CMS choice** (`--cms=prepr`), backed by a new
  `cms-adapter-prepr` package that implements the rich `CmsProvider` contract
  with runtime schema introspection.
- **`.textpatch.json` overlay primitive** (`packages/cli`): an ordered list of
  exact find/replace ops applied to a cloned boilerplate file, for surgically
  editing files that merely reference an excised feature (e.g. one nav-link
  entry in a 400-line header) without overlaying them wholesale. Sibling of the
  existing `.patch.json` JSON-merge overlay; includes stale-snippet detection
  and CRLF-agnostic matching.

### Changed

- **CMS adapters adopt the richer `CmsProvider` contract** from
  `propeller-v2-core-ui` (typed blocks, `getGlobal`, category banners) — the
  boilerplate and accelerator now share one source of truth. Adopted
  additively, so existing adapters keep working.
- **`cms-adapter-*` consume `@propeller-commerce/propeller-v2-core-ui` from npm**
  (scoped `^0.3.0`) instead of the github pin.

## [0.5.1] - 2026-06-11

### Added

- **CLI package README** (`packages/cli/README.md`) so the npm package page is
  no longer blank. Documents the scoped install command, stacks, and modes.

### Fixed

- **Docs: install command now uses the scoped package name.** The package
  publishes as `@propeller-commerce/create-propeller-shop`, so the unscoped
  `npx create-propeller-shop` does not resolve from npm. The root and CLI
  READMEs now show `npx @propeller-commerce/create-propeller-shop`. (The
  installed executable remains `create-propeller-shop`.)

## [0.5.0] - 2026-06-09

### Changed (BREAKING — internal scaffold model)

- **Scaffold flow: `git clone --depth 1` of the boilerplate at scaffold time,
  not a stale hand-copied subset of it.** The previous model kept ~190–234
  boilerplate files duplicated under `templates/shop-<stack>/shared/`.
  Boilerplate fixes had to be manually re-copied or shops silently shipped
  stale code — exactly the drift that produced the missing `proxy.ts` in
  shop-next, the divergent `data/config.ts` (133 lines vs the boilerplate's
  175), and the broken accelerator-vs-boilerplate parity the user finally
  called out. New flow:
  1. `git clone --depth 1 --branch master --single-branch <boilerplate-repo>` into a tempdir.
  2. Copy the boilerplate's `frontend/` (or repo root for next + nuxt) into the scaffold destination, EXCLUDING `node_modules`, `.git`, `.next`, `.nuxt`, `.output`, `dist`, `.vite`, `.turbo`, `playwright-report`, `test-results`, `coverage`, `.claude`, `memory`, and ANY `.env*` file (real secrets, not template defaults).
  3. Apply `templates/shop-<stack>/overlay/` on top — currently `package.patch.json` (deep-merged onto the boilerplate's package.json) and `README.template.md`.
  4. If `mode === 'b2c'`, delete paths listed in `templates/shop-<stack>/b2c-trim.json` (quotes, quote-requests, authorization-*).
  5. Write `propeller.json` as before.

- **JSON patch overlay model.** Overlay files ending in `.patch.json` are
  DEEP-MERGED onto the boilerplate's existing JSON, instead of replacing
  it wholesale. The previous `package.template.json` had to carry the
  ENTIRE package.json including every dependency version — which froze
  deps at whatever was committed to the accelerator and silently
  downgraded the boilerplate's current versions. With `.patch.json` the
  boilerplate's version always wins for any key the patch doesn't
  explicitly override. To DELETE a key (e.g. drop a script the boilerplate
  ships), set it to `null` in the patch.

- **Local-boilerplate override for development.** Set
  `PROPELLER_NEXT_BOILERPLATE_LOCAL`, `PROPELLER_VUE_BOILERPLATE_LOCAL`,
  or `PROPELLER_NUXT_BOILERPLATE_LOCAL` to a directory path and the CLI
  copies from it instead of cloning. Lets you test in-flight boilerplate
  changes without pushing first. Skipped files still apply.

- **`templates/shop-<stack>/b2c-trim.json`** — replaces the old
  `templates/shop-<stack>/b2b-routes/` model. The boilerplate ships every
  route (b2b/hybrid is the default); the trim manifest deletes b2b-only
  routes when `mode === 'b2c'`. Symmetric inversion of the old approach
  but compatible with "boilerplate is the source of truth".

### Removed

- `templates/shop-<stack>/shared/` — ~190–234 files per stack of stale
  boilerplate-copied code, deleted entirely.
- `templates/shop-<stack>/b2b-routes/` — replaced by the b2c-trim
  manifest model described above.
- `packages/cli/src/template/copy.ts` — superseded by
  `packages/cli/src/template/clone.ts`.
- The templated `.template.ts/tsx/vue` overlay variants of `layout.tsx`,
  `next.config.ts`, `proxy.ts`, `data/config.ts`, `nuxt.config.ts`,
  `src/router/index.ts` are gone. The boilerplate's real versions are
  authoritative; anything truly shop-specific lives in `.env.local` or
  `propeller.json` and is read at runtime, not baked at scaffold time.

### Added

- **`templates/shop-next/shared/proxy.template.ts`** — adds the language-prefix
  URL rewrite that the propeller-next boilerplate ships but that the
  accelerator template was missing. Without it, a hard reload of
  `/en/category/X/Y` (or any other localised dynamic route) falls into
  the `(cms)/[...slug]` catch-all, calls `getPage('en/category/X/Y')`,
  returns null, and 404s. The proxy now strips the language prefix
  internally so the matching `category/[id]/[slug]` page renders, and
  sets the `preferred_language` cookie so the client-side LanguageContext
  picks the same locale up on first load. Closes the "Next test shop
  throws 404 constantly when switching language" report.
- **`nonDefaultLocalesJsonArray` substitution token** — `locales` minus
  `defaultLocale`, JSON-array-stringified. Used by the new
  `proxy.template.ts` to populate `LOCALE_PREFIXES`. Drives URL-prefix
  rewrite tables (and any future template that needs the same "everything
  except the default" projection of the locale list).

### Fixed

- **`propeller-v2-vue-ui` SSR crash on catalog pages.** The package
  shipped via the `#master` GitHub pin had three unsafe
  `props.configuration.urls.getX()` dereferences (`ProductCard.vue:913`,
  `ClusterCard.vue:700`, `Breadcrumbs.vue:199`). SearchView/CategoryView
  don't pass `:configuration` to `<ProductGrid>`, so SSR rendering of
  the first product card threw `Cannot read properties of undefined
  (reading 'urls')` and returned 500. Fixed upstream at vue-ui master
  (`5c9c06e`, version 0.3.7) with `?.urls?.` guards plus `'#'` fallback.
  New `shop-vue` / `shop-nuxt` test shops scaffolded from `master` will
  pick this up automatically (both templates pin `#master`).

- **i18n locales registry + AccessErrorView across all three templates** —
  ports the propeller-vue 70aa338 / propeller-next a04c333 / propeller-nuxt
  d970fc7 i18n work, plus the fa7a4a3 / 795c896 / 7596f25 friendly 403/404
  error views.
  - **shop-next** `shared/lib/i18n/{index,client,server}.ts` +
    `providers/file.ts`, `shared/locales/{en,nl}/*.json` (56 namespaces),
    `shared/scripts/build-locales-registry.mjs`,
    `shared/components/access/AccessErrorView.tsx`, `shared/lib/errors.ts`.
    `layout.template.tsx` wraps `<TranslationsProvider>`. `package.template.json`
    gains `locales:build` + `predev` + `prebuild` scripts. All ~20 touched
    pages + 3 islands + Header.tsx + 2 cms block components synced from
    propeller-next master tip. `app/csr/*` shadows added (weren't in the
    original 0.2.0 template).
  - **shop-vue** `shared/src/lib/i18n/{index,composable,providers/file}.ts`,
    `shared/src/locales/{en,nl}/*.json` (55 namespaces),
    `shared/scripts/build-locales-registry.mjs`,
    `shared/src/components/access/AccessErrorView.vue`, `shared/src/lib/errors.ts`.
    `package.template.json` gains `locales:build` + `predev` + `prebuild`
    scripts. ~25 touched views + AppHeader.vue + AccountLayout.vue synced
    from propeller-vue master tip. `src/views/csr/*` shadows added.
  - **shop-nuxt** `shared/app/lib/i18n/{index,providers/file}.ts`,
    `shared/app/locales/{en,nl}/*.json` (55 namespaces),
    `shared/scripts/build-locales-registry.mjs`,
    `shared/app/components/access/AccessErrorView.vue`, `shared/app/lib/errors.ts`.
    `useTranslations.ts` composable swapped from stub to file-provider
    delegate. `package.template.json` gains `locales:build` + `predev` +
    `prebuild` scripts. 4 detail pages (order/quote/quote-request/thank-you)
    wired to AccessErrorView.

  Smoke-tested by scaffolding all three stacks via
  `PROPELLER_TEMPLATES_DIR=… create-propeller-shop … --stack={next|vue|nuxt}
  --mode=hybrid --skip-install --yes` into D:/tmp/propeller-test/{next,vue,nuxt}-i18n.
  Verified each shop landed with the right locales count, AccessErrorView,
  lib/i18n tree, and locales:build script.

- **`templates/shop-nuxt/`** — Nuxt 3 SSR shop template extracted from
  `propeller-nuxt`. `create-propeller-shop --stack=nuxt` now produces a
  runnable Nuxt shop with the same mode-specific surface as the Next
  and Vue templates. Closes the consumer-matrix gap: same backend,
  same routes, same cache contract — now with a Vue SSR runtime.
  - **`shared/`** — Nuxt 4-style `app/` directory (pages, layouts,
    components, plugins, middleware, stores, composables, utils),
    Nitro `server/` (api endpoints + utils), `i18n/locales/`,
    `nuxt.config.template.ts`, `package.template.json`,
    `tailwind.config.ts`, `tsconfig.json`, `.env.example`, `.gitignore`.
    Catalog pages (`category/[id]/[slug]`, `cluster/[clusterId]/[slug]`,
    `product/[productId]/[slug]`, `search`) ship as server-rendered
    shells with the interactive grid/filters/toolbar mounted inside
    `<ClientOnly>`. Anonymous catalog fetches go through
    `server/utils/cache.ts:cachedSdkFetch` backed by Nitro
    `useStorage('cache')` with per-entity tags from
    `server/utils/tags.ts`.
  - **`b2b-routes/`** — 8 B2B-only pages mounted only when
    `mode !== 'b2c'`: `app/pages/account/quotes/`,
    `app/pages/account/quote-requests/`,
    `app/pages/account/authorization-requests.vue`,
    `app/pages/account/authorization-settings.vue`,
    `app/pages/account/price-requests.vue`, and
    `app/pages/authorization-request-sent/[cartId].vue`.
  - **`Stack` enum** extended to `'next' | 'vue' | 'nuxt'`. CLI
    `--stack=nuxt`, prompt menu adds the option, `propeller doctor`
    learns the Nuxt-shape b2b-routes probe and the
    `app/utils/config.ts` portalMode lookup.
  - **`nuxt.config.template.ts`** — first templated `.ts` file in any
    template. The Vite alias for `#app-manifest` and the
    `tailwindcss:sources:extend` hook are resolved off `__dirname`
    instead of hard-coded absolute paths (the propeller-nuxt source
    used a Windows-only literal that wouldn't survive scaffold).

## [0.4.0] - 2026-06-02

Aligns both shop templates (`shop-next`, `shop-vue`) with the
prop-cascade cleanup completed in the upstream package + reference
boilerplates.

### Why this matters

A shop scaffolded before 0.4.0 started life with the verbose
infra-prop-cascading pattern: every view explicitly passed
`graphqlClient`, `user`, `companyId`, `language`, `includeTax`,
`currency`, `configuration`, and `portalMode` to every package
component, even though `<PropellerProvider>` was wrapping the routed
tree and could resolve them. After this release a fresh scaffold starts
clean — components resolve from the provider, views only pass domain
props.

### What changed under the hood

This release sits on top of:

- `propeller-v2-react-ui@0.4.0` — retrofitted 6 client components to
  consume `useInfraProps`; added provider-aware client wrappers for the
  6 `@rsc-safe` components (the pure versions stay on `/pure` for RSC
  use).
- `propeller-v2-vue-ui@0.3.1` — fixes the critical `inject()`-inside-
  `computed` bug introduced in 0.3.0 that broke anonymous AddToCart on
  every retrofitted page. **Required**: 0.3.0 scaffolds are silently
  broken; 0.4.0 scaffolds are correct.

Both templates already pin the package via `github:...#master`, so a
fresh `npx create-propeller-shop` picks up the post-fix builds
automatically. No template-side dependency bump needed.

### Template changes (mechanical prune)

**shop-next** (10 files, mirrors propeller-next's `0f65f50` +
`ae9117c` + `16c9350`):

- `app/account/layout.tsx`, `app/account/page.tsx`
- `app/category/[id]/[slug]/CategoryIsland.tsx` + `page.tsx`
- `app/checkout/page.tsx`
- `app/cluster/[clusterId]/[slug]/ClusterDetailIsland.tsx`
- `app/product/[productId]/[slug]/ProductDetailIsland.tsx` + `page.tsx`
- `app/search/[[...term]]/SearchIsland.tsx` + `page.tsx`

**shop-vue** (23 files, mirrors propeller-vue's `94f74d3` + `b6f604c`
+ `d30040c`):

- 21 `src/views/**` files: catalog (Category, Cluster, Product,
  Search), Cart, Checkout, Home, Login, Register, ForgotPassword,
  Account views (Account, Addresses, FavoriteDetail, Favorites,
  OrderDetail, Orders), B2B account views (AuthorizationRequests,
  AuthorizationSettings, QuoteDetail, QuoteRequests, Quotes).
- 2 `src/components/layout/**`: `AppHeader.vue` (the largest single
  cleanup — CompanySwitcher, SearchBar ×2, AccountIconAndMenu,
  CartIconAndSidebar, PropellerMenu ×2), `AccountLayout.vue`.

### What stays

A small set of explicit infra props remains intentional:

- **`graphqlClient={orderEditorGraphqlClient}` on
  `<PurchaseAuthorizationConfigurator>`** in
  `b2b-routes/.../authorization-settings/page.tsx` — only place using a
  non-default GraphQL client.
- **`<ProductPrice>` / `<ProductBulkPrices>` from
  `propeller-v2-react-ui/pure`** keep explicit `includeTax` / `user` /
  `portalMode` / `currency` — they're rendered from Server Components
  (`ProductPriceIsland` shape) and the provider isn't reachable in RSC.
- **`<CompanySwitcher>` `user` prop** — component not yet retrofitted
  in either UI package.
- **`<PriceToggle>` `includeTax` / `language` props** (Vue) — not yet
  retrofitted in vue-ui.

### Migration

None. Existing scaffolded shops keep working unchanged (the templates
have no effect on already-generated shop directories). A fresh
`create-propeller-shop` run gets the clean version.

## [0.3.3] - 2026-06-02

### Added

- **Docusaurus documentation site** under `docs/`, deployed to
  https://propeller-commerce.github.io/propeller-v2-accelerator/ via a
  new `.github/workflows/docs.yml` GitHub Action (build + GitHub Pages
  deploy). The biggest of the new docs sites — covers getting-started,
  the `create-propeller-shop` CLI reference, `propeller doctor`, the
  three shop modes (b2b / b2c / hybrid) with the portal-mode interaction,
  the per-template surface (shop-next + shop-vue), CMS adapter wiring,
  the flat scaffolded `<shop>/{frontend,cms}/` layout, the
  `propeller.json` schema (including every substitution variable), and
  the Phase B/C roadmap.
- **`release_to_github` stage in `.gitlab-ci.yml`** — automatic GitHub
  Release on every `Release X.Y.Z` push, mirroring the SDK pattern.

### Notes

No CLI / scaffolding behaviour changes — this is a tooling release that
backfills documentation + release automation. Existing scaffolded shops
are unaffected.

## [0.3.2] - 2026-06-02

### Changed

- **Dropped the `public_html/` segment from scaffold output.** Shops now
  land as `<name>/frontend/` and `<name>/cms/` instead of
  `<name>/public_html/frontend/` and `<name>/public_html/cms/`. The
  `public_html/` indirection was a holdover from cPanel-style hosting that
  doesn't apply to the modern deployment targets we ship to — it just
  added a directory hop with no upside.
- `propeller doctor` now resolves `propeller.json` from `./` or
  `./frontend/` (was `./public_html/frontend/`).
- `scaffold.ts` writes the frontend and CMS trees directly under the shop
  root; the next-steps banner now prints `cd <name>/frontend` instead of
  the longer path.
- Doc updates in `README.md`, both `README.template.md` files, the
  `propeller.json` schema docstring, and the `cmsReadme.ts` header
  comment to match.

### Migration

Existing scaffolded shops are unaffected — the change only touches new
scaffolds. If you want to flatten an existing tree manually, move
`public_html/frontend/` and `public_html/cms/` up one level and delete
the empty `public_html/`.

## [0.3.1] - 2026-06-01

End-to-end validation fixes — turning the smoke-test into a green `doctor`
run on real scaffolded shops.

### Fixed

- **Scaffolded shops no longer ship `.gitkeep` placeholders.** The copy
  walker now skips `.gitkeep` (and the internal `template.json` manifest)
  by name. Also removed the leftover `.gitkeep` files from the template
  trees themselves so the skip is belt-and-braces.
- **`propeller doctor`'s B2B route check** was looking for
  `app/account/contacts` (Next) and `ContactsView.vue` (Vue), neither of
  which exists in the boilerplate. Swapped the third probe to
  `price-requests` / `PriceRequestsView.vue` so the check matches what the
  templates actually emit.
- **`propeller doctor`'s CMS adapter check** was emitting `fail` for a
  declared adapter that wasn't installed. Demoted to `warn` because the
  adapter packages are not yet published to npm and not pinned in
  `package.json` at scaffold time — the user installs them manually. The
  doctor still surfaces the gap so the omission isn't silent.

### Validated

`create-propeller-shop e2e-hybrid --stack=next --mode=hybrid --cms=strapi --yes`
followed by `propeller doctor` in the scaffolded shop now returns
`All checks passed.` with three green checks and two yellow warnings (the
not-yet-installed packages).

## [0.3.0] - 2026-06-01

Vue 3 + Vite SSR shop template extracted from `propeller-vue/frontend`.
`create-propeller-shop --stack=vue` now produces a runnable Vue shop with
the same mode-specific surface as the Next template (0.2.0).

### Added

- **`templates/shop-vue/shared/`** — root config (`index.html`,
  `server.js`, `vite.config.ts`, three tsconfigs, `.env.example`,
  `.gitignore`) plus the entire `src/` tree (`App.vue`, entry points,
  `assets/`, `components/`, `composables/`, `lib/`, `stores/`, `views/`
  minus B2B views and `views/csr/` + `views/blog/`). The `src/views/account/`
  retains only universal views: Account, Addresses, Favorites,
  FavoriteDetail, Invoices, Orders, OrderDetail.
- **`templates/shop-vue/b2b-routes/`** — 6 B2B views moved out of shared:
  QuotesView, QuoteDetailView, QuoteRequestsView, AuthorizationRequestsView,
  AuthorizationSettingsView, PriceRequestsView. Copied into the same
  `src/views/account/` path when `mode !== 'b2c'`.
- **`src/router/index.template.ts`** — replaces the static `router/index.ts`.
  Two Handlebars-driven behaviours:
  - `SHOP_MODE` constant is baked in (`'b2b'` / `'b2c'` / `'hybrid'`) and
    drives the runtime userMode guard.
  - `{{#unless isB2C}}…{{/unless}}` block around the B2B route entries —
    they're not registered at all in a pure b2c shop, so the router has
    nothing to match (no need to rely on the runtime guard for b2c).
  - `registerGuards` gains a new userMode check after the auth gate:
    routes listed in `routeUserModes` return `{ name: 'not-found' }` when
    the resolved userMode doesn't match. Anonymous users pass through (the
    auth guard handles them).
- **`package.template.json`** and **`README.template.md`** mirroring the
  Next versions but for the Vue dependency set.
- `template.json` for Vue bumped to `0.3.0` so the manifest version
  matches the CLI/template version.

### Smoke-tested

`create-propeller-shop test-vue-b2c --stack=vue --mode=b2c --cms=none --yes`
and the hybrid+strapi / b2b+cms variants all produce the expected per-mode
view sets and per-mode router registrations.

## [0.2.0] - 2026-06-01

Next.js shop template extracted from `propeller-next` and wired through the
scaffolder. `create-propeller-shop --stack=next` now produces a runnable
shop tree (115 files, 1.3 MB) in `<name>/frontend/` with the
correct mode-specific surface.

### Added

- **`templates/shop-next/shared/`** — 107 files covering everything every
  Next shop needs regardless of mode: `app/` routes (login, register, cart,
  checkout, product, cluster, category, search, CMS catch-all, blog, the
  universal `account/{orders,addresses,favorites,invoices}` subtree, all
  api routes including `auth/`, `graphql/`, `revalidate/`), `components/`,
  `context/` (Auth, Cart, Company, Global, Language, Price), `data/`
  (config, countries, defaults, companyViewerAttributes), `hooks/`, `lib/`
  (api, cms, server, seo, services, listingParams, userHint, utils),
  `utils/`, and the entire `public/` static asset folder.
- **`templates/shop-next/b2b-routes/`** — 8 files mounted only when
  `mode !== 'b2c'`: `app/account/{quotes,quote-requests,authorization-requests,authorization-settings,price-requests}/`,
  each gated at the page root with `RequireUserMode allow={['b2b']}`.
- **`lib/routeGuards.ts`** (NEW shared file) — declarative map of route →
  allowed userModes. Pages call `RequireUserMode` in the JSX tree; a
  hybrid Customer hitting `/account/quotes` gets `notFound()` (the
  middleware-level guard was dropped — the JWT cookie carries no user
  type, so a per-page client guard is the simpler path).
- **`components/auth/RequireUserMode.tsx`** (NEW shared file) — client
  component that reads `useUserMode()` from the React UI package and
  triggers `notFound()` when the resolved mode isn't allowed.
- **Six `.template.*` parameterised files**, rendered through Handlebars
  at scaffold time and emitted with the `.template` suffix stripped:
  `data/config.template.ts`, `app/layout.template.tsx`,
  `next.config.template.ts`, `package.template.json`, `README.template.md`,
  `.env.example`.
- **Substitution context** extended with `isB2B`/`isB2C`/`isHybrid` mode
  flags, `cmsAdapterTsValue`/`cmsAdapterJsonValue`/`cmsAdapterPackage`/
  `cmsAdapterDisplay` CMS variants, `portalModeConstant` (uppercase enum
  form), `defaultLocaleLower`, `siteHostname`/`apiHostname` derived from
  `siteUrl`, and `featureQuotes`/`featureAuthorization`/`featureContacts`
  mode-derived defaults.

### Changed

- `collectShopConfig` now respects `defaults.yes` — missing values short-
  circuit to built-in defaults (stack=next, mode=hybrid, cms=none,
  locales=['en'], currency=EUR, portalMode=defaultPortalForMode(mode),
  siteUrl=`https://<name>.example.com`) instead of opening a prompt the
  caller can't answer in non-TTY runs.
- `data/config.template.ts` exposes a new `shopMode` literal and defaults
  `includeVAT: true` (gross), tracking the runtime decision baked into
  Phase 0.
- B2B page roots refactored from `export default function Page() { … }` to
  `export default function Page() { return <RequireUserMode>…</RequireUserMode>; } function PageInner() { … }` so the
  client-side userMode gate runs before the body executes.

### Known limitations

- CMS adapter packages (`propeller-v2-cms-adapter-strapi`,
  `-cms`) live inside this monorepo's `packages/`; they are not yet
  published to npm or split into standalone repos, so the scaffolded
  `package.json` does not pin them. The scaffolded README instructs the
  user to install them manually via `--install-links file:../../...` or
  `npm install` once they are published. The `propeller.json -> cms.adapter`
  field still records the choice so `propeller doctor` can verify
  installation later.
- `next.config.template.ts` ships a minimal `remotePatterns` list derived
  from the `siteUrl`. Shops with non-conventional API hostnames must edit
  it after scaffolding.

## [0.1.0] - 2026-06-01

Initial scaffold. Monorepo skeleton + CLI shell + the two CMS adapter
packages. Templates ship empty (just `.gitkeep` + `template.json`); the
Next and Vue templates will be extracted from `propeller-next` and
`propeller-vue` in 0.2.0.

### Added

- **`packages/cli/`** — `create-propeller-shop` and `propeller` binaries
  built with tsup. Three commands:
  - `create-propeller-shop <name> [flags]` — interactive scaffold flow.
    Accepts `--stack`, `--mode`, `--cms`, `--locales`, `--default-locale`,
    `--currency-code`, `--portal-mode`, `--site-url`, `--skip-install`,
    `--yes`. Any missing flag is asked via `@inquirer/prompts`.
  - `propeller doctor` — validates `propeller.json` against the Zod
    schema, verifies pinned packages are installed, checks portalMode
    matches `data/config.ts`, confirms B2B route presence matches mode,
    and verifies the declared CMS adapter is installed.
  - `propeller upgrade` and `propeller eject` — reserved for Phase B.
- **`packages/cms-adapter-strapi/`** — Strapi v5 REST `CmsAdapter`
  implementation. Three methods (`getPage`, `getMenu`, `getGlobals`),
  optional API token, customisable `fetch` impl for tests.
- **`packages/cms-adapter-cms/`** — Stub for the generic Propeller CMS
  backend. Returns `null` from `getPage`/`getMenu`, `{}` from
  `getGlobals`. Exists so the adapter pattern is exercised end-to-end
  without blocking on backend availability.
- **`templates/shop-next/`** + **`templates/shop-vue/`** — Empty
  directories with `template.json` manifests declaring stack, version,
  and `propellerCompat` ranges. The actual route + component extraction
  lands in 0.2.0.
- **`propeller.json` schema** — Full Zod definition with `ShopMode`,
  `PortalMode`, `CmsAdapter`, `Stack`, and a `buildPropellerJson` helper
  that translates prompt answers into a valid manifest.

### Scope

v0.1 ships scaffolding **infrastructure** — CLI, schema, prompts, copy
walker, doctor. v0.2 ships the actual templates extracted from
propeller-next + propeller-vue. The schema and ejected list are wired
in from day one so Phase B (`upgrade`, `eject`) is non-breaking.
