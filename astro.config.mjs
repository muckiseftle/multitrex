// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// GitHub Pages mit Custom Domain serviert an der Root —
// muckiseftle.github.io/multitrex leitet automatisch auf die Domain um.
export default defineConfig({
  site: 'https://astrofotografie-allgaeu.de',
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
