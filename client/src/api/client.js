import axios from 'axios';

/**
 * Production / preview: set VITE_API_URL to API origin (e.g. https://xxx.onrender.com).
 * Vite dev (`npm run dev`): always `/api` → proxy to localhost:5000 so `.env.local` from Vercel
 * (which often sets VITE_API_URL to production) does not break local registration/API calls.
 */
function apiBaseURL() {
  if (import.meta.env.DEV) {
    return '/api';
  }
  const env = import.meta.env.VITE_API_URL;
  if (env && String(env).trim()) {
    const origin = String(env).replace(/\/$/, '');
    return `${origin}/api`;
  }
  return '/api';
}

const api = axios.create({
  baseURL: apiBaseURL(),
  headers: { 'Content-Type': 'application/json' },
});

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export default api;


