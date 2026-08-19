import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { injectAdSensePublisherId } from '../config/adsense-config.mjs';

function adsensePublisherPlugin(): Plugin {
  return {
    name: 'gxa-adsense-publisher',
    transformIndexHtml(html) {
      return injectAdSensePublisherId(html, 'Background Remover HTML template');
    }
  };
}

export default defineConfig({
  base: '/background-remover/',
  plugins: [adsensePublisherPlugin(), react()],
  publicDir: 'public',
  build: {
    outDir: '../public_html/background-remover',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022'
  },
  server: {
    port: 4173,
    strictPort: true
  },
  preview: {
    port: 4174,
    strictPort: true
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true
  }
});
