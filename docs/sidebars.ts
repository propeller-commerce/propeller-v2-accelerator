import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'index',
    'getting-started',
    {
      type: 'category',
      label: 'CLI',
      collapsed: false,
      items: ['cli', 'doctor'],
    },
    {
      type: 'category',
      label: 'Shop concepts',
      collapsed: false,
      items: ['shop-modes', 'templates', 'cms', 'scaffolded-layout'],
    },
    'propeller-json',
    'roadmap',
    'changelog',
  ],
};

export default sidebars;
