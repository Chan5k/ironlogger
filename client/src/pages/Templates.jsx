import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { appPath } from '../constants/routes.js';
import { sharePageUrl } from '../utils/shareLink.js';
import { offerShareLink } from '../utils/offerShareLink.js';
import { appAlert, appConfirm } from '../lib/appDialogApi.js';

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const navigate = useNavigate();

  async function load() {
    const { data } = await api.get('/templates');
    setTemplates(data.templates || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function startFromTemplate(t) {
    try {
      const { data } = await api.post(`/workouts/from-template/${t._id}`, {
        title: t.name,
      });
      navigate(appPath(`workouts/${data.workout._id}`));
    } catch (e) {
      await appAlert(e.response?.data?.error || 'Could not start workout');
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Workout plans</h1>
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
            className="rounded-xl border border-slate-800 bg-surface-card p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-white">{t.name}</p>
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
                  onClick={() => startFromTemplate(t)}
                  className="min-h-12 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 sm:min-h-11 sm:px-5"
                >
                  Start workout
                </button>
                <Link
                  to={appPath(`templates/${t._id}`)}
                  className="flex min-h-12 items-center justify-center rounded-xl border border-slate-600 bg-surface/50 px-4 py-3 text-center text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:bg-surface-elevated/80 sm:min-h-11 sm:px-5"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => sharePlan(t._id)}
                  className="min-h-12 rounded-xl border border-slate-600 bg-surface/50 px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:bg-surface-elevated/80 sm:min-h-11 sm:px-5"
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
