import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { appPath } from '../constants/routes.js';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const { data: d } = await api.get('/admin/dashboard');
      setData(d);
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to load dashboard');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="text-slate-500">Loading overview…</p>;
  }
  if (err || !data) {
    return <p className="text-sm text-red-400">{err || 'No data'}</p>;
  }

  const cards = [
    { label: 'Total users', value: data.totalUsers },
    { label: 'New users (7 days)', value: data.signupsLast7Days },
    { label: 'New users (30 days)', value: data.signupsLast30Days },
    { label: 'Total workouts', value: data.totalWorkouts },
    { label: 'Total plans (templates)', value: data.totalTemplates },
    { label: 'Activity log rows', value: data.totalActivityLogs },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-slate-800 bg-surface-card px-4 py-4"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          to={appPath('admin/users')}
          className="rounded-xl bg-accent px-4 py-2.5 font-semibold text-white hover:opacity-95"
        >
          Open user directory
        </Link>
        <Link
          to={appPath('admin/audit')}
          className="rounded-xl border border-slate-600 px-4 py-2.5 font-medium text-slate-200 hover:bg-slate-800/40"
        >
          View audit log
        </Link>
      </div>
    </div>
  );
}
