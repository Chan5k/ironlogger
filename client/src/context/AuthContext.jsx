import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { setAuthToken } from '../api/client.js';

const AuthContext = createContext(null);
const STORAGE_KEY = 'ironlog_token';
const USER_KEY = 'ironlog_user';

const ME_ATTEMPTS = 4;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => localStorage.getItem(STORAGE_KEY));
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(!!localStorage.getItem(STORAGE_KEY));
  const [impersonating, setImpersonating] = useState(false);

  const setToken = useCallback((t, u) => {
    if (t) {
      localStorage.setItem(STORAGE_KEY, t);
      setTokenState(t);
      if (u) {
        setUser(u);
        localStorage.setItem(USER_KEY, JSON.stringify(u));
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(USER_KEY);
      setTokenState(null);
      setUser(null);
      setImpersonating(false);
    }
    setAuthToken(t || null);
  }, []);

  useEffect(() => {
    setAuthToken(token || null);
    if (!token) {
      setLoading(false);
      setImpersonating(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        for (let attempt = 0; attempt < ME_ATTEMPTS; attempt++) {
          try {
            const { data } = await api.get('/auth/me');
            if (cancelled) return;
            setUser(data.user);
            setImpersonating(!!data.impersonating);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            return;
          } catch (e) {
            if (cancelled) return;
            const status = e.response?.status;
            if (status === 401) {
              setToken(null);
              return;
            }
            if (attempt < ME_ATTEMPTS - 1) {
              await sleep(2000 * (attempt + 1));
              continue;
            }
            // Cold start / network: keep token and cached profile (localStorage user already in state)
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, setToken]);

  /** Sliding session: new JWT when tab becomes visible (throttled). */
  useEffect(() => {
    if (!token) return;
    let last = 0;
    let cancelled = false;

    const run = async () => {
      const now = Date.now();
      if (now - last < 60_000) return;
      last = now;
      try {
        const { data } = await api.post('/auth/refresh');
        if (cancelled) return;
        setToken(data.token, data.user);
        setImpersonating(!!data.impersonating);
      } catch {
        // Expired / revoked token: next API call returns 401; avoid logging out on transient errors here
      }
    };

    const onVis = () => {
      if (document.visibilityState === 'visible') run();
    };

    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [token, setToken]);

  const refreshUser = async () => {
    const { data } = await api.get('/auth/me');
    setUser(data.user);
    setImpersonating(!!data.impersonating);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  };

  const endImpersonation = async () => {
    const { data } = await api.post('/auth/end-impersonate');
    setToken(data.token, data.user);
    setImpersonating(false);
    return data.user;
  };

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      impersonating,
      isAuthenticated: !!token && !!user,
      setToken,
      refreshUser,
      endImpersonation,
      logout: () => setToken(null),
    }),
    [token, user, loading, impersonating, setToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
