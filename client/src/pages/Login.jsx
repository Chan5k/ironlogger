import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { appPath } from '../constants/routes.js';

export default function Login() {
  const { setToken, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
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
      navigate(appPath(), { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  if (!loading && isAuthenticated) {
    return <Navigate to={appPath()} replace />;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <Link
        to="/"
        className="mb-6 text-sm text-slate-500 transition-colors hover:text-slate-300"
      >
        ← Back to home
      </Link>
      <h1 className="mb-1 text-2xl font-bold text-white">Welcome back</h1>
      <p className="mb-8 text-sm text-slate-400">Sign in to track your training</p>
      <form onSubmit={onSubmit} className="space-y-4">
        {error ? (
          <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">{error}</p>
        ) : null}
        <div>
          <label className="mb-1 block text-xs text-slate-400">Email</label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-surface-card px-4 py-3 text-white outline-none focus:border-accent"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Password</label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-surface-card px-4 py-3 text-white outline-none focus:border-accent"
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
      <p className="mt-6 text-center text-sm text-slate-500">
        No account?{' '}
        <Link to="/register" className="text-accent-muted hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
