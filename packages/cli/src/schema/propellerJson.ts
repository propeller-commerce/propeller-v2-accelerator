/**
 * propeller.json — the scaffolded shop's identity card.
 *
 * Lives at `frontend/propeller.json` in every scaffolded shop.
 * Owned by the shop. Edited rarely. Read by:
 *
 *   - The CLI's `propeller doctor` (verify pinned versions + config drift).
 *   - The CLI's future `propeller upgrade` (Phase B; reads template version
 *     and customisations.ejected to decide what to apply).
 *   - The shop's own runtime (`data/config.ts` reads shop.mode etc. at boot
 *     to populate the PropellerProvider).
 *
 * Schema versioning: this is v1. Breaking changes bump `$schema` and the
 * CLI handles migration. v0.1 ships v1 only.
 */

import { z } from 'zod';

export const ShopMode = z.enum(['b2b', 'b2c', 'hybrid']);
export const PortalMode = z.enum(['open', 'semi-closed', 'closed']);
export const CmsAdapter = z.enum(['strapi', 'cms', 'prepr', 'contentful']).nullable();
export const Stack = z.enum(['next', 'vue', 'nuxt']);
/** Payment service provider. `null` = no PSP (order → thank-you directly). */
export const PspProvider = z.enum(['mollie', 'multisafepay']).nullable();

export const PropellerJsonSchema = z.object({
  $schema: z.string().optional(),
  template: z.object({
    /** Template package name, e.g. "propeller-shop-template-next". */
    name: z.string(),
    /** Semver of the template at scaffold time. Used by `propeller upgrade`. */
    version: z.string(),
    stack: Stack,
  }),
  shop: z.object({
    /** Human-readable shop name, used in OG titles, package.json, README. */
    name: z.string(),
    mode: ShopMode,
    /** BCP-47 locale codes the shop supports. Must contain `defaultLocale`. */
    locales: z.array(z.string()).min(1),
    defaultLocale: z.string(),
    /** Display symbol shown to humans, e.g. '€'. */
    currency: z.string(),
    /** ISO 4217 code parsed by crawlers, e.g. 'EUR'. */
    currencyCode: z.string().length(3),
    portalMode: PortalMode,
    /** Public site origin (no trailing slash), used for SEO and canonical URLs. */
    siteUrl: z.string().url(),
  }),
  /**
   * Feature flags for whole route trees. `quotes: false` means the upgrade
   * tool skips diffs for `app/account/quotes/*` and the build can tree-shake.
   * For mode=b2c, B2B-only flags are false; mode=hybrid leaves them true and
   * gates at runtime via userMode.
   */
  features: z.object({
    quotes: z.boolean(),
    authorization: z.boolean(),
    favorites: z.boolean(),
    clusters: z.boolean(),
    search: z.boolean(),
    contacts: z.boolean(),
    /**
     * Spare-parts machines (`/machines`). False means the scaffold deleted the
     * machine pages/helpers and their nav entry. Defaulted so shops scaffolded
     * before this flag existed still validate.
     */
    spareParts: z.boolean().default(true),
    /**
     * OCI + cXML PunchOut. False (the default) means the scaffold deleted the
     * /api/punchout/* routes, the server glue and the cart transfer button, and
     * dropped the punchout package. Defaulted so shops scaffolded before this
     * flag existed still validate.
     */
    punchout: z.boolean().default(false),
    /**
     * The /tracker behaviour dashboard. False (the default) leaves it dormant:
     * the code ships either way, but with no TRACKING_DB_* configured the shop
     * collects nothing and the dashboard says so. Next-only. Defaulted so shops
     * scaffolded before this flag existed still validate.
     */
    tracking: z.boolean().default(false),
  }),
  cms: z.object({
    adapter: CmsAdapter,
    /** Typically "${CMS_URL}" — resolved by the runtime, not the CLI. */
    endpoint: z.string(),
    preview: z.boolean(),
  }),
  /**
   * Which PSP the shop was scaffolded with. `null` means no PSP package is
   * installed and the PSP route handlers were removed — checkout places the
   * order and goes straight to the thank-you page. Defaulted for the same
   * back-compat reason as `features.spareParts`.
   */
  payments: z
    .object({
      provider: PspProvider,
    })
    .default({ provider: null }),
  customisations: z.object({
    /**
     * Paths (relative to `frontend/`) marked as customised.
     * `propeller upgrade` skips files in this list. v0.1 reserves the field
     * but doesn't actively read it yet — Phase B does.
     */
    ejected: z.array(z.string()).default([]),
  }),
});

export type PropellerJson = z.infer<typeof PropellerJsonSchema>;
export type ShopMode = z.infer<typeof ShopMode>;
export type PortalMode = z.infer<typeof PortalMode>;
export type CmsAdapter = z.infer<typeof CmsAdapter>;
export type Stack = z.infer<typeof Stack>;
export type PspProvider = z.infer<typeof PspProvider>;

/**
 * Sensible defaults that turn a `ShopConfig` (from CLI prompts) into a
 * complete `PropellerJson`. The CLI fills in `template.version` from the
 * CLI's own package.json at scaffold time.
 */
export function buildPropellerJson(input: {
  templateName: string;
  templateVersion: string;
  stack: Stack;
  shopName: string;
  mode: ShopMode;
  locales: string[];
  defaultLocale: string;
  currency: string;
  currencyCode: string;
  portalMode: PortalMode;
  siteUrl: string;
  cmsAdapter: CmsAdapter;
  psp: PspProvider;
  spareParts: boolean;
  punchout: boolean;
  tracking: boolean;
}): PropellerJson {
  const isB2C = input.mode === 'b2c';
  return {
    $schema: 'https://propeller.dev/schemas/shop.v1.json',
    template: {
      name: input.templateName,
      version: input.templateVersion,
      stack: input.stack,
    },
    shop: {
      name: input.shopName,
      mode: input.mode,
      locales: input.locales,
      defaultLocale: input.defaultLocale,
      currency: input.currency,
      currencyCode: input.currencyCode,
      portalMode: input.portalMode,
      siteUrl: input.siteUrl,
    },
    features: {
      quotes: !isB2C,
      authorization: !isB2C,
      favorites: true,
      clusters: true,
      search: true,
      contacts: !isB2C,
      spareParts: input.spareParts,
      punchout: input.punchout,
      tracking: input.tracking,
    },
    cms: {
      adapter: input.cmsAdapter,
      endpoint: '${CMS_URL}',
      preview: true,
    },
    payments: {
      provider: input.psp,
    },
    customisations: {
      ejected: [],
    },
  };
}
