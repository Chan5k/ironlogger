import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { appPath } from '../constants/routes.js';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState('working');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('This link is missing the verification token. Use the link from your email or request a new one in Settings.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await api.post('/auth/verify-email', { token });
        if (cancelled) return;
        await refreshUser();
        setStatus('ok');
        setMessage('Your email is verified. You can use imports, nutrition, social features, and season ranks.');
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setMessage(
          e.response?.data?.error ||
            'This link is invalid or has expired. Sign in and resend verification from Settings.'
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, refreshUser]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8 motion-reduce:animate-none animate-ui-page-in">
      <h1 className="mb-2 text-2xl font-bold text-white">Email verification</h1>
      {status === 'working' ? (
        <p className="text-sm text-slate-400">Confirming your address…</p>
      ) : (
        <p
          className={`text-sm ${status === 'ok' ? 'text-emerald-300' : 'text-amber-200'}`}
          role="status"
        >
          {message}
        </p>
      )}
      <Link
        to={appPath()}
        className="mt-8 inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white"
      >
        {status === 'ok' ? 'Continue to app' : 'Back to app'}
      </Link>
      {status === 'error' ? (
        <Link to={appPath('settings')} className="mt-3 text-center text-sm text-accent-muted hover:underline">
          Open Settings to resend email
        </Link>
      ) : null}
    </div>
  );
}
