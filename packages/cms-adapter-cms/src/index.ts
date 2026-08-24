/**
 * Generic Propeller CMS adapter — v0.1 STUB.
 *
 * Implements the full `CmsProvider` contract with empty/null returns. This
 * exercises every method the provider, scaffolder wiring, and `propeller
 * doctor` paths touch — before the real backend is ready.
 *
 * Shops that pick `--cms=cms` get this stub installed and wired. When the
 * real backend ships, swap the implementation in this file — the public
 * `createPropellerCmsAdapter` factory signature must stay stable.
 */

import type {
  CmsProvider,
  CmsArticle,
  CmsCategoryBanner,
  CmsGlobal,
  CmsRichPage,
} from '@propeller-commerce/propeller-v2-core-ui';

export interface PropellerCmsAdapterOptions {
  endpoint?: string;
  token?: string;
}

export function createPropellerCmsAdapter(
  opts: PropellerCmsAdapterOptions = {}
): CmsProvider {
  const base = (opts.endpoint ?? '').replace(/\/$/, '');

  return {
    async getPage(_slug: string): Promise<CmsRichPage | null> {
      return null;
    },
    async getAllPageSlugs(): Promise<string[]> {
      return [];
    },
    async getGlobal(): Promise<CmsGlobal | null> {
      return null;
    },
    async getCategoryBanner(_categoryId: string): Promise<CmsCategoryBanner | null> {
      return null;
    },
    async getArticles(): Promise<CmsArticle[]> {
      return [];
    },
    async getArticle(_slug: string): Promise<CmsArticle | null> {
      return null;
    },
    async getAllArticleSlugs(): Promise<string[]> {
      return [];
    },
    resolveImageUrl(path: string): string {
      // No backend yet: pass relative paths through, prefix absolute-on-CMS
      // paths with the endpoint when one is configured.
      if (!path) return path;
      if (/^https?:\/\//.test(path)) return path;
      return base ? `${base}${path.startsWith('/') ? '' : '/'}${path}` : path;
    },
  };
}
