import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { appPath } from '../constants/routes.js';

/**
 * Shared invite URL: /add/:slug — signs the visitor in (if needed) and follows the public profile.
 */
export default function AddFriendInvite() {
  const { slug: slugParam } = useParams();
  const slug = (slugParam || '').trim().toLowerCase();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [phase, setPhase] = useState('pending'); // pending | missing | own | error
  const [errorDetail, setErrorDetail] = useState('');

  useEffect(() => {
    if (authLoading || !isAuthenticated || !slug) return undefined;

    let cancelled = false;

    (async () => {
      setPhase('pending');
      setErrorDetail('');
      const enc = encodeURIComponent(slug);
      try {
        const { data: st } = await api.get(`/social/profile/${enc}/status`);
        if (cancelled) return;
        if (st.isOwnProfile) {
          setPhase('own');
          return;
        }
        const followRes = await api.post(`/social/follow/${enc}`, { reciprocal: true });
        if (cancelled) return;
        const already = !!followRes.data?.already;
        navigate(`/u/${enc}`, {
          replace: true,
          state: already ? { addFriendAlready: true } : { addFriendDone: true },
        });
      } catch (e) {
        if (cancelled) return;
        const status = e?.response?.status;
        if (status === 404) {
          setPhase('missing');
          return;
        }
        setPhase('error');
        setErrorDetail(e?.response?.data?.error || e?.message || 'Something went wrong');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, isAuthenticated, authLoading, navigate]);

  if (!slug) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8 text-white">
        <p className="text-slate-300">This invite link is not valid.</p>
        <Link to="/" className="mt-4 text-sm text-accent-muted hover:text-accent">
          ← Home
        </Link>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">Loading…</div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (phase === 'own') {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8 text-white">
        <h1 className="text-xl font-bold text-white">Your invite link</h1>
        <p className="mt-3 text-sm text-slate-400">
          Share this URL with others so they can follow you on IronLog. You can&apos;t add yourself
          as a friend.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            to={`/u/${encodeURIComponent(slug)}`}
            className="rounded-xl bg-accent px-4 py-3 text-center text-sm font-semibold text-white"
          >
            View your public profile
          </Link>
          <Link
            to={appPath('settings')}
            className="rounded-xl border border-slate-600 px-4 py-3 text-center text-sm text-slate-200"
          >
            Settings
          </Link>
        </div>
      </div>
    );
  }

  if (phase === 'missing') {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8 text-white">
        <h1 className="text-xl font-bold text-white">Link not available</h1>
        <p className="mt-3 text-sm text-slate-400">
          This profile is missing or not public anymore, so we can&apos;t add them from this link.
        </p>
        <Link to={appPath()} className="mt-6 text-sm font-medium text-accent-muted hover:text-accent">
          Open app
        </Link>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8 text-white">
        <h1 className="text-xl font-bold text-white">Couldn&apos;t complete invite</h1>
        <p className="mt-3 text-sm text-red-300/90">{errorDetail}</p>
        <Link
          to={`/u/${encodeURIComponent(slug)}`}
          className="mt-6 text-sm font-medium text-accent-muted hover:text-accent"
        >
          Open profile
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-slate-300">
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-slate-600 border-t-accent"
        aria-hidden
      />
      <p className="text-sm">Adding friend…</p>
    </div>
  );
}
