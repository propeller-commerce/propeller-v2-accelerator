/**
 * Interactive prompt flow for `create-propeller-shop`.
 *
 * Any value not provided as a CLI flag is asked here. Returns a fully
 * resolved `ShopConfig` ready for scaffolding. Validation lives in the
 * Zod schema; this module only collects input.
 */

import { input, select, confirm } from '@inquirer/prompts';
import type {
  ShopMode,
  PortalMode,
  CmsAdapter,
  PspProvider,
  Stack,
} from '../schema/propellerJson';

export interface PromptDefaults {
  name?: string;
  stack?: Stack;
  mode?: ShopMode;
  cms?: CmsAdapter | 'none';
  psp?: PspProvider | 'none';
  spareParts?: boolean;
  punchout?: boolean;
  tracking?: boolean;
  locales?: string[];
  defaultLocale?: string;
  currency?: string;
  currencyCode?: string;
  portalMode?: PortalMode;
  siteUrl?: string;
  skipInstall?: boolean;
  /**
   * When true, missing values are filled from built-in defaults instead of
   * prompting. The shop name is still required (no sensible default).
   */
  yes?: boolean;
}

export interface ShopConfig {
  name: string;
  stack: Stack;
  mode: ShopMode;
  cmsAdapter: CmsAdapter; // null when --cms=none
  psp: PspProvider; // null when --psp=none
  spareParts: boolean; // false when --spare-parts=no
  punchout: boolean; // false when --punchout=no (the default)
  tracking: boolean; // false when --tracking=no (the default); Next only
  locales: string[];
  defaultLocale: string;
  currency: string;
  currencyCode: string;
  portalMode: PortalMode;
  siteUrl: string;
  skipInstall: boolean;
}

const KEBAB = /^[a-z][a-z0-9-]*$/;

function defaultPortalForMode(mode: ShopMode): PortalMode {
  return mode === 'b2b' ? 'semi-closed' : 'open';
}

