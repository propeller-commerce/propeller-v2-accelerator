/**
 * Mollie wiring — DISABLED (this shop was scaffolded with `--psp=none`).
 *
 * Unlike Next and Nuxt, the Vue boilerplate registers its PSP HTTP routes
 * INLINE in `server.js`, which imports this module at boot. Deleting the file
 * would crash the server, and cutting the route blocks out of a 900-line
 * `server.js` would need a patch that breaks on every unrelated edit to it. So
 * the module stays and reports "not configured" instead: `/api/mollie/*` answers
 * 503, and the `@propeller-commerce/propeller-v2-mollie` package is not
 * installed (see overlay-psp-none/package.patch.json).
 *
 * `isOnAccountMethod` is provider-agnostic — `server.js` uses it as a
 * defense-in-depth guard — so it keeps its real implementation.
 *
 * To add Mollie later: `npm i @propeller-commerce/propeller-v2-mollie`, restore
 * this file from the boilerplate (propeller-v2-vue-boilerplate,
 * `frontend/src/server/mollie.js`), and set PAYMENT_PROVIDER=mollie.
 */

/** No PSP in this shop — the checkout places the order straight to NEW. */
export function isMollieEnabled() {
  return false
}

/** Kept for signature parity with the boilerplate module. */
export function mollieWebhookUrl() {
  return ''
}

/**
 * Whether a payment-method code settles "on account" (no PSP). Server-side
 * mirror of `src/lib/payments.ts` (which is client-only). Reads
 * `ON_ACCOUNT_PAYMENTS`; defaults to `REKENING,ON_ACCOUNT`.
 */
export function isOnAccountMethod(method) {
  if (!method) return false
  const raw = process.env.ON_ACCOUNT_PAYMENTS || ''
  const list = raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
  const codes = list.length > 0 ? list : ['REKENING', 'ON_ACCOUNT']
  return codes.includes(method.trim().toUpperCase())
}

/** Never reached: every route guards with `isMollieEnabled()` first. */
export function getMollieProvider() {
  throw new Error(
    'Mollie is not installed in this shop (scaffolded with --psp=none).'
  )
}
