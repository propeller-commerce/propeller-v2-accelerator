/**
 * PunchOut — REMOVED (this shop was scaffolded with `--punchout=no`).
 *
 * The `/api/punchout/*` routes and the `@propeller-commerce/propeller-v2-punchout`
 * package are gone, but `server.js` still consults this module in two places:
 * the GraphQL proxy (a magic-token login settles a pending punchout session)
 * and logout (which clears the punchout cookies). With PunchOut off both are
 * inert — nothing ever sets a punchout session, so there is nothing to promote.
 *
 * To add PunchOut later: `npm i @propeller-commerce/propeller-v2-punchout`,
 * restore this file and the `/api/punchout/*` block of `server.js` from the
 * boilerplate (propeller-v2-vue-boilerplate, `frontend/`), and follow the
 * package README.
 */

export const PUNCHOUT_COOKIE = 'punchout'
export const PUNCHOUT_FLAG_COOKIE = 'punchout_active'
export const PUNCHOUT_PENDING_COOKIE = 'punchout_pending'
export const PUNCHOUT_MAX_AGE = 60 * 60

/** PunchOut is not part of this shop. */
export function isPunchoutEnabled() {
  return false
}

/** Never reached: the proxy checks `isPunchoutEnabled()` first. */
export function punchoutAfterLogin() {
  return null
}

/** Never reached, as above. */
export function signPunchoutSession() {
  return ''
}
