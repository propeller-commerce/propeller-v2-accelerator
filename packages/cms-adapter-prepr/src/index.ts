/**
 * Prepr GraphQL CmsProvider.
 *
 * Maps Prepr's GraphQL responses to the framework-agnostic, full-fidelity
 * `CmsProvider` contract in propeller-v2-core-ui — the same contract the
 * in-production Next boilerplate implements. Ported from
 * `propeller-next/lib/cms/providers/prepr.ts`, with config moved from env vars
 * to an options-based factory (`createPreprAdapter({ token, fetchImpl })`) to
 * match the accelerator's adapter convention.
 *
 * Usage:
 *
 *   import { createPreprAdapter } from 'propeller-v2-cms-adapter-prepr';
 *   const cms = createPreprAdapter({ token: process.env.PREPR_ACCESS_TOKEN! });
 *
 * Then pass `cms` into PropellerProvider's CMS seam and call it from
 * server-side data fetchers only.
 *
 * Notably this adapter introspects the Prepr environment's schema at runtime
 * and builds its GraphQL queries dynamically, so it adapts to "rich" (full
 * Propeller content models) vs "demo/simple" Prepr environments without code
 * changes. Schema introspection is cached per adapter instance.
 */

import type {
  CmsProvider,
  CmsPageOptions,
  CmsArticle,
  CmsAuthor,
  CmsCategoryBanner,
  CmsFaq,
  CmsFeature,
  CmsFooterColumn,
  CmsGlobal,
  CmsImage,
  CmsNavLink,
  CmsPostCards,
  CmsProductCards,
  CmsRichPage,
  CmsSeo,
  CmsStatic,
  CmsTypedBlock,
  CmsValuePropItem,
} from '@propeller-commerce/propeller-v2-core-ui';

export interface PreprAdapterOptions {
  /** Prepr GraphQL access token (the token segment of the GraphQL URL). */
  token: string;
  /** Override the GraphQL endpoint base (defaults to https://graphql.prepr.io). */
  endpointBase?: string;
  /** Customise the fetch implementation (test stub, server-only Next, etc.). */
  fetchImpl?: typeof fetch;
}

// ── Normalizers ──

function normalizeImage(raw: any): CmsImage | null {
  if (!raw) return null;
  return {
    url: raw.url || '',
    alternativeText: raw.alt || null,
    width: raw.width || 0,
    height: raw.height || 0,
  };
}

function normalizeSeo(raw: any): CmsSeo | null {
  if (!raw) return null;
  return {
    metaTitle: raw.meta_title || '',
    metaDescription: raw.meta_description || '',
    shareImage: normalizeImage(raw.meta_image),
  };
}

function normalizeNavLink(raw: any): CmsNavLink {
  return {
    label: raw.label || '',
    url: raw.url || '',
    highlight: raw.highlight ?? false,
  };
}

function normalizeFooterColumn(raw: any): CmsFooterColumn {
  return {
    title: raw.title || '',
    links: (raw.links || []).map(normalizeNavLink),
  };
}

function normalizeValuePropItem(raw: any): CmsValuePropItem {
  return {
    icon: raw.icon || '',
    title: raw.title || '',
    text: raw.text || '',
  };
}

const TYPENAME_MAP: Record<string, string> = {
  Hero: 'hero-banner',
  Feature: 'feature',
  Cards: 'cards',
  CTA: 'call-to-action',
  Contact: 'contact-form',
  FAQ: 'faq',
  Static: 'static',
};

function normalizeButton(raw: any): { text: string; url: string; type: string } | null {
  if (!raw) return null;
  const url = raw.use_external_link ? raw.external_url || '' : raw.link?._slug || '';
  return { text: raw.text || '', url, type: raw.button_type || 'primary' };
}

/**
 * Per-call feature-index counter for alternating left/right layout when the
 * CMS doesn't specify a position. Passed through the normalize chain rather
 * than held in module scope so concurrent requests don't interleave.
 */
interface NormalizeCtx {
  featureIndex: number;
}

