/**
 * Handlebars substitution over template files.
 *
 * Files ending in `.template.<ext>` get run through Handlebars and the
 * `.template` suffix is stripped on write. All other files are copied
 * verbatim — this keeps Handlebars off code that doesn't need it and
 * avoids `{{ }}` collisions with JSX or Vue mustache syntax.
 *
 * Variables exposed to templates — keep this list in sync with the
 * `SubstitutionContext` interface below. Categories:
 *
 *   Identity
 *     shopName, shopDescription, siteUrl, siteHostname, apiHostname
 *
 *   Stack & mode
 *     stack, shopMode, isB2B, isB2C, isHybrid
 *
 *   Locale & currency
 *     defaultLocale, defaultLocaleLower, defaultLanguage (2-char form,
 *     uppercase — e.g. 'NL' from 'nl_NL'; what Propeller's GraphQL API
 *     expects for the `language:` argument), locales (array), localesArray,
 *     localesJsonArray, currency, currencyCode
 *
 *   Portal & integration
 *     portalMode, portalModeConstant, channelId, anonymousId, taxZone
 *
 *   CMS
 *     cmsAdapter            'strapi' | 'prepr' | 'cms' | null (truthy boolean via #if)
 *     cmsAdapterTsValue     "'strapi'" / "'prepr'" / "'cms'" / 'null' — TS literal
 *     cmsAdapterJsonValue   '"strapi"' / '"prepr"' / '"cms"' / 'null' — JSON literal
 *     cmsAdapterPackage     full npm package name or ''
 *     cmsAdapterDisplay     human-readable, e.g. 'Strapi' / 'none'
 *
 *   Mode-derived UI defaults
 *     showUserType          "'Contact'" | "'Customer'" | 'null'
 *
 *   Feature flags (mode-derived defaults)
 *     featureQuotes, featureAuthorization, featureContacts (booleans)
 *
 *   Versioning
 *     templateVersion
 */

import Handlebars from 'handlebars';
import type { ShopConfig } from '../prompts';

export interface SubstitutionContext {
  // Identity
  shopName: string;
  shopDescription: string;
  siteUrl: string;
  siteHostname: string;
  apiHostname: string;

  // Stack & mode
  stack: string;
  shopMode: string;
  isB2B: boolean;
  isB2C: boolean;
  isHybrid: boolean;

  // Locale & currency
  defaultLocale: string;
  defaultLocaleLower: string;
  /**
   * 2-char uppercase language code derived from `defaultLocale` — e.g.
   * 'NL' from 'nl_NL'. Propeller's GraphQL API rejects anything other
   * than a 2-char code on the `language:` argument ("Language has to be
   * valid language code with 2 characters"), so templates must use this
   * for any backend-bound default rather than `defaultLocale` itself.
   */
  defaultLanguage: string;
  locales: string[];
  localesArray: string;
  localesJsonArray: string;
  /** Locales minus the default, as a JSON array string. Drives URL-prefix
   *  rewrite tables (e.g. proxy.ts) where the default locale gets no prefix. */
  nonDefaultLocalesJsonArray: string;
  currency: string;
  currencyCode: string;

  // Portal & integration
  portalMode: string;
  portalModeConstant: string;
  channelId: number;
  anonymousId: number;
  taxZone: string;

  // CMS
  cmsAdapter: string | null;
  cmsAdapterTsValue: string;
  cmsAdapterJsonValue: string;
  cmsAdapterPackage: string;
  cmsAdapterDisplay: string;

  // Mode-derived UI defaults
  showUserType: string;

  // Feature flags
  featureQuotes: boolean;
  featureAuthorization: boolean;
  featureContacts: boolean;

  // Versioning
  templateVersion: string;
}

