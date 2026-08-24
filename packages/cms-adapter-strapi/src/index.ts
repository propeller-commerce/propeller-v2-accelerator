/**
 * Strapi REST CmsProvider.
 *
 * Maps Strapi v5 REST responses to the framework-agnostic, full-fidelity
 * `CmsProvider` contract in propeller-v2-core-ui — the same contract the
 * in-production Next boilerplate implements. Covers pages (typed blocks),
 * blog articles, category banners, a typed global, static-slug enumeration,
 * and image-URL resolution.
 *
 * Usage:
 *
 *   import { createStrapiAdapter } from 'propeller-v2-cms-adapter-strapi';
 *   const cms = createStrapiAdapter({ endpoint: process.env.CMS_URL! });
 *
 * Then pass `cms` into PropellerProvider's CMS seam and call it from
 * server-side data fetchers (RSC, Vite SSR entry) — never from interactive
 * components directly.
 *
 * Dependency-free by design: query strings are built with URLSearchParams and
 * the bracket syntax Strapi expects; rich-text `body` is passed through as
 * markdown for the renderer to parse (the boilerplate renders markdown at the
 * block level), so this adapter pulls in no `qs`/`marked` runtime deps.
 */

import type {
  CmsProvider,
  CmsArticle,
  CmsAuthor,
  CmsCategoryBanner,
  CmsFooterColumn,
  CmsGlobal,
  CmsImage,
  CmsNavLink,
  CmsRichPage,
  CmsSeo,
  CmsTypedBlock,
  CmsValuePropItem,
} from '@propeller-commerce/propeller-v2-core-ui';

export interface StrapiAdapterOptions {
  /** Strapi public API base URL, e.g. `'http://localhost:1337'`. */
  endpoint: string;
  /** Optional API token for authenticated routes. */
  token?: string;
  /** Customise the fetch implementation (test stub, server-only Next, etc.). */
  fetchImpl?: typeof fetch;
}

// ── Normalizers (Strapi v5 flat shape) ──

function normalizeImage(base: string, raw: any): CmsImage | null {
  if (!raw) return null;
  const url = raw.url?.startsWith('http') ? raw.url : `${base}${raw.url ?? ''}`;
  return {
    url,
    alternativeText: raw.alternativeText || null,
    width: raw.width || 0,
    height: raw.height || 0,
  };
}

function normalizeSeo(base: string, raw: any): CmsSeo | null {
  if (!raw) return null;
  return {
    metaTitle: raw.metaTitle || '',
    metaDescription: raw.metaDescription || '',
    shareImage: normalizeImage(base, raw.shareImage),
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

const COMPONENT_MAP: Record<string, string> = {
  'shared.hero-banner': 'hero-banner',
  'shared.rich-text': 'rich-text',
  'shared.media': 'media',
  'shared.quote': 'quote',
  'shared.value-props': 'value-props',
  'shared.call-to-action': 'call-to-action',
  'shared.product-carousel': 'product-carousel',
  'shared.contact-form': 'contact-form',
  'shared.slider': 'slider',
  'shared.product-slider': 'product-slider',
};

function normalizeBlock(base: string, raw: any): CmsTypedBlock | null {
  const type = COMPONENT_MAP[raw.__component];
  if (!type) return null;

  switch (type) {
    case 'hero-banner':
      return {
        _type: 'hero-banner',
        title: raw.title || '',
        subtitle: raw.subtitle || null,
        image: normalizeImage(base, raw.image),
        ctaText: raw.ctaText || null,
        ctaUrl: raw.ctaUrl || null,
        secondaryCtaText: raw.secondaryCtaText || null,
        secondaryCtaUrl: raw.secondaryCtaUrl || null,
      };
    case 'rich-text':
      // Pass markdown through; the renderer parses it at the block level.
      return { _type: 'rich-text', body: raw.body || '' };
    case 'media':
      return { _type: 'media', file: normalizeImage(base, raw.file) };
    case 'quote':
      return { _type: 'quote', title: raw.title || null, body: raw.body || '' };
    case 'value-props':
      return { _type: 'value-props', items: (raw.items || []).map(normalizeValuePropItem) };
    case 'call-to-action':
      return {
        _type: 'call-to-action',
        title: raw.title || '',
        description: raw.description || null,
        buttonText: raw.buttonText || '',
        buttonUrl: raw.buttonUrl || '',
        variant: raw.variant || 'primary',
      };
    case 'product-carousel':
      return {
        _type: 'product-carousel',
        title: raw.title || '',
        categoryId: raw.categoryId || '',
        limit: raw.limit || 8,
      };
    case 'contact-form':
      return {
        _type: 'contact-form',
        title: raw.title || null,
        description: raw.description || null,
        successMessage:
          raw.successMessage || 'Thank you for your message. We will get back to you soon.',
        phone: null,
        email: null,
        formTitle: null,
      };
    case 'slider':
      return {
        _type: 'slider',
        files: (raw.files || [])
          .map((f: any) => normalizeImage(base, f))
          .filter(Boolean) as CmsImage[],
      };
    case 'product-slider': {
      const items =
        typeof raw.items === 'string' ? safeJsonParse(raw.items) : raw.items;
      const parsed = Array.isArray(items) ? items : [];
      return {
        _type: 'product-slider',
        title: raw.title || '',
        productIds: parsed.filter((p: any) => !p.isCluster).map((p: any) => p.id),
        clusterIds: parsed.filter((p: any) => p.isCluster).map((p: any) => p.id),
      };
    }
    default:
      return null;
  }
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value || '[]');
  } catch {
    return [];
  }
}

