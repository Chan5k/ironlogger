import axios from 'axios';

/** Production: set VITE_API_URL to API origin (e.g. https://xxx.onrender.com). Local dev uses Vite proxy → /api. */
function apiBaseURL() {
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
