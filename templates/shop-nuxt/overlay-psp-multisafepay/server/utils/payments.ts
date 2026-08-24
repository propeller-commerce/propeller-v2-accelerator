/**
 * Provider-agnostic payment helpers for the server side.
 *
 * In the boilerplate this lives in `server/utils/mollie.ts` alongside the Mollie
 * wiring, and BOTH create-payment routes import it. This shop was scaffolded
 * with `--psp=multisafepay`, so the Mollie module (and its npm package) is gone
 * — the helper moves here, and the MultiSafepay route's import is repointed at
 * this file.
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
