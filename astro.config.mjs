// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// GitHub Pages serviert unter https://muckiseftle.github.io/multitrex/ —
// der Actions-Workflow setzt GITHUB_PAGES=true. Lokal und auf der eigenen
// Domain (Cloudflare) bleibt alles auf Root-Pfaden.
const isGitHubPages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  site: isGitHubPages ? 'https://muckiseftle.github.io' : 'https://astrofotografie-allgaeu.de',
  base: isGitHubPages ? '/multitrex' : undefined,
  integrations: [sitemap()],
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  image: {
    // Astro-Bildpipeline (Sharp): AVIF/WebP + srcset
    responsiveStyles: true,
  },
  vite: {
    build: {
      // Three.js bekommt einen eigenen Chunk, der nur auf /sonnensystem lädt
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },
  },
});
