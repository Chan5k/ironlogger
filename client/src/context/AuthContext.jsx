import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api, { setAuthToken } from '../api/client.js';

const AuthContext = createContext(null);
const STORAGE_KEY = 'ironlog_token';
const USER_KEY = 'ironlog_user';

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
        const { data } = await api.get('/auth/me');
        if (!cancelled) {
          setUser(data.user);
          setImpersonating(!!data.impersonating);
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        }
      } catch {
        if (!cancelled) {
          setTokenState(null);
          setUser(null);
          setImpersonating(false);
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(USER_KEY);
          setAuthToken(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const setToken = (t, u) => {
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
  };

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
    [token, user, loading, impersonating]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
