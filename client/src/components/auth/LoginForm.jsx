import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { appPath } from '../../constants/routes.js';

/**
 * @param {{ idPrefix?: string, className?: string, footer?: import('react').ReactNode }} props
 */
export default function LoginForm({ idPrefix = 'login', className = '', footer = null }) {
  const { setToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = typeof location.state?.from === 'string' ? location.state.from : null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setToken(data.token, data.user);
      navigate(from && from.startsWith('/') ? from : appPath(), { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form id={`${idPrefix}-form`} onSubmit={onSubmit} className={className}>
        {error ? (
          <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">{error}</p>
        ) : null}
        <div>
          <label htmlFor={`${idPrefix}-email`} className="mb-1 block text-xs text-slate-400">
            Email
          </label>
          <input
            id={`${idPrefix}-email`}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-surface-card px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-accent"
            required
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-password`} className="mb-1 block text-xs text-slate-400">
            Password
          </label>
          <input
            id={`${idPrefix}-password`}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-surface-card px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-accent"
            required
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      {footer}
    </>
  );
}