function normalizeBlock(raw: any, ctx: NormalizeCtx): CmsTypedBlock | null {
  const typename = raw.__typename;
  if (!TYPENAME_MAP[typename]) return null;

  switch (typename) {
    case 'Hero': {
      const buttons = (raw.buttons || []).map(normalizeButton).filter(Boolean);
      const primary = buttons[0];
      const secondary = buttons[1];
      return {
        _type: 'hero-banner',
        title: raw.heading || '',
        subtitle: raw.sub_heading || null,
        image: normalizeImage(raw.image || raw.asset),
        ctaText: primary?.text || null,
        ctaUrl: primary?.url || null,
        secondaryCtaText: secondary?.text || null,
        secondaryCtaUrl: secondary?.url || null,
      };
    }
    case 'Feature': {
      const btn = normalizeButton(raw.button);
      const position =
        raw.image_position === 'Right'
          ? 'right'
          : raw.image_position === 'Left'
            ? 'left'
            : ctx.featureIndex % 2 === 0
              ? 'left'
              : 'right';
      ctx.featureIndex++;
      return {
        _type: 'feature',
        title: raw.heading || '',
        description: raw.sub_heading || null,
        image: normalizeImage(raw.image),
        imagePosition: position,
        buttonText: btn?.text || null,
        buttonUrl: btn?.url || null,
      } as CmsFeature;
    }
    case 'Cards': {
      // Support both schemas: cards[] (propeller env) or products[] (demo env)
      const cards = raw.cards || [];
      const products = raw.products || [];
      const firstCardType = cards[0]?.__typename;
      const title = raw.heading || raw.title || '';
      const subtitle = raw.sub_heading || null;

      // Products from _json (demo env) — contains Propeller product IDs
      if (products.length > 0 && products[0]?._json) {
        return {
          _type: 'product-cards',
          title,
          subtitle,
          products: products.map((p: any) => ({
            productId: p._json?.productId ? parseInt(String(p._json.productId), 10) : null,
            slug: '',
            name: '',
            image: null,
            price: p._json?.price ?? null,
            priceSuffix: null,
          })),
          buttonText: null,
          buttonUrl: null,
        } as CmsProductCards;
      }

      // Product cards from propeller env (rich Product type with fields)
      if (firstCardType === 'Product') {
        const btn = normalizeButton(raw.button);
        return {
          _type: 'product-cards',
          title,
          subtitle,
          products: cards.map((c: any) => ({
            productId: null,
            slug: c._slug || '',
            name: c.name || '',
            image: normalizeImage(c.image),
            price: c.price ?? null,
            priceSuffix: c.price_suffix || null,
          })),
          buttonText: btn?.text || null,
          buttonUrl: btn?.url || null,
        } as CmsProductCards;
      }

      if (firstCardType === 'Post') {
        return {
          _type: 'post-cards',
          title,
          subtitle,
          posts: cards.map((post: any) => ({
            title: post.title || '',
            slug: post._slug || '',
            cover: normalizeImage(post.cover),
            excerpt: post.excerpt || null,
            readTime: post._read_time || null,
            author: post.author ? { name: post.author.name || '', avatar: null } : null,
            category: post.categories?.[0]?.name || null,
          })),
        } as CmsPostCards;
      }

      // Fallback: generic value-props
      return {
        _type: 'value-props',
        items: cards.map((card: any) => ({
          icon: card.image?.url || '',
          title: card.heading || '',
          text: card.sub_heading || '',
        })) as CmsValuePropItem[],
      };
    }
    case 'CTA':
      return {
        _type: 'call-to-action',
        title: raw.heading || '',
        description: raw.sub_heading || null,
        buttonText: '',
        buttonUrl: '',
        variant: 'primary',
      };
    case 'Contact':
      return {
        _type: 'contact-form',
        title: raw.heading || null,
        description: raw.sub_heading || null,
        successMessage: 'Thank you for your message. We will get back to you soon.',
        phone: raw.phone_number || null,
        email: raw.email || null,
        formTitle: raw.form_title || null,
      };
    case 'FAQ':
      return {
        _type: 'faq',
        title: raw.title || '',
        questions: (raw.questions || raw.faq_items || []).map((q: any) => ({
          question: q.question || '',
          answer: q.answer || '',
        })),
      } as CmsFaq;
    case 'Static':
      return {
        _type: 'static',
        staticType: raw.static_type || '',
        title: raw.title || null,
      } as CmsStatic;
    default:
      return null;
  }
}

