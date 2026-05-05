import { defineConfig } from 'vitepress';

const docsBase = process.env.DOCS_BASE || '/docs/';

export default defineConfig({
  title: 'Documentation',
  description: 'PVE NoteBuddy Documentation',
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `https://jangajones.github.io/pve-notebuddy/docs/icons/notebuddy-logo.svg` }]
  ],
  srcDir: 'source',
  base: docsBase,
  themeConfig: {
    search: {
      provider: 'local'
    },
    logo: '/icons/notebuddy-logo.svg',
    nav: [
      { text: 'Docs', link: '/' },
      { text: 'PVE NoteBuddy', link: 'https://jangajones.github.io/pve-notebuddy/' }
    ],
    sidebar: [
      {
        text: 'Getting Started',
        collapsed: false,
        items: [
          { text: 'Introduction', link: '/getting-started/introduction' },
          { text: 'Should I Self-Host?', link: '/getting-started/should-i-selfhost' }
        ]
      },
      {
        text: 'How To Use',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/how-to-use/overview' },
          { text: 'Icons', link: '/how-to-use/icons' },
          { text: 'Note Elements', link: '/how-to-use/note-elements' },
          { text: 'Formatting', link: '/how-to-use/formatting' },
          { text: 'Preview Sidebar', link: '/how-to-use/preview-sidebar' },
          { text: 'Emoji Sidebar', link: '/how-to-use/emoji-sidebar' },
          { text: 'Tips and Tricks', link: '/how-to-use/tips-and-tricks' }
        ]
      },
      {
        text: 'Templates',
        collapsed: false,
        items: [
          { text: 'Template Search', link: '/templates/template-search' },
          { text: 'Designs', link: '/templates/designs' },
          { text: 'Snapshots', link: '/templates/snapshots' }
        ]
      },
      {
        text: 'Configuration',
        collapsed: false,
        items: [
          { text: 'Settings', link: '/configuration/settings' },
          { text: 'weserv/images', link: '/configuration/weserv-images' },
          { text: 'Backup', link: '/configuration/backup' }
        ]
      },
      {
        text: 'Self-Hosting',
        collapsed: true,
        items: [
          { text: 'Overview', link: '/selfhosting/' },
          { text: 'Linux', link: '/selfhosting/linux' },
          { text: 'Proxmox LXC', link: '/selfhosting/proxmox-lxc' },
          { text: 'Docker', link: '/selfhosting/docker' },
          { text: 'macOS', link: '/selfhosting/mac-os' },
          { text: 'Windows', link: '/selfhosting/windows' },
          { text: 'Updating Templates', link: '/selfhosting/updating-templates' },
          { text: 'Custom Templates', link: '/selfhosting/custom-templates' }
        ]
      },
      {
        text: 'Contributing',
        collapsed: true,
        items: [
          { text: 'Templates', link: '/contributing/templates' },
          { text: 'Pull Requests', link: '/contributing/pull-requests' },
          { text: 'Feature Requests', link: '/contributing/feature-requests' },
          { text: 'Development', link: '/contributing/development' },
          { text: 'Architecture', link: '/contributing/architecture' }
        ]
      },
      {
        text: 'Miscellaneous',
        collapsed: false,
        items: [
          { text: 'FAQ', link: '/miscellaneous/faq' },
          { text: 'Thanks', link: '/miscellaneous/thanks' }
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/JangaJones/pve-notebuddy' }
    ]
  }
});
