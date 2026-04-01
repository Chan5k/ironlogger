import { useCallback, useEffect, useState } from 'react';
import api from '../api/client.js';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}

function actorLabel(e) {
  const a = e.actorId;
  if (!a) return '—';
  if (typeof a === 'object') return a.email || a.name || String(a._id || '');
  return String(a);
}

function targetLabel(e) {
  const t = e.targetUserId;
  if (!t) return '—';
  if (typeof t === 'object') return t.email || t.name || String(t._id || '');
  return String(t);
}

export default function AdminAuditLog() {
  const limit = 40;
  const [skip, setSkip] = useState(0);
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const { data } = await api.get(`/admin/audit-log?limit=${limit}&skip=${skip}`);
      setEntries(data.entries || []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to load audit log');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [skip]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.floor(skip / limit) + 1;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Immutable record of admin actions (deletes, privilege changes, impersonation, notes).
      </p>
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-surface-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Actor</th>
                  <th className="hidden px-3 py-2 font-medium md:table-cell">Target</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e._id} className="border-b border-slate-200/80 dark:border-slate-800/80 text-slate-300 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{fmt(e.createdAt)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-amber-100/90">{e.action}</td>
                    <td className="px-3 py-2 text-xs">{actorLabel(e)}</td>
                    <td className="hidden px-3 py-2 text-xs md:table-cell">{targetLabel(e)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > limit ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
              <span>
                Page {page} of {pages} ({total} entries)
              </span>
              <button
                type="button"
                disabled={skip <= 0}
                onClick={() => setSkip((s) => Math.max(0, s - limit))}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1 text-slate-900 dark:text-white disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={skip + limit >= total}
                onClick={() => setSkip((s) => s + limit)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1 text-slate-900 dark:text-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">{total} entr{total === 1 ? 'y' : 'ies'}</p>
          )}
        </>
      )}
    </div>
  );
}
