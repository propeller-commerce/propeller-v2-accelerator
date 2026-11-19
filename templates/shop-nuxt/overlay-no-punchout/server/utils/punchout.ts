/**
 * PunchOut — REMOVED (this shop was scaffolded with `--punchout=no`).
 *
 * The `/api/punchout/*` routes and the `@propeller-commerce/propeller-v2-punchout`
 * package are gone, but the auth session routes and the GraphQL proxy still
 * call into this module: a login or logout ends any punchout session, and a
 * magic-token login settles a pending one. With PunchOut off nothing ever
 * starts a session, so all three are no-ops.
 *
 * To add PunchOut later: `npm i @propeller-commerce/propeller-v2-punchout`,
 * restore this file and `server/api/punchout/` from the boilerplate
 * (propeller-v2-nuxt-boilerplate), and follow the package README.
 */

import type { H3Event } from 'h3';

/** No punchout session to clear. */
export function clearPunchout(_event: H3Event, _options: { pending?: boolean } = {}): void {}

/** No punchout session to settle. */
export function settlePunchoutLogin(_event: H3Event, _token: string, _accessToken: string | null): void {}

/** There is never an active punchout session. */
export function activePunchout(_event: H3Event, _accessToken?: string): null {
  return null;
}
