import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { appPath } from '../constants/routes.js';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}

export default function AdminUsers() {
  const [inputQ, setInputQ] = useState('');
  const [filterQ, setFilterQ] = useState('');
  const [skip, setSkip] = useState(0);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const limit = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const params = new URLSearchParams({ limit: String(limit), skip: String(skip) });
      if (filterQ.trim()) params.set('q', filterQ.trim());
      const { data } = await api.get(`/admin/users?${params}`);
      setUsers(data.users || []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [filterQ, skip]);

  useEffect(() => {
    load();
  }, [load]);

  function search(e) {
    e.preventDefault();
    setFilterQ(inputQ);
    setSkip(0);
  }

  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.floor(skip / limit) + 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Admin</h1>
        <p className="text-sm text-slate-400">Users and account overview</p>
      </div>

      <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="search"
          value={inputQ}
          onChange={(e) => setInputQ(e.target.value)}
          placeholder="Search email or username…"
          className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-surface-card px-4 py-2.5 text-white outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white"
        >
          Search
        </button>
      </form>

      {err ? <p className="text-sm text-red-400">{err}</p> : null}

      {loading ? (
        <p className="text-slate-500">Loading users…</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-surface-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-500">
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">Email</th>
                  <th className="px-3 py-2 font-medium">Stats</th>
                  <th className="hidden px-3 py-2 font-medium md:table-cell">Joined</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id} className="border-b border-slate-800/80 text-slate-300 last:border-0">
                    <td className="px-3 py-2">
                      <span className="font-medium text-white">{u.name || '—'}</span>
                      {u.isAdmin ? (
                        <span className="ml-2 rounded bg-amber-950/60 px-1.5 py-0.5 text-[10px] text-amber-200">
                          admin
                        </span>
                      ) : null}
                      <div className="text-xs text-slate-500 sm:hidden">{u.email}</div>
                    </td>
                    <td className="hidden px-3 py-2 text-slate-400 sm:table-cell">{u.email}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {u.stats?.workouts ?? 0} workouts · {u.stats?.templates ?? 0} plans ·{' '}
                      {u.stats?.activityLogs ?? 0} activity
                    </td>
                    <td className="hidden px-3 py-2 text-xs text-slate-500 md:table-cell">
                      {fmt(u.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to={appPath(`admin/users/${u._id}`)}
                        className="text-accent-muted hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > limit ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
              <span>
                Page {page} of {pages} ({total} users)
              </span>
              <button
                type="button"
                disabled={skip <= 0}
                onClick={() => setSkip((s) => Math.max(0, s - limit))}
                className="rounded-lg border border-slate-600 px-3 py-1 text-white disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={skip + limit >= total}
                onClick={() => setSkip((s) => s + limit)}
                className="rounded-lg border border-slate-600 px-3 py-1 text-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">{total} user(s)</p>
          )}
        </>
      )}
    </div>
  );
}
