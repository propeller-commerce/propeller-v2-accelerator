# @propeller-commerce/create-propeller-shop

Scaffold a new [Propeller Commerce](https://propeller-commerce.com/) shop in
minutes: pick a stack, pick a mode, pick a CMS, answer a few prompts, and get
a working storefront wired to the Propeller GraphQL backend.

## Quick start

```bash
npx @propeller-commerce/create-propeller-shop@latest my-shop \
  --stack=next \
  --mode=hybrid \
  --cms=strapi
```

> Published under the scoped name `@propeller-commerce/create-propeller-shop`,
> so the `npx` invocation must include the scope. The executable it installs is
> still `create-propeller-shop`.

Pick another stack:

```bash
npx @propeller-commerce/create-propeller-shop@latest my-vue-shop  --stack=vue  --mode=hybrid
npx @propeller-commerce/create-propeller-shop@latest my-nuxt-shop --stack=nuxt --mode=hybrid
```

Then:

```bash
cd my-shop/frontend   # a no-CMS shop (--cms=none) is flat: cd my-shop
cp .env.local.example .env.local   # .env.example / .env for vue + nuxt
npm install
npm run dev
```

## Stacks

| `--stack` | Framework |
|---|---|
| `next` | Next 16 + React |
| `vue`  | Vue 3 + Vite SSR |
| `nuxt` | Nuxt 3 SSR |

## Modes

| `--mode` | Account routes | Portal default | Register form |
|---|---|---|---|
| `b2b`    | + quotes, authorization, contacts | `semi-closed` | Contact only |
| `b2c`    | universal only | `open` | Customer only |
| `hybrid` | + quotes, authorization, contacts (gated at runtime) | `open` | Both |

## CMS

`--cms=<provider>` picks the CMS backend: `strapi`, `prepr`, `contentful`, `cms`
(generic Propeller CMS), or `none` (default).

- **CMS is Next-only.** Only the Next stack ships a CMS engine; `--cms` on a Vue
  or Nuxt scaffold prints a notice and proceeds with no CMS.
- **No adapter package to install.** Every provider ships inside the Next
  boilerplate's `lib/cms` and is selected at runtime from the `CMS_PROVIDER` env
  var. Scaffolding with a CMS sets `CMS_PROVIDER=<provider>` in the shop's
  `.env.local.example` and uncomments that provider's credential lines, so you
  just copy the file to `.env.local` and fill in the values (a Strapi URL/token,
  a Prepr access token, or a Contentful Space ID + Delivery API token). See the
  generated `my-shop/cms/README.md` for backend setup, and switch providers
  later by changing `CMS_PROVIDER`.
- **`--cms=none`** scaffolds the shop flat at the root (no `frontend/` split, no
  `cms/` folder); the homepage falls back to its built-in static page and
  marketing slugs return 404.

## Payments

`--psp=<provider>` picks the payment service provider: `mollie`,
`multisafepay`, or `none` (default). Works on all three stacks — every
boilerplate ships both integrations and activates one from `PAYMENT_PROVIDER`.

The unchosen provider is fully removed: its npm package is dropped from
`package.json` and pruned from `package-lock.json`, its route handlers and
server wiring are deleted, and its credential keys are stripped from the env
example. The chosen one is pre-set as `PAYMENT_PROVIDER` (+ the public mirror) —
add the API keys and you're live. With `--psp=none` no PSP package is installed
at all and checkout goes straight from "place order" to the thank-you page.

## Spare parts

`--spare-parts=no` removes the `/machines` section — the contact-only browser
over the machines in the company's `MY_INSTALLATIONS` attribute — including its
pages, helpers, route/nav entry, config block and `*MACHINE*` env keys. Default
is `yes`.

Run `npx @propeller-commerce/create-propeller-shop --help` for the full flag
list, or omit flags to be prompted interactively.

## License

MIT