/** Prompt for everything not already provided, with sensible defaults. */
export async function collectShopConfig(defaults: PromptDefaults): Promise<ShopConfig> {
  const yes = defaults.yes === true;

  // Name has no sensible default — required either as flag or via prompt.
  const name =
    defaults.name ??
    (await input({
      message: 'Shop name (kebab-case, used as folder + package name):',
      validate: (v) => (KEBAB.test(v) ? true : 'Use lowercase letters, digits, and hyphens; start with a letter.'),
    }));

  const stack: Stack =
    defaults.stack ??
    (yes
      ? 'next'
      : await select({
          message: 'Frontend stack?',
          choices: [
            { name: 'Next.js 16 (React)', value: 'next' as const },
            { name: 'Vue 3 + Vite SSR', value: 'vue' as const },
            { name: 'Nuxt 3 (Vue SSR)', value: 'nuxt' as const },
          ],
        }));

  const mode: ShopMode =
    defaults.mode ??
    (yes
      ? 'hybrid'
      : await select({
          message: 'Shop mode?',
          choices: [
            { name: 'Hybrid (both Contact and Customer users)', value: 'hybrid' as const },
            { name: 'B2B only (Contacts; semi-closed by default)', value: 'b2b' as const },
            { name: 'B2C only (Customers; open by default)', value: 'b2c' as const },
          ],
        }));

  // CMS is a Next-only capability today: only the Next boilerplate ships a
  // `lib/cms` provider engine (Strapi / Prepr / Contentful, selected at runtime
  // by the CMS_PROVIDER env var). The Vue and Nuxt boilerplates have no CMS subsystem,
  // so a CMS choice there could not be honoured — force `none` and tell the
  // user, rather than silently scaffold a shop whose CMS selection does nothing.
  let cmsChoice: CmsAdapter | 'none';
  if (stack === 'next') {
    cmsChoice =
      defaults.cms ??
      (yes
        ? 'none'
        : await select<CmsAdapter | 'none'>({
            message: 'CMS adapter?',
            choices: [
              { name: 'Strapi (open-source headless CMS)', value: 'strapi' },
              { name: 'Prepr (headless GraphQL CMS)', value: 'prepr' },
              { name: 'Contentful (hosted headless CMS)', value: 'contentful' },
              { name: 'Generic Propeller CMS', value: 'cms' },
              { name: 'None — homepage falls back to static, marketing slugs return 404', value: 'none' },
            ],
          }));
  } else {
    if (defaults.cms && defaults.cms !== 'none') {
      // eslint-disable-next-line no-console
      console.warn(
        `Note: --cms=${defaults.cms} is ignored for the ${stack} stack — only the ` +
          `Next boilerplate ships a CMS engine. Scaffolding with no CMS.`
      );
    }
    cmsChoice = 'none';
  }
  const cmsAdapter: CmsAdapter = cmsChoice === 'none' ? null : cmsChoice;

  // Payment service provider. Unlike the CMS this is stack-agnostic — all three
  // boilerplates ship both PSP integrations behind the same env switch. Picking
  // one drops the other's package + route handlers; `none` drops both, and
  // checkout goes straight from "place order" to the thank-you page.
  const pspChoice: PspProvider | 'none' =
    defaults.psp ??
    (yes
      ? 'none'
      : await select<PspProvider | 'none'>({
          message: 'Payment service provider?',
          choices: [
            { name: 'None — order is placed directly, no hosted payment page', value: 'none' },
            { name: 'Mollie', value: 'mollie' },
            { name: 'MultiSafepay', value: 'multisafepay' },
          ],
        }));
  const psp: PspProvider = pspChoice === 'none' ? null : pspChoice;

  // Spare-parts machines (`/machines`): a contact-only browser over the machines
  // in the company's MY_INSTALLATIONS attribute. Most shops don't sell spare
  // parts, so it's opt-out — saying no deletes the pages, helpers and nav entry.
  const spareParts =
    defaults.spareParts ??
    (yes
      ? true
      : await confirm({
          message: 'Include the spare-parts machines section (/machines)?',
          default: true,
        }));

  // OCI + cXML PunchOut: a B2B e-procurement handshake (SAP / Ariba / Coupa
  // "punch out" to the shop, then transfer the cart back as a requisition).
  // Only e-procurement catalogues need it, so it's opt-IN — the default deletes
  // the /api/punchout/* routes, the server glue and the cart transfer button,
  // and drops the punchout package.
  const punchout =
    defaults.punchout ??
    (yes
      ? false
      : await confirm({
          message: 'Include OCI + cXML PunchOut (B2B e-procurement)?',
          default: false,
        }));

  // Behaviour tracking: the /tracker dashboard, which needs a MySQL database
  // the shop owner provides. Opt-IN and Next-only — the Vue and Nuxt
  // boilerplates ship no /tracker, and most shops never want one.
  //
  // Answering yes does NOT provision anything: the scaffold runs on a laptop
  // that has no route to the shop's database. It enables the feature flag and
  // tells the user to run `npm run tracking:init` against their own server.
  const tracking =
    stack === 'next'
      ? defaults.tracking ??
        (yes
          ? false
          : await confirm({
              message: 'Set up the behaviour-tracking dashboard (/tracker)? Needs a MySQL database.',
              default: false,
            }))
      : false;

  if (stack !== 'next' && defaults.tracking) {
    // eslint-disable-next-line no-console
    console.warn(
      `Note: --tracking is ignored for the ${stack} stack — only the Next ` +
        `boilerplate ships the /tracker dashboard.`
    );
  }

  const localesStr =
    defaults.locales?.join(',') ??
    (yes
      ? 'en'
      : await input({
          message: 'Locales (comma-separated BCP-47 codes):',
          default: 'en',
          validate: (v) => (v.split(',').every((s) => s.trim().length > 0) ? true : 'At least one locale required.'),
        }));
  const locales = localesStr.split(',').map((s) => s.trim()).filter(Boolean);

  const defaultLocale =
    defaults.defaultLocale ??
    (yes
      ? locales[0]
      : await select({
          message: 'Default locale?',
          choices: locales.map((l) => ({ name: l, value: l })),
        }));

  const currencyCode =
    defaults.currencyCode ??
    (yes
      ? 'EUR'
      : await input({
          message: 'Currency code (ISO 4217)?',
          default: 'EUR',
          validate: (v) => (/^[A-Z]{3}$/.test(v) ? true : 'Three uppercase letters, e.g. EUR.'),
        }));

  // Sensible default symbol for common codes; user can edit later.
  const currency = defaults.currency ?? defaultCurrencySymbol(currencyCode);

  const portalMode: PortalMode =
    defaults.portalMode ??
    (yes
      ? defaultPortalForMode(mode)
      : await select({
          message: 'Portal access mode?',
          choices: [
            { name: 'open (anonymous users see catalog + prices)', value: 'open' as const },
            { name: 'semi-closed (catalog visible, prices hidden until login)', value: 'semi-closed' as const },
            { name: 'closed (login required for anything)', value: 'closed' as const },
          ],
          default: defaultPortalForMode(mode),
        }));

  const siteUrl =
    defaults.siteUrl ??
    (yes
      ? `https://${name}.example.com`
      : await input({
          message: 'Site URL (no trailing slash):',
          default: `https://${name}.example.com`,
          validate: (v) => {
            try {
              // eslint-disable-next-line no-new
              new URL(v);
              return v.endsWith('/') ? 'Remove trailing slash.' : true;
            } catch {
              return 'Must be a valid URL.';
            }
          },
        }));

  const skipInstall =
    defaults.skipInstall ??
    (yes
      ? false
      : !(await confirm({
          message: 'Run `npm install` now?',
          default: true,
        })));

  return {
    name,
    stack,
    mode,
    cmsAdapter,
    psp,
    spareParts,
    punchout,
    tracking,
    locales,
    defaultLocale,
    currency,
    currencyCode,
    portalMode,
    siteUrl,
    skipInstall,
  };
}

function defaultCurrencySymbol(code: string): string {
  switch (code) {
    case 'EUR': return '€';
    case 'USD': return '$';
    case 'GBP': return '£';
    case 'CHF': return 'CHF';
    case 'SEK': case 'NOK': case 'DKK': return 'kr';
    case 'PLN': return 'zł';
    default: return code;
  }
}