function normalizeBlocks(base: string, raw: any[]): CmsTypedBlock[] {
  if (!raw) return [];
  return raw.map((b) => normalizeBlock(base, b)).filter(Boolean) as CmsTypedBlock[];
}

function normalizePage(base: string, raw: any): CmsRichPage {
  return {
    id: raw.id,
    title: raw.title || '',
    slug: raw.slug || '',
    description: raw.description || null,
    template: raw.template || 'default',
    seo: normalizeSeo(base, raw.seo),
    blocks: normalizeBlocks(base, raw.blocks || []),
  };
}

function normalizeGlobal(base: string, raw: any): CmsGlobal {
  const langString = raw.availableLanguages || 'EN,NL';
  return {
    siteName: raw.siteName || '',
    siteDescription: raw.siteDescription || '',
    favicon: normalizeImage(base, raw.favicon),
    defaultSeo: normalizeSeo(base, raw.defaultSeo),
    logo: normalizeImage(base, raw.logo),
    logoAlt: raw.logoAlt || null,
    topBarEnabled: raw.topBarEnabled ?? true,
    topBarPhone: raw.topBarPhone || null,
    topBarAnnouncement: raw.topBarAnnouncement || null,
    topBarAnnouncementEnabled: raw.topBarAnnouncementEnabled ?? false,
    showVatToggle: raw.showVatToggle ?? true,
    showLanguageSwitcher: raw.showLanguageSwitcher ?? true,
    availableLanguages: langString
      .split(',')
      .map((l: string) => l.trim())
      .filter(Boolean),
    showSearch: raw.showSearch ?? true,
    showAccount: raw.showAccount ?? true,
    showCart: raw.showCart ?? true,
    showCategoriesMenu: raw.showCategoriesMenu ?? true,
    categoriesMenuLabel: raw.categoriesMenuLabel || null,
    navLinks: (raw.navLinks || []).map(normalizeNavLink),
    footerDescription: raw.footerDescription || null,
    footerColumns: (raw.footerColumns || []).map(normalizeFooterColumn),
    footerEmail: raw.footerEmail || null,
    footerPhone: raw.footerPhone || null,
    copyrightText: raw.copyrightText || null,
  };
}

function normalizeCategoryBanner(base: string, raw: any): CmsCategoryBanner {
  return {
    categoryId: raw.categoryId || '',
    title: raw.title || null,
    subtitle: raw.subtitle || null,
    image: normalizeImage(base, raw.image),
    ctaText: raw.ctaText || null,
    ctaUrl: raw.ctaUrl || null,
  };
}

function normalizeAuthor(base: string, raw: any): CmsAuthor | null {
  if (!raw) return null;
  return {
    name: raw.name || '',
    avatar: normalizeImage(base, raw.avatar),
    email: raw.email || null,
  };
}

function normalizeArticle(base: string, raw: any): CmsArticle {
  return {
    id: raw.id,
    title: raw.title || '',
    description: raw.description || null,
    slug: raw.slug || '',
    cover: normalizeImage(base, raw.cover),
    author: normalizeAuthor(base, raw.author),
    category: raw.category
      ? { name: raw.category.name || '', slug: raw.category.slug || '' }
      : null,
    blocks: normalizeBlocks(base, raw.blocks || []),
    publishedAt: raw.publishedAt || null,
  };
}

