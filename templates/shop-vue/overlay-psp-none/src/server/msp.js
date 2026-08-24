/**
 * MultiSafepay wiring — DISABLED (this shop was scaffolded with `--psp=none`).
 *
 * Same reasoning as the sibling `mollie.js` stub: `server.js` imports this at
 * boot to register `/api/msp/*`, so the module stays and reports "not
 * configured" (the routes answer 503) while the
 * `@propeller-commerce/propeller-v2-msp` package is not installed.
 *
 * To add MultiSafepay later: `npm i @propeller-commerce/propeller-v2-msp`,
 * restore this file from the boilerplate (propeller-v2-vue-boilerplate,
 * `frontend/src/server/msp.js`), and set PAYMENT_PROVIDER=multisafepay.
 */

/** No PSP in this shop — the checkout places the order straight to NEW. */
export function isMspEnabled() {
  return false
}

/** Kept for signature parity with the boilerplate module. */
export function mspWebhookUrl() {
  return ''
}

/** Never reached: every route guards with `isMspEnabled()` first. */
export function getMspProvider() {
  throw new Error(
    'MultiSafepay is not installed in this shop (scaffolded with --psp=none).'
  )
}