function normalizeBlocks(raw: any[]): CmsTypedBlock[] {
  if (!raw) return [];
  const ctx: NormalizeCtx = { featureIndex: 0 };
  return raw.map((b) => normalizeBlock(b, ctx)).filter(Boolean) as CmsTypedBlock[];
}

function normalizePage(raw: any): CmsRichPage {
  return {
    id: raw._id,
    title: raw.title || '',
    slug: raw._slug || '',
    description: null,
    template: 'default',
    seo: normalizeSeo(raw.seo),
    blocks: normalizeBlocks(raw.content || []),
  };
}

function normalizeGlobal(raw: any): CmsGlobal {
  const langString = raw.availableLanguages || raw.available_languages || 'EN,NL';
  return {
    siteName: raw.siteName || raw.site_name || '',
    siteDescription: raw.siteDescription || raw.site_description || '',
    favicon: normalizeImage(raw.favicon),
    defaultSeo: normalizeSeo(raw.defaultSeo || raw.default_seo),
    logo: normalizeImage(raw.logo),
    logoAlt: raw.logoAlt || raw.logo_alt || null,
    topBarEnabled: raw.topBarEnabled ?? raw.top_bar_enabled ?? true,
    topBarPhone: raw.topBarPhone || raw.top_bar_phone || null,
    topBarAnnouncement: raw.topBarAnnouncement || raw.top_bar_announcement || null,
    topBarAnnouncementEnabled:
      raw.topBarAnnouncementEnabled ?? raw.top_bar_announcement_enabled ?? false,
    showVatToggle: raw.showVatToggle ?? raw.show_vat_toggle ?? true,
    showLanguageSwitcher: raw.showLanguageSwitcher ?? raw.show_language_switcher ?? true,
    availableLanguages: String(langString)
      .split(',')
      .map((l: string) => l.trim())
      .filter(Boolean),
    showSearch: raw.showSearch ?? raw.show_search ?? true,
    showAccount: raw.showAccount ?? raw.show_account ?? true,
    showCart: raw.showCart ?? raw.show_cart ?? true,
    showCategoriesMenu: raw.showCategoriesMenu ?? raw.show_categories_menu ?? true,
    categoriesMenuLabel: raw.categoriesMenuLabel || raw.categories_menu_label || null,
    navLinks: (raw.navLinks || raw.nav_links || []).map(normalizeNavLink),
    footerDescription: raw.footerDescription || raw.footer_description || null,
    footerColumns: (raw.footerColumns || raw.footer_columns || []).map(normalizeFooterColumn),
    footerEmail: raw.footerEmail || raw.footer_email || null,
    footerPhone: raw.footerPhone || raw.footer_phone || null,
    copyrightText: raw.copyrightText || raw.copyright_text || null,
  };
}

function normalizeAuthor(raw: any): CmsAuthor | null {
  if (!raw) return null;
  return {
    name: raw.name || '',
    avatar: normalizeImage(raw.avatar),
    email: raw.email || null,
  };
}

function normalizeArticle(raw: any): CmsArticle {
  const firstCategory = raw.categories?.[0];
  return {
    id: raw._id,
    title: raw.title || '',
    description: raw.excerpt || null,
    slug: raw._slug || '',
    cover: normalizeImage(raw.cover),
    author: normalizeAuthor(raw.author),
    category: firstCategory
      ? { name: firstCategory.name || '', slug: firstCategory._slug || '' }
      : null,
    blocks: normalizeBlocks(raw.content || []),
    publishedAt: raw._publish_on || null,
  };
}

// ── GraphQL fragments ──

const IMAGE_FIELDS = `url width height`;

const BUTTON_FRAGMENT = `
  text
  use_external_link
  external_url
  button_type
  link {
    ... on Page { _slug }
    ... on Post { _slug }
  }
`;

// ── Dynamic schema introspection ──

interface SchemaInfo {
  types: Set<string>;
  queryFields: Set<string>;
  pageContentTypes: Set<string>;
  fields: Record<string, Set<string>>;
}

