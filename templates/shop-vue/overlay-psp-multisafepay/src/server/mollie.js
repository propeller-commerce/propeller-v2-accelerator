/**
 * Mollie wiring — DISABLED (this shop was scaffolded with `--psp=multisafepay`).
 *
 * The Vue boilerplate registers its PSP HTTP routes INLINE in `server.js`, which
 * imports this module at boot — so the file stays and reports "not configured"
 * (`/api/mollie/*` answers 503) while the
 * `@propeller-commerce/propeller-v2-mollie` package is not installed.
 * MultiSafepay is the active provider; see `src/server/msp.js`.
 *
 * `isOnAccountMethod` is provider-agnostic and lives here in the boilerplate —
 * `server.js` uses it to guard BOTH providers' create-payment routes, including
 * MultiSafepay's — so it keeps its real implementation.
 *
 * To switch to Mollie later: `npm i @propeller-commerce/propeller-v2-mollie`,
 * restore this file from the boilerplate (propeller-v2-vue-boilerplate,
 * `frontend/src/server/mollie.js`), and set PAYMENT_PROVIDER=mollie.
 */

/** Mollie isn't installed in this shop — MultiSafepay is the active PSP. */
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
 * `ON_ACCOUNT_PAYMENTS`; defaults to `REKENING,ON_ACCOUNT`. Used as a
 * defense-in-depth guard in both create-payment routes.
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
    'Mollie is not installed in this shop (scaffolded with --psp=multisafepay).'
  )
}
