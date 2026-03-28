import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { appPath } from '../constants/routes.js';

export default function Register() {
  const { setToken, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Username is required');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post('/auth/register', { email, password, name: name.trim() });
      setToken(data.token, data.user);
      navigate(appPath(), { replace: true });
    } catch (err) {
      const d = err.response?.data;
      const fromValidator = Array.isArray(d?.errors)
        ? d.errors.map((e) => e.msg || e.message).filter(Boolean).join(' ')
        : '';
      setError(fromValidator || d?.error || 'Registration failed');
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
      <h1 className="mb-1 text-2xl font-bold text-white">Create account</h1>
      <p className="mb-8 text-sm text-slate-400">Start logging workouts on any device</p>
      <form onSubmit={onSubmit} className="space-y-4">
        {error ? (
          <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">{error}</p>
        ) : null}
        <div>
          <label className="mb-1 block text-xs text-slate-400">Username</label>
          <input
            type="text"
            autoComplete="username"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-surface-card px-4 py-3 text-white outline-none focus:border-accent"
            required
            minLength={1}
            maxLength={120}
          />
        </div>
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
          <label className="mb-1 block text-xs text-slate-400">Password (min 8)</label>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-surface-card px-4 py-3 text-white outline-none focus:border-accent"
            required
            minLength={8}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Sign up'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="text-accent-muted hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