function has(schema: SchemaInfo, typeName: string): boolean {
  return schema.types.has(typeName);
}

function hasField(schema: SchemaInfo, typeName: string, fieldName: string): boolean {
  return schema.fields[typeName]?.has(fieldName) ?? false;
}

function inPageContent(schema: SchemaInfo, typeName: string): boolean {
  // If Page_Content union doesn't exist (not introspectable), fall back to type existence
  return schema.pageContentTypes.size === 0
    ? has(schema, typeName)
    : schema.pageContentTypes.has(typeName);
}

function buildSeoFragment(schema: SchemaInfo): string {
  const hasMetaImage = hasField(schema, 'SEO', 'meta_image');
  return `seo {
    meta_title
    meta_description
    ${hasMetaImage ? `meta_image { ${IMAGE_FIELDS} }` : ''}
  }`;
}

function buildBlockFragments(schema: SchemaInfo, forPage: boolean): string {
  const fragments: string[] = ['__typename'];
  const isRich = has(schema, 'Button'); // Rich env (propeller) has Button type

  if (has(schema, 'Hero')) {
    fragments.push(`... on Hero {
      heading
      ${hasField(schema, 'Hero', 'sub_heading') ? 'sub_heading' : ''}
      ${hasField(schema, 'Hero', 'image') ? `image { ${IMAGE_FIELDS} }` : ''}
      ${hasField(schema, 'Hero', 'asset') ? `asset { ${IMAGE_FIELDS} }` : ''}
      ${hasField(schema, 'Hero', 'buttons') ? `buttons { ${BUTTON_FRAGMENT} }` : ''}
    }`);
  }

  if (has(schema, 'Feature') && (forPage ? inPageContent(schema, 'Feature') : true)) {
    fragments.push(`... on Feature {
      heading sub_heading
      button { ${BUTTON_FRAGMENT} }
      image { ${IMAGE_FIELDS} }
      image_position
    }`);
  }

  if (has(schema, 'CTA') && (forPage ? inPageContent(schema, 'CTA') : true)) {
    fragments.push(`... on CTA { heading sub_heading }`);
  }

  if (has(schema, 'Text') && (forPage ? inPageContent(schema, 'Text') : true)) {
    fragments.push(`... on Text { html body }`);
  }

  if (has(schema, 'Quote') && (forPage ? inPageContent(schema, 'Quote') : true)) {
    fragments.push(`... on Quote { body author }`);
  }

  if (has(schema, 'Assets') && (forPage ? inPageContent(schema, 'Assets') : true)) {
    fragments.push(`... on Assets { items { ${IMAGE_FIELDS} } }`);
  }

  // Page-only blocks
  if (forPage) {
    if (has(schema, 'Cards') && inPageContent(schema, 'Cards')) {
      if (isRich) {
        // Propeller env: heading, sub_heading, variant, cards[], button
        const cardsSubs: string[] = ['__typename'];
        if (has(schema, 'Product')) {
          cardsSubs.push(
            `... on Product { _slug name image { ${IMAGE_FIELDS} } price price_suffix }`
          );
        }
        if (has(schema, 'Post')) {
          cardsSubs.push(
            `... on Post { title _slug excerpt _read_time cover { ${IMAGE_FIELDS} } author { name } categories { _slug name } }`
          );
        }
        fragments.push(`... on Cards {
          heading sub_heading variant
          button { ${BUTTON_FRAGMENT} }
          cards { ${cardsSubs.join('\n')} }
        }`);
      } else {
        // Demo/simple env: title, products[] with _json containing Propeller IDs
        fragments.push(`... on Cards {
          title
          products { _id _json }
        }`);
      }
    }

    if (has(schema, 'Contact') && inPageContent(schema, 'Contact')) {
      fragments.push(`... on Contact {
        heading sub_heading form_title phone_number email hubspot_form_id hubspot_portal_id
      }`);
    }

    if (has(schema, 'FAQ') && inPageContent(schema, 'FAQ')) {
      const faqField = has(schema, 'FAQItem') ? 'faq_items' : 'questions';
      fragments.push(`... on FAQ { title ${faqField} { question answer } }`);
    }

    if (has(schema, 'Static') && inPageContent(schema, 'Static')) {
      fragments.push(`... on Static { title static_type }`);
    }
  }

  return fragments.join('\n');
}

