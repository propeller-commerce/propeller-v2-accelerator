/**
 * MultiSafepay wiring — DISABLED (this shop was scaffolded with `--psp=mollie`).
 *
 * The Vue boilerplate registers its PSP HTTP routes INLINE in `server.js`, which
 * imports this module at boot — so the file stays and reports "not configured"
 * (`/api/msp/*` answers 503) while the `@propeller-commerce/propeller-v2-msp`
 * package is not installed. Mollie is the active provider; see
 * `src/server/mollie.js`.
 *
 * To switch to MultiSafepay later: `npm i @propeller-commerce/propeller-v2-msp`,
 * restore this file from the boilerplate (propeller-v2-vue-boilerplate,
 * `frontend/src/server/msp.js`), and set PAYMENT_PROVIDER=multisafepay.
 */

/** MultiSafepay isn't installed in this shop — Mollie is the active PSP. */
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
    'MultiSafepay is not installed in this shop (scaffolded with --psp=mollie).'
  )
}
