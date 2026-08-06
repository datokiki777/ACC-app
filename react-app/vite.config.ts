import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import {
  createAccPwaManifest,
  DEFAULT_BASE_PATH,
  normalizeBasePath,
} from './src/app/config/pwa.ts';

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), 'VITE_');
  const basePath = normalizeBasePath(environment.VITE_BASE_PATH ?? DEFAULT_BASE_PATH);

  return {
    base: basePath,
    build: {
      outDir: mode === 'github' ? 'dist-github' : 'dist',
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['icons/*'],
        manifest: createAccPwaManifest(basePath),
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: false,
          skipWaiting: false,
          navigateFallback: 'index.html',
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        },
        devOptions: { enabled: false },
      }),
    ],
  };
});
