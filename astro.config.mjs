// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

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
