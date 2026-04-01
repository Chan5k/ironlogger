import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * GitHub Pages project site: VITE_BASE_PATH=/your-repo-name/
 * User site (username.github.io): leave unset or VITE_BASE_PATH=/
 */
function normalizeBase() {
  const raw = process.env.VITE_BASE_PATH;
  if (raw === undefined || raw === '' || String(raw).trim() === '/') {
    return '/';
  }
  let s = String(raw).trim();
  if (!s.startsWith('/')) s = `/${s}`;
  if (!s.endsWith('/')) s = `${s}/`;
  return s;
}

function scopeForManifest(viteBase) {
  if (viteBase === '/') return '/';
  return viteBase.endsWith('/') ? viteBase : `${viteBase}/`;
}

function startUrlForManifest(viteBase) {
  if (viteBase === '/') return '/app';
  return `${String(viteBase).replace(/\/$/, '')}/app`;
}

export default defineConfig(({ mode }) => {
  const base = normalizeBase();
  return {
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      manifest: {
        name: 'IronLog',
        short_name: 'IronLog',
        description:
          'Log workouts, plans, and training progress. Works offline for logging; workouts sync when you reconnect.',
        theme_color: '#0b0e14',
        background_color: '#0b0e14',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: scopeForManifest(base),
        start_url: startUrlForManifest(base),
        icons: [
          {
            src: 'icons/favicon-32.png',
            sizes: '32x32',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff2,wav,mp3}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: {
        enabled: mode === 'development' && process.env.VITE_PWA_DEV === '1',
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
};
});