// ── Provider factory ──

export function createPreprAdapter(opts: PreprAdapterOptions): CmsProvider {
  const base = (opts.endpointBase ?? 'https://graphql.prepr.io').replace(/\/$/, '');
  const endpoint = `${base}/${opts.token}`;
  const fetcher = opts.fetchImpl ?? fetch;

  // Schema introspection is cached per adapter instance.
  let schemaCache: SchemaInfo | null = null;

  async function preprFetch<T = any>(
    query: string,
    variables?: Record<string, any>,
    extraHeaders?: Record<string, string>
  ): Promise<T> {
    const res = await fetcher(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Prepr ${res.status} ${res.statusText} — ${body}`);
    }

    const json = (await res.json()) as any;

    if (json.errors?.length) {
      console.error(
        `[CMS:Prepr] GraphQL errors:`,
        json.errors.map((e: any) => e.message).join(', ')
      );
      if (!json.data) return {} as T;
    }

    return json.data as T;
  }

  async function getSchema(): Promise<SchemaInfo> {
    if (schemaCache) return schemaCache;
    try {
      const data = await preprFetch<any>(`{
        __schema { types { name kind } }
        QueryType: __type(name: "Query") { fields { name } }
        PageContent: __type(name: "Page_Content") { possibleTypes { name } }
        HeroType: __type(name: "Hero") { fields { name } }
        CardsType: __type(name: "Cards") { fields { name } }
        SEOType: __type(name: "SEO") { fields { name } }
        PostType: __type(name: "Post") { fields { name } }
        AuthorType: __type(name: "Author") { fields { name } }
      }`);

      const types = new Set<string>(
        (data?.__schema?.types || [])
          .filter((t: any) => t.kind === 'OBJECT' || t.kind === 'UNION' || t.kind === 'ENUM')
          .map((t: any) => t.name as string)
      );

      const queryFields = new Set<string>(
        (data?.QueryType?.fields || []).map((f: any) => f.name as string)
      );

      const pageContentTypes = new Set<string>(
        (data?.PageContent?.possibleTypes || []).map((t: any) => t.name as string)
      );

      const fields: Record<string, Set<string>> = {};
      const typeMap: [string, string][] = [
        ['HeroType', 'Hero'],
        ['CardsType', 'Cards'],
        ['SEOType', 'SEO'],
        ['PostType', 'Post'],
        ['AuthorType', 'Author'],
      ];
      for (const [key, prefix] of typeMap) {
        fields[prefix] = new Set<string>(
          (data?.[key]?.fields || []).map((f: any) => f.name as string)
        );
      }

      schemaCache = { types, queryFields, pageContentTypes, fields };
    } catch {
      schemaCache = {
        types: new Set(),
        queryFields: new Set(),
        pageContentTypes: new Set(),
        fields: {},
      };
    }
    return schemaCache;
  }

  return {
    async getPage(slug: string, options?: CmsPageOptions): Promise<CmsRichPage | null> {
      try {
        const schema = await getSchema();
        const pageFragments = buildBlockFragments(schema, true);
        const seoFragment = buildSeoFragment(schema);
        const lookupSlug = slug === 'home' ? '/' : slug;
        const segments = options?.segments?.filter(Boolean).sort();
        const headers: Record<string, string> = {};
        if (segments?.length) {
          headers['Prepr-Segments'] = segments.join(',');
        }
        const data = await preprFetch<any>(
          `{
          Pages(where: { _slug_any: ["${lookupSlug}"] }, limit: 1) {
            items {
              _id
              _slug
              title
              ${seoFragment}
              content {
                ${pageFragments}
              }
            }
          }
        }`,
          undefined,
          headers
        );
        const entry = data?.Pages?.items?.[0];
        if (!entry) return null;
        return normalizePage(entry);
      } catch (error) {
        console.error(`[CMS:Prepr] Failed to fetch page "${slug}":`, error);
        return null;
      }
    },

    async getAllPageSlugs(): Promise<string[]> {
      try {
        const data = await preprFetch<any>(`{
          Pages(limit: 100) {
            items { _slug }
          }
        }`);
        return (data?.Pages?.items || []).map((entry: any) => entry._slug);
      } catch (error) {
        console.error('[CMS:Prepr] Failed to fetch page slugs:', error);
        return [];
      }
    },

    async getGlobal(): Promise<CmsGlobal | null> {
      try {
        const schema = await getSchema();

        // Not all Prepr environments have a Navigation query
        if (!schema.queryFields.has('Navigation')) {
          return normalizeGlobal({ navLinks: [], siteName: '' });
        }

        const data = await preprFetch<any>(`{
          Navigation {
            _id
            internal_name
            top_navigation {
              text
              use_external_link
              external_url
              button_type
              link {
                ... on Page { _slug }
                ... on Post { _slug }
              }
            }
          }
        }`);
        const nav = data?.Navigation;
        const navLinks: CmsNavLink[] = (nav?.top_navigation || []).map((item: any) => {
          const url = item.link?._slug ? `/${item.link._slug}` : item.external_url || '';
          return { label: item.text || '', url, highlight: false };
        });
        return normalizeGlobal({ navLinks, siteName: nav?.internal_name || '' });
      } catch (error) {
        console.error('[CMS:Prepr] Failed to fetch global:', error);
        return null;
      }
    },

    async getCategoryBanner(_categoryId: string): Promise<CmsCategoryBanner | null> {
      // CategoryBanner model does not exist in this Prepr environment yet.
      return null;
    },

    async getArticles(): Promise<CmsArticle[]> {
      try {
        const schema = await getSchema();
        const hasCover = hasField(schema, 'Post', 'cover');
        const hasCategories = hasField(schema, 'Post', 'categories');
        const hasAuthorName = hasField(schema, 'Author', 'name');
        const data = await preprFetch<any>(`{
          Posts(sort: publish_on_DESC, limit: 100) {
            items {
              _id
              _slug
              title
              excerpt
              _publish_on
              ${hasCover ? `cover { ${IMAGE_FIELDS} }` : ''}
              ${hasAuthorName ? `author { name }` : ''}
              ${hasCategories ? `categories { name _slug }` : ''}
            }
          }
        }`);
        return (data?.Posts?.items || []).map((entry: any) => normalizeArticle(entry));
      } catch (error) {
        console.error('[CMS:Prepr] Failed to fetch articles:', error);
        return [];
      }
    },

    async getArticle(slug: string): Promise<CmsArticle | null> {
      try {
        const schema = await getSchema();
        const postFragments = buildBlockFragments(schema, false);
        const hasCover = hasField(schema, 'Post', 'cover');
        const hasCategories = hasField(schema, 'Post', 'categories');
        const hasAuthorName = hasField(schema, 'Author', 'name');
        const data = await preprFetch<any>(`{
          Posts(where: { _slug_any: ["${slug}"] }, limit: 1) {
            items {
              _id
              _slug
              title
              excerpt
              _publish_on
              ${hasCover ? `cover { ${IMAGE_FIELDS} }` : ''}
              ${hasAuthorName ? `author { name }` : ''}
              ${hasCategories ? `categories { name _slug }` : ''}
              content {
                ${postFragments}
              }
            }
          }
        }`);
        const entry = data?.Posts?.items?.[0];
        if (!entry) return null;
        return normalizeArticle(entry);
      } catch (error) {
        console.error(`[CMS:Prepr] Failed to fetch article "${slug}":`, error);
        return null;
      }
    },

    async getAllArticleSlugs(): Promise<string[]> {
      try {
        const data = await preprFetch<any>(`{
          Posts(limit: 100) {
            items { _slug }
          }
        }`);
        return (data?.Posts?.items || []).map((entry: any) => entry._slug);
      } catch (error) {
        console.error('[CMS:Prepr] Failed to fetch article slugs:', error);
        return [];
      }
    },

    resolveImageUrl(path: string): string {
      // Prepr returns absolute asset URLs already.
      return path;
    },
  };
}
