import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { appPath } from '../constants/routes.js';
import { sharePageUrl } from '../utils/shareLink.js';
import { offerShareLink } from '../utils/offerShareLink.js';
import { appAlert, appConfirm } from '../lib/appDialogApi.js';

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [creating, setCreating] = useState(null);
  const [createProgress, setCreateProgress] = useState(0);
  const progressIntervalRef = useRef(null);
  const navigate = useNavigate();

  async function load() {
    const { data } = await api.get('/templates');
    setTemplates(data.templates || []);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!creating) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      return;
    }
    setCreateProgress(0);
    progressIntervalRef.current = window.setInterval(() => {
      setCreateProgress((p) => (p >= 88 ? p : Math.min(p + 6 + Math.random() * 10, 88)));
    }, 130);
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [creating]);

  async function startFromTemplate(t) {
    if (creating) return;
    setCreating({ name: t.name, id: t._id });
    try {
      const { data } = await api.post(`/workouts/from-template/${t._id}`, {
        title: t.name,
      });
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setCreateProgress(100);
      await new Promise((r) => setTimeout(r, 320));
      navigate(appPath(`workouts/${data.workout._id}`));
    } catch (e) {
      await appAlert(e.response?.data?.error || 'Could not start workout');
    } finally {
      setCreating(null);
      setCreateProgress(0);
    }
  }

  async function remove(id) {
    if (!(await appConfirm('Delete this plan?'))) return;
    await api.delete(`/templates/${id}`);
    load();
  }

  async function sharePlan(id) {
    try {
      const { data } = await api.post(`/share/templates/${id}`);
      const url = sharePageUrl(data.token);
      await offerShareLink(url, {
        shareTitle: 'Workout plan',
        successMessage: 'Share link copied to clipboard.',
      });
    } catch (e) {
      await appAlert(e.response?.data?.error || 'Could not create share link');
    }
  }

  return (
    <div className="space-y-4">
      {creating
        ? createPortal(
            <div
              className="fixed inset-0 z-[320] flex min-h-[100dvh] items-center justify-center overflow-y-auto p-4"
              role="alertdialog"
              aria-busy="true"
              aria-live="polite"
              aria-label="Creating workout"
            >
              <div className="fixed inset-0 bg-slate-900/70 dark:bg-black/70 backdrop-blur-sm motion-reduce:backdrop-blur-none" />
              <div className="animate-ui-modal-in relative z-10 w-full max-w-sm rounded-2xl border border-slate-300 dark:border-slate-700 bg-surface-card p-6 shadow-2xl ring-1 ring-white/5 motion-reduce:animate-none motion-reduce:opacity-100 motion-reduce:transform-none">
                <div className="mb-1 flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60 opacity-75 motion-reduce:animate-none" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </span>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Creating workout</h2>
                </div>
                <p className="mt-2 text-sm text-slate-400">Building your session from &quot;{creating.name}&quot;…</p>
                <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-accent to-emerald-500 transition-[width] duration-300 ease-out motion-reduce:transition-none"
                    style={{ width: `${createProgress}%` }}
                  />
                </div>
                <p className="mt-3 text-center text-xs text-slate-500">
                  {createProgress >= 100 ? 'Opening editor…' : 'Preparing exercises and sets…'}
                </p>
              </div>
            </div>,
            document.body
          )
        : null}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Workout plans</h1>
          <p className="text-sm text-slate-400">Templates to start sessions quickly</p>
        </div>
        <Link
          to={appPath('templates/new')}
          className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          + New plan
        </Link>
      </div>

      <ul className="space-y-2">
        {templates.map((t) => (
          <li
            key={t._id}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-surface-card p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{t.name}</p>
                {t.description ? (
                  <p className="text-sm text-slate-400">{t.description}</p>
                ) : null}
                <p className="mt-1 text-xs text-slate-500">
                  {t.items?.length || 0} exercises
                </p>
              </div>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
                <button
                  type="button"
                  disabled={!!creating}
                  onClick={() => startFromTemplate(t)}
                  className="min-h-12 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-11 sm:px-5"
                >
                  {creating?.id === t._id ? 'Starting…' : 'Start workout'}
                </button>
                <Link
                  to={appPath(`templates/${t._id}`)}
                  className="flex min-h-12 items-center justify-center rounded-xl border border-slate-300 dark:border-slate-600 bg-surface/50 px-4 py-3 text-center text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:bg-surface-elevated/80 sm:min-h-11 sm:px-5"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => sharePlan(t._id)}
                  className="min-h-12 rounded-xl border border-slate-300 dark:border-slate-600 bg-surface/50 px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:bg-surface-elevated/80 sm:min-h-11 sm:px-5"
                >
                  Share
                </button>
                <button
                  type="button"
                  onClick={() => remove(t._id)}
                  className="min-h-12 rounded-xl border border-red-900/60 bg-red-950/20 px-4 py-3 text-sm font-semibold text-red-300 transition-colors hover:bg-red-950/35 sm:min-h-11 sm:px-5"
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {templates.length === 0 ? (
        <p className="text-center text-slate-500">No plans yet. Create one from the library.</p>
      ) : null}
    </div>
  );
}