// ── Provider factory ──

export function createStrapiAdapter(opts: StrapiAdapterOptions): CmsProvider {
  const base = opts.endpoint.replace(/\/$/, '');
  const fetcher = opts.fetchImpl ?? fetch;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;

  async function getJson<T = any>(path: string, query?: string): Promise<T | null> {
    const url = `${base}${path}${query ? `?${query}` : ''}`;
    const res = await fetcher(url, { headers });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Strapi ${url} → HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  }

  return {
    async getPage(slug: string): Promise<CmsRichPage | null> {
      try {
        const params = new URLSearchParams({
          'filters[slug][$eq]': slug,
          'populate[seo][populate]': '*',
          'populate[blocks][populate]': '*',
        });
        const data = await getJson('/api/pages', params.toString());
        const entry = data?.data?.[0];
        if (!entry) return null;
        return normalizePage(base, entry);
      } catch (error) {
        console.error(`[CMS:Strapi] Failed to fetch page "${slug}":`, error);
        return null;
      }
    },

    async getAllPageSlugs(): Promise<string[]> {
      try {
        const params = new URLSearchParams({
          'fields[0]': 'slug',
          'pagination[pageSize]': '100',
        });
        const data = await getJson('/api/pages', params.toString());
        return (data?.data || []).map((entry: any) => entry.slug);
      } catch (error) {
        console.error('[CMS:Strapi] Failed to fetch page slugs:', error);
        return [];
      }
    },

    async getGlobal(): Promise<CmsGlobal | null> {
      try {
        const params = new URLSearchParams({
          'populate[favicon]': 'true',
          'populate[logo]': 'true',
          'populate[defaultSeo][populate]': '*',
          'populate[navLinks]': 'true',
          'populate[footerColumns][populate]': '*',
        });
        const data = await getJson('/api/global', params.toString());
        const entry = data?.data;
        if (!entry) return null;
        return normalizeGlobal(base, entry);
      } catch (error) {
        console.error('[CMS:Strapi] Failed to fetch global:', error);
        return null;
      }
    },

    async getCategoryBanner(categoryId: string): Promise<CmsCategoryBanner | null> {
      try {
        const params = new URLSearchParams({
          'filters[categoryId][$eq]': categoryId,
          'populate[image]': 'true',
        });
        const data = await getJson('/api/category-banners', params.toString());
        const entry = data?.data?.[0];
        if (!entry) return null;
        return normalizeCategoryBanner(base, entry);
      } catch {
        // Banner is optional — never throw.
        return null;
      }
    },

    async getArticles(): Promise<CmsArticle[]> {
      try {
        const params = new URLSearchParams({
          'populate[cover]': 'true',
          'populate[author][populate]': 'avatar',
          'populate[category]': 'true',
          sort: 'publishedAt:desc',
          'pagination[pageSize]': '100',
        });
        const data = await getJson('/api/articles', params.toString());
        return (data?.data || []).map((entry: any) => normalizeArticle(base, entry));
      } catch (error) {
        console.error('[CMS:Strapi] Failed to fetch articles:', error);
        return [];
      }
    },

    async getArticle(slug: string): Promise<CmsArticle | null> {
      try {
        const params = new URLSearchParams({
          'filters[slug][$eq]': slug,
          'populate[cover]': 'true',
          'populate[author][populate]': 'avatar',
          'populate[category]': 'true',
          'populate[blocks][populate]': '*',
        });
        const data = await getJson('/api/articles', params.toString());
        const entry = data?.data?.[0];
        if (!entry) return null;
        return normalizeArticle(base, entry);
      } catch (error) {
        console.error(`[CMS:Strapi] Failed to fetch article "${slug}":`, error);
        return null;
      }
    },

    async getAllArticleSlugs(): Promise<string[]> {
      try {
        const params = new URLSearchParams({
          'fields[0]': 'slug',
          'pagination[pageSize]': '100',
        });
        const data = await getJson('/api/articles', params.toString());
        return (data?.data || []).map((entry: any) => entry.slug);
      } catch (error) {
        console.error('[CMS:Strapi] Failed to fetch article slugs:', error);
        return [];
      }
    },

    resolveImageUrl(path: string): string {
      if (!path) return path;
      if (path.startsWith('http')) return path;
      return `${base}${path}`;
    },
  };
}
