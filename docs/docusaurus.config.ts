import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import {themes as prismThemes} from 'prism-react-renderer';

const config: Config = {
  title: 'Propeller Accelerator',
  tagline: 'Scaffold a Propeller Commerce shop in minutes',
  favicon: 'img/favicon.png',

  url: 'https://propeller-commerce.github.io',
  baseUrl: '/propeller-v2-accelerator/',
  organizationName: 'propeller-commerce',
  projectName: 'propeller-v2-accelerator',
  trailingSlash: false,

  onBrokenLinks: 'warn',
  onBrokenAnchors: 'warn',
  markdown: {format: 'detect', hooks: {onBrokenMarkdownLinks: 'warn'}},

  i18n: {defaultLocale: 'en', locales: ['en']},

  presets: [
    [
      'classic',
      {
        docs: {
          path: 'content',
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
        },
        blog: false,
        theme: {customCss: './src/css/custom.css'},
        sitemap: {changefreq: 'weekly', priority: 0.5},
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.png',
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: true,
      disableSwitch: false,
    },
    navbar: {
      title: 'Propeller Accelerator',
      logo: {
        alt: 'Propeller',
        src: 'img/logo.png',
        srcDark: 'img/logo-dark.png',
        height: 30,
      },
      items: [
        {to: '/getting-started', label: 'Getting started', position: 'left'},
        {to: '/cli', label: 'CLI', position: 'left'},
        {to: '/shop-modes', label: 'Shop modes', position: 'left'},
        {to: '/templates', label: 'Templates', position: 'left'},
        {to: '/cms', label: 'CMS', position: 'left'},
        {to: '/changelog', label: 'Changelog', position: 'left'},
        {
          href: 'https://github.com/propeller-commerce/propeller-v2-accelerator',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {label: 'Getting started', to: '/getting-started'},
            {label: 'CLI reference', to: '/cli'},
            {label: 'Shop modes', to: '/shop-modes'},
            {label: 'Templates', to: '/templates'},
          ],
        },
        {
          title: 'Reference',
          items: [
            {label: 'propeller.json schema', to: '/propeller-json'},
            {label: 'doctor command', to: '/doctor'},
            {label: 'CMS adapters', to: '/cms'},
            {label: 'Changelog', to: '/changelog'},
          ],
        },
        {
          title: 'Related packages',
          items: [
            {
              label: 'Core UI',
              href: 'https://propeller-commerce.github.io/propeller-v2-core-ui/',
            },
            {
              label: 'React UI',
              href: 'https://propeller-commerce.github.io/propeller-v2-react-ui/',
            },
            {
              label: 'Vue UI',
              href: 'https://propeller-commerce.github.io/propeller-v2-vue-ui/',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/propeller-commerce/propeller-v2-accelerator',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Propeller Commerce.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json'],
    },
  } satisfies Preset.ThemeConfig,

  plugins: [
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        indexDocs: true,
        indexBlog: false,
        docsRouteBasePath: '/',
      },
    ],
  ],
};

export default config;
