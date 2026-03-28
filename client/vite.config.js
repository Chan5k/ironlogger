import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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

export default defineConfig({
  base: normalizeBase(),
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
