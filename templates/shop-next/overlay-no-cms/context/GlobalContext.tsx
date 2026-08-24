'use client';

import { createContext, useContext } from 'react';

// ── Global header/footer shape ──
// In a CMS-backed shop this comes from the CMS "global" singleton (and the
// type lives in lib/cms/types). This shop has no CMS, so lib/cms was removed
// at scaffold time; the shape is inlined here so Header/Footer keep their
// typed property access. The provider is always fed `null` (layout.tsx), so
// every field falls back to the component defaults — but the structure is kept
// intact so a CMS can be wired in later without rewriting consumers.

interface GlobalImage {
  url: string;
  alternativeText: string | null;
  width: number;
  height: number;
}

interface GlobalNavLink {
  label: string;
  url: string;
  highlight: boolean;
}

interface GlobalFooterColumn {
  title: string;
  links: GlobalNavLink[];
}

export interface GlobalData {
  siteName: string;
  siteDescription: string;
  favicon: GlobalImage | null;
  defaultSeo: { metaTitle: string; metaDescription: string; shareImage: GlobalImage | null } | null;
  // Header — branding
  logo: GlobalImage | null;
  logoAlt: string | null;
  // Header — top bar
  topBarEnabled: boolean;
  topBarPhone: string | null;
  topBarAnnouncement: string | null;
  topBarAnnouncementEnabled: boolean;
  showVatToggle: boolean;
  showLanguageSwitcher: boolean;
  availableLanguages: string[];
  // Header — functional components
  showSearch: boolean;
  showAccount: boolean;
  showCart: boolean;
  showCategoriesMenu: boolean;
  categoriesMenuLabel: string | null;
  // Header — navigation
  navLinks: GlobalNavLink[];
  // Footer
  footerDescription: string | null;
  footerColumns: GlobalFooterColumn[];
  footerEmail: string | null;
  footerPhone: string | null;
  copyrightText: string | null;
}

const GlobalContext = createContext<GlobalData | null>(null);

export function GlobalProvider({
  globalData,
  children,
}: {
  globalData: GlobalData | null;
  children: React.ReactNode;
}) {
  return (
    <GlobalContext.Provider value={globalData}>
      {children}
    </GlobalContext.Provider>
  );
}

export function useGlobal(): GlobalData | null {
  return useContext(GlobalContext);
}
