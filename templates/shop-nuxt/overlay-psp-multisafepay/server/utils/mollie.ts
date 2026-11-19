/**
 * Mollie wiring — REMOVED (this shop was scaffolded with `--psp=multisafepay`).
 *
 * The `/api/mollie/*` routes and the `@propeller-commerce/propeller-v2-mollie`
 * package are gone. This file stays for one helper: `isOnAccountMethod` is
 * provider-agnostic but lives in the boilerplate's Mollie module, and the
 * MultiSafepay payment flow imports it from here (`server/utils/paymentAccess.ts`,
 * or `server/api/msp/create-payment.post.ts` in older boilerplates).
 *
 * To switch to Mollie later: `npm i @propeller-commerce/propeller-v2-mollie`,
 * restore this file and `server/api/mollie/` from the boilerplate
 * (propeller-v2-nuxt-boilerplate), and set PAYMENT_PROVIDER=mollie.
 *
 * Server-only, like everything under `server/`.
 */

import type { H3Event } from 'h3';
import { useRuntimeConfig } from 'nitropack/runtime';

/**
 * Whether a payment-method code settles "on account" (no PSP). Server-side
 * mirror of `app/utils/payments.ts` (which is client-side). Reads
 * `ON_ACCOUNT_PAYMENTS` (the server-only runtimeConfig key); defaults to
 * `REKENING,ON_ACCOUNT`. Used as a defense-in-depth guard in the create-payment
 * route.
 */
export function isOnAccountMethod(event: H3Event, method: string | undefined | null): boolean {
  if (!method) return false;
  const config = useRuntimeConfig(event);
  const raw = config.onAccountPayments || '';
  const list = raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const codes = list.length > 0 ? list : ['REKENING', 'ON_ACCOUNT'];
  return codes.includes(method.trim().toUpperCase());
}
