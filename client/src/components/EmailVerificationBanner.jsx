import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { appPath } from '../constants/routes.js';

export default function EmailVerificationBanner() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  if (!user || user.isStaff || user.emailVerified) return null;

  async function resend() {
    setNote('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/resend-verification');
      if (data?.alreadyVerified) {
        setNote('Already verified — refresh the page.');
      } else {
        setNote('Another email is on its way. Check spam folders too.');
      }
    } catch (e) {
      setNote(e.response?.data?.error || 'Could not send email. Try again later.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-amber-800/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start gap-2">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/90" strokeWidth={2} aria-hidden />
          <p className="min-w-0 leading-snug">
            <span className="font-medium text-amber-50">Verify your email</span> to use Hevy import, nutrition,
            social features, and season ranks. We sent a link to <span className="font-mono text-amber-200/90">{user.email}</span>.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={resend}
            className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-50 ring-1 ring-amber-500/35 hover:bg-amber-500/30 disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Resend email'}
          </button>
          <Link
            to={appPath('settings')}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-amber-200/90 underline decoration-amber-600/80 underline-offset-2 hover:text-slate-900 dark:hover:text-white"
          >
            Settings
          </Link>
        </div>
      </div>
      {note ? <p className="mx-auto mt-2 max-w-3xl text-xs text-amber-200/80">{note}</p> : null}
    </div>
  );
}