export function buildContext(
  config: ShopConfig,
  templateVersion: string
): SubstitutionContext {
  const siteUrlObj = (() => {
    try {
      return new URL(config.siteUrl);
    } catch {
      return null;
    }
  })();

  const siteHostname = siteUrlObj?.hostname ?? '';
  // Heuristic: `api.<root-of-site-domain>` for image patterns. Shop owners
  // can edit `next.config.ts` after scaffolding if their backend lives
  // elsewhere.
  const apiHostname = siteHostname.split('.').slice(-2).join('.') || 'example.com';

  return {
    // Identity
    shopName: config.name,
    shopDescription: `${config.name} — powered by Propeller Commerce`,
    siteUrl: config.siteUrl,
    siteHostname,
    apiHostname,

    // Stack & mode
    stack: config.stack,
    shopMode: config.mode,
    isB2B: config.mode === 'b2b',
    isB2C: config.mode === 'b2c',
    isHybrid: config.mode === 'hybrid',

    // Locale & currency
    defaultLocale: config.defaultLocale,
    defaultLocaleLower: config.defaultLocale.toLowerCase(),
    defaultLanguage: config.defaultLocale.split(/[_-]/)[0].toUpperCase(),
    locales: config.locales,
    localesArray: JSON.stringify(config.locales),
    localesJsonArray: JSON.stringify(config.locales),
    nonDefaultLocalesJsonArray: JSON.stringify(
      config.locales.filter((l) => l.toLowerCase() !== config.defaultLocale.toLowerCase())
    ),
    currency: config.currency,
    currencyCode: config.currencyCode,

    // Portal & integration
    portalMode: config.portalMode,
    portalModeConstant: portalModeConstantFor(config.portalMode),
    channelId: 621,
    anonymousId: 71,
    taxZone: 'NL',

    // CMS
    cmsAdapter: config.cmsAdapter,
    cmsAdapterTsValue: cmsAdapterTsValueFor(config.cmsAdapter),
    cmsAdapterJsonValue: cmsAdapterJsonValueFor(config.cmsAdapter),
    cmsAdapterPackage: cmsAdapterPackageFor(config.cmsAdapter),
    cmsAdapterDisplay: config.cmsAdapter ?? 'none',

    // Mode-derived UI defaults
    showUserType: showUserTypeFor(config.mode),

    // Feature flags — defaults track shopMode; ejectable later.
    featureQuotes: config.mode !== 'b2c',
    featureAuthorization: config.mode !== 'b2c',
    featureContacts: config.mode !== 'b2c',

    // Versioning
    templateVersion,
  };
}

function showUserTypeFor(mode: ShopConfig['mode']): string {
  switch (mode) {
    case 'b2b': return "'Contact'";
    case 'b2c': return "'Customer'";
    case 'hybrid': return 'null';
  }
}

function portalModeConstantFor(mode: ShopConfig['portalMode']): string {
  switch (mode) {
    case 'open': return 'OPEN';
    case 'semi-closed': return 'SEMI_CLOSED';
    case 'closed': return 'CLOSED';
  }
}

function cmsAdapterTsValueFor(adapter: ShopConfig['cmsAdapter']): string {
  return adapter === null ? 'null' : `'${adapter}'`;
}

function cmsAdapterJsonValueFor(adapter: ShopConfig['cmsAdapter']): string {
  return adapter === null ? 'null' : JSON.stringify(adapter);
}

function cmsAdapterPackageFor(adapter: ShopConfig['cmsAdapter']): string {
  if (adapter === null) return '';
  switch (adapter) {
    case 'strapi':
      return 'propeller-v2-cms-adapter-strapi';
    case 'prepr':
      return 'propeller-v2-cms-adapter-prepr';
    case 'cms':
      return 'propeller-v2-cms-adapter-cms';
    // Contentful ships in the Next boilerplate's lib/cms — there is no separate
    // adapter package to pin, so there is nothing to install.
    case 'contentful':
      return '';
  }
}

/** Substitute Handlebars variables in `source`. Errors include the variable name. */
export function renderTemplate(
  source: string,
  context: SubstitutionContext
): string {
  const template = Handlebars.compile(source, {
    strict: true, // missing variable → throw with name
    noEscape: true, // template output is code; do not HTML-escape
  });
  return template(context);
}

/**
 * Decide the destination filename for a copied template file.
 * Strips `.template` from `foo.template.ts` → `foo.ts`.
 */
export function stripTemplateSuffix(filename: string): string {
  return filename.replace(/\.template(?=\.[^.]+$)/, '');
}

/** Heuristic: does this filename need Handlebars substitution? */
export function isTemplateFile(filename: string): boolean {
  return /\.template\.[^.]+$/.test(filename);
}
