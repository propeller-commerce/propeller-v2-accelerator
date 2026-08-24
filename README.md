# propeller-v2-accelerator

Scaffolding monorepo for Propeller Commerce shops. Turns "new shop" into:
pick a stack, pick a mode, pick a CMS, answer ~10 prompts, get a working
shop in minutes.

## Packages

| Path | What it ships |
|---|---|
| [`packages/cli/`](packages/cli/) | `create-propeller-shop` + `propeller` CLI binaries (the only published package) |

> The `packages/cms-adapter-*` folders are standalone ports of the Next
> boilerplate's CMS providers. They are **not** published and **not** consumed
> by scaffolded shops — the providers ship inside the Next boilerplate's
> `lib/cms` and are selected at runtime (see [CMS](#cms) below). Treat them as
> legacy; they may be removed.

## Templates

The CLI clones the upstream boilerplate fresh at scaffold time, then applies a
thin overlay of templated values on top. Templates are not workspaces — they're
the overlay + trim manifests, not a full copy of each boilerplate.

| Path | What it scaffolds |
|---|---|
| [`templates/shop-next/`](templates/shop-next/) | Next 16 + React shop |
| [`templates/shop-vue/`](templates/shop-vue/) | Vue 3 + Vite SSR shop |
| [`templates/shop-nuxt/`](templates/shop-nuxt/) | Nuxt 3 SSR shop |

Each template directory contains:

- `overlay/…` — templated files (package.json, README, propeller.json, …) laid
  over the cloned boilerplate. `*.template.*` are rendered with the shop's
  values; `*.patch.json` deep-merge onto a JSON file; `*.textpatch.json` apply
  surgical find/replace to a source file (so a one-line edit doesn't freeze a
  whole file against future boilerplate changes). A `*.textpatch.json` anchor is
  matched **literally** — it is a verbatim copy of boilerplate source, so Vue's
  `{{ … }}` interpolation is safe inside it.
- `overlay-no-cms/…` — CMS-free variants applied when `--cms=none`.
- `overlay-psp-<none|mollie|multisafepay>/…` — applied for the chosen `--psp`;
  drops the unused PSP package(s) from `package.json` (and, in the Vue shop,
  swaps the unused provider module for a "not configured" stub, because that
  boilerplate registers its PSP routes inline in `server.js`).
- `overlay-no-machines/…` — applied when `--spare-parts=no`; unlinks the
  `/machines` section from the header nav, router and config.
- `overlay-no-punchout/…` — applied when `--punchout=no` (the default); drops the
  punchout package from `package.json` and patches the cart page / server wiring
  that references it.
- `b2c-trim.json` / `no-cms-trim.json` / `psp-<choice>-trim.json` /
  `no-machines-trim.json` / `no-punchout-trim.json` — `{ "remove": [...] }`
  manifests of paths to delete for B2C shops, no-CMS shops, the unchosen PSP(s),
  spare-parts opt-outs, and punchout opt-outs.

### Keeping text patches honest

A text patch anchors to an exact snippet of the boilerplate. When the
boilerplate moves, the anchor goes stale and the patch throws at scaffold time
— by design, so it can never apply silently and wrongly. The catch is *who*
sees the throw: one stale anchor left `--stack=vue` unable to scaffold at all,
because a boilerplate commit had added `meta: { ssrKey }` to the blog routes
months earlier and nothing on our side noticed.

`npm run check:textpatches` runs that same check here instead. It resolves each
boilerplate — `PROPELLER_<STACK>_BOILERPLATE_LOCAL` if set (the same env vars
the CLI honours, useful while a boilerplate change and its patch are both
unpushed), otherwise a shallow clone at `--ref` (default `master`) — and
verifies every anchor still matches:

```bash
npm run check:textpatches                     # all stacks, boilerplate master
npm run check:textpatches -- --stack vue      # one stack
npm run check:textpatches -- --ref develop    # against a different branch
```

That gate only covers our side of the anchor. Once a version is published, a
later boilerplate commit can invalidate an anchor that was correct when it
shipped, and nothing notices until someone scaffolds - which is how 0.9.0
broke. The shipped `propeller check-anchors` is the same check, run from a
boilerplate's own pipeline against the published CLI:

```bash
npx -y -p @propeller-commerce/create-propeller-shop propeller check-anchors --stack next --boilerplate .
```

It runs in CI's `verify` stage and again from the CLI's `prepublishOnly`, so a
release cannot ship a stale anchor. **Ordering note:** because it validates
against the boilerplate's `master`, a patch that anchors to an unreleased
boilerplate change will fail until that boilerplate reaches `master` — land the
boilerplate first, or together.

## Scope

**v0.1 ships scaffolding only.** Upgrade (`propeller upgrade`) and
mode-migration (`propeller migrate-mode`) are sketched in the plan but
deferred. The `propeller.json` schema and `customisations.ejected` list
are wired in from day one so the deferred work is non-breaking.

## Three shop modes

| Mode | Account routes | Portal default | Register form |
|---|---|---|---|
| `b2b` | + quotes, authorization, contacts | `semi-closed` | Contact only (picker hidden) |
| `b2c` | universal only | `open` | Customer only (picker hidden) |
| `hybrid` | + quotes, authorization, contacts (gated at runtime) | `open` | Both (picker visible) |

VAT toggle is **always present and defaults to gross**, regardless of mode.

## CMS

`--cms=<provider>` picks the CMS backend. Accepted values: `strapi`, `prepr`,
`contentful`, `cms` (generic Propeller CMS), or `none`.

**CMS is a Next-only capability.** Only the Next boilerplate ships a CMS engine
(`lib/cms`, with all providers built in); Vue and Nuxt have none. Passing
`--cms=<x>` to a Vue or Nuxt scaffold prints a notice and proceeds with no CMS.

**There is no adapter package to install.** Every provider already ships in the
Next boilerplate's `lib/cms` and is selected at runtime from the `CMS_PROVIDER`
env var. When you scaffold with a CMS, the CLI:

- sets `CMS_PROVIDER=<provider>` in the shop's
  `.env.local.example` and uncomments that provider's credential lines, so the
  built-in provider is wired and you can see exactly what to fill in;
- writes `my-shop/cms/README.md` with backend-specific setup steps;
- records `cms.adapter` in `propeller.json` so `propeller doctor` can verify the
  shop's `CMS_PROVIDER` matches.

To finish: copy `.env.local.example` → `.env.local` and fill in the provider
credentials (a Strapi URL/token, a Prepr access token, or a Contentful Space ID
+ Delivery API token). To switch provider later, change `CMS_PROVIDER` (and keep
`propeller.json` → `cms.adapter` in sync).

**`--cms=none`** scaffolds the shop **flat at the root** (no `frontend/` split,
no `cms/` folder) with the entire CMS surface stripped; the homepage falls back
to its built-in static page and marketing slugs return 404.

## Payments

`--psp=<provider>` picks the payment service provider: `mollie`,
`multisafepay`, or `none`. Unlike `--cms` this works on all three stacks — every
boilerplate ships both integrations and activates one at runtime from
`PAYMENT_PROVIDER`.

The scaffold keeps only what the shop uses:

- the unchosen provider's npm package is removed from `package.json` **and
  pruned from `package-lock.json`**, so `npm ci` can't reinstall it;
- its route handlers and server wiring are deleted (in the Vue shop they stay as
  a "not configured" stub returning 503, because `server.js` registers the
  routes inline and importing a deleted module would crash the server);
- its credential keys are stripped from the env example, and the chosen
  provider is pre-set as `PAYMENT_PROVIDER` (+ the public mirror);
- the choice is recorded in `propeller.json` → `payments.provider`.

**`--psp=none`** leaves no PSP package installed at all. Checkout places the
order and goes straight to the thank-you page — the boilerplate's built-in
behaviour when no provider is configured.

## Spare parts

`--spare-parts=no` removes the `/machines` section: a contact-only browser over
the machines listed in the company's `MY_INSTALLATIONS` attribute, used to find
and order spare parts. It deletes the pages and helper modules, unlinks the
route/nav entry, drops the machine config block and strips the `*MACHINE*` env
keys. Default is `yes` (the boilerplate ships it).

## PunchOut

`--punchout=yes` keeps OCI + cXML PunchOut: the B2B e-procurement handshake where
a buyer inside their ERP (SAP, Ariba, Coupa) "punches out" to the shop, shops in
a live session, then transfers the cart back as a requisition. It builds on the
boilerplate's magic-token login and is powered by the framework-free
[`@propeller-commerce/propeller-v2-punchout`](https://www.npmjs.com/package/@propeller-commerce/propeller-v2-punchout)
package (see its README for the protocols, the flow, and the configurable
field-mapping engine). Works on all three stacks — Next API routes, the Vue
Express server, Nuxt Nitro endpoints.

**Default is `no`.** Only e-procurement catalogues need PunchOut, so it's opt-in.
A `--punchout=no` scaffold:

- deletes the `/api/punchout/*` route handlers and the server glue
  (`lib/punchout.ts` / `src/server/punchout.js` / `server/utils/punchout.ts`);
- removes the punchout package from `package.json` **and** prunes it from
  `package-lock.json` so `npm ci` can't reinstall it;
- patches the cart page back to a plain checkout surface (the "Transfer cart to
  procurement" button and its session-flag read are removed) and, for Next, drops
  the `config.punchout` mapping block, the `CXML_SHARED_SECRET` contact attribute
  and the `PUNCHOUT_*` / `CXML_CONTACT_ID` env keys;
- records `features.punchout: false` in `propeller.json`.

To enable it (`--punchout=yes`): set `PUNCHOUT_ENABLED=true` and the buyer
`CXML_CONTACT_ID` in the env file, and elevate the order-editor API key's rights
so it can mint magic tokens. The package README covers the ERP-side wiring.

## Quick start

```bash
npx @propeller-commerce/create-propeller-shop@latest my-shop \
  --stack=next \
  --mode=hybrid \
  --cms=strapi
```

> The package is published under the scoped name
> `@propeller-commerce/create-propeller-shop`, so the `npx` invocation must
> include the scope. (The executable it installs is still `create-propeller-shop`.)

Or pick another stack:

```bash
npx @propeller-commerce/create-propeller-shop@latest my-vue-shop  --stack=vue  --mode=hybrid
npx @propeller-commerce/create-propeller-shop@latest my-nuxt-shop --stack=nuxt --mode=hybrid
```

Then:

```bash
cd my-shop/frontend   # a no-CMS shop (--cms=none) is flat: cd my-shop
npm run dev
```

For a CMS shop, the companion backend setup lives in `my-shop/cms/README.md`
(per-provider instructions). See [CMS](#cms) above for how the provider is
activated. A `--cms=none` shop has no `cms/` folder — the app is flat at the
shop root.

## Releasing

The CLI publishes to npm from `master` only, gated on its
`packages/cli/package.json` version not already being on npm **and** the
matching `## [<version>]` section in [`CHANGELOG.md`](CHANGELOG.md) not being
marked *Unreleased*. The publish is idempotent — **bump the CLI version** (and
add a changelog section) or a master push silently no-ops. Work on `develop` and
merge to `master` to release.
