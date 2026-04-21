import type { Config } from '@docusaurus/types';
import type { Preset } from '@docusaurus/preset-classic';

const config: Config = {
  title: '20byte Developer Docs',
  tagline: 'WhatsApp Public API v1',

  url: 'https://docs.20byte.com',
  baseUrl: '/',

  organizationName: '20byte',
  projectName: 'developer-docs',
  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn'
    }
  },

  i18n: {
    defaultLocale: 'id',
    locales: ['id']
  },
  future: {
    faster: {
      rspackBundler: true
    }
  },

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts'
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css'
        }
      } satisfies Preset.Options
    ]
  ],

  themeConfig: {
    navbar: {
      title: '20byte Docs',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'apiSidebar',
          position: 'left',
          label: 'API'
        },
        {
          href: 'https://20byte.com',
          label: '20byte.com',
          position: 'right'
        }
      ]
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Developer',
          items: [
            {
              label: 'WhatsApp API v1',
              to: '/'
            }
          ]
        }
      ],
      copyright: `Copyright © ${new Date().getFullYear()} 20byte.`
    },
    prism: {
      additionalLanguages: ['bash', 'php', 'python']
    }
  } satisfies Preset.ThemeConfig
};

export default config;
