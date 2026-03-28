import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client.js';
import BodyMuscleMap from '../components/BodyMuscleMap.jsx';
import { useWeightUnit } from '../hooks/useWeightUnit.js';
import { LBS_PER_KG } from '../utils/weightUnits.js';

const RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: 'All time', days: null },
];

const MAP_KEYS = ['chest', 'shoulders', 'arms', 'core', 'legs', 'back'];

const LABELS = {
  chest: 'Chest',
  shoulders: 'Shoulders',
  arms: 'Arms',
  back: 'Back',
  legs: 'Legs',
  cardio: 'Cardio',
  core: 'Core',
  other: 'Other',
};

export default function Statistics() {
  const weightUnit = useWeightUnit();
  const [rangeDays, setRangeDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const q = rangeDays == null ? '' : `?days=${rangeDays}`;
      const { data: res } = await api.get(`/workouts/stats/muscles${q}`);
      setData(res);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not load statistics.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [rangeDays]);

  useEffect(() => {
    load();
  }, [load]);

  const { intensityByCategory, tableRows, extraRows } = useMemo(() => {
    if (!data?.categories) {
      return {
        intensityByCategory: {},
        tableRows: [],
        extraRows: [],
      };
    }
    const cats = data.categories;
    const vols = MAP_KEYS.map((k) => {
      const v = cats[k]?.volume ?? 0;
      return weightUnit === 'kg' ? v : v * LBS_PER_KG;
    });
    const max = Math.max(1, ...vols);
    const intensityByCategory = Object.fromEntries(
      MAP_KEYS.map((k) => {
        const raw = cats[k]?.volume ?? 0;
        const v = weightUnit === 'kg' ? raw : raw * LBS_PER_KG;
        return [k, v / max];
      })
    );

    const order = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio', 'other'];
    const tableRows = order.map((key) => {
      const row = cats[key];
      if (!row) return null;
      const vol = weightUnit === 'kg' ? row.volume : Math.round(row.volume * LBS_PER_KG);
      return {
        key,
        label: LABELS[key] || key,
        volume: vol,
        sets: row.sets,
        sessions: row.sessions,
      };
    }).filter(Boolean);

    const extraRows = tableRows.filter((r) => !MAP_KEYS.includes(r.key));
    return { intensityByCategory, tableRows, extraRows };
  }, [data, weightUnit]);

  const fmtVol = (v) =>
    `${typeof v === 'number' ? Math.round(v).toLocaleString() : v} ${weightUnit}×reps`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Statistics</h1>
        <p className="text-sm text-slate-400">
          Muscle-group load from completed workouts. Warm-up sets are excluded; coloring is relative
          to your strongest mapped group in the selected period.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {RANGES.map(({ label, days }) => (
          <button
            key={label}
            type="button"
            onClick={() => setRangeDays(days)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              rangeDays === days
                ? 'bg-surface-elevated text-white ring-1 ring-slate-600/60'
                : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : error ? (
        <p className="text-red-400">{error}</p>
      ) : (
        <>
          {data?.window?.from ? (
            <p className="text-xs text-slate-500">
              From {new Date(data.window.from).toLocaleDateString()} —{' '}
              {new Date(data.window.to).toLocaleDateString()}
            </p>
          ) : (
            <p className="text-xs text-slate-500">All logged history</p>
          )}

          <div className="rounded-2xl border border-slate-800 bg-surface-card p-4 md:p-6">
            <BodyMuscleMap intensity={intensityByCategory} />
            <div className="mx-auto mt-4 flex max-w-xs items-center justify-center gap-2 text-[10px] text-slate-500">
              <span className="h-2 w-6 rounded bg-[#1e293b]" />
              <span>Less</span>
              <span className="h-2 flex-1 rounded bg-gradient-to-r from-[#1e293b] to-[#3b82f6]" />
              <span>More</span>
              <span className="h-2 w-6 rounded bg-[#3b82f6]" />
            </div>
          </div>

          {extraRows.some((r) => r.volume > 0 || r.sets > 0) ? (
            <p className="text-xs text-slate-500">
              Cardio and “other” are not drawn on the body map; totals are in the table.
            </p>
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-surface-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-500">
                  <th className="px-4 py-3 font-medium">Group</th>
                  <th className="px-4 py-3 font-medium">Sessions</th>
                  <th className="px-4 py-3 font-medium">Sets</th>
                  <th className="px-4 py-3 font-medium">Volume</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-slate-800/80 last:border-0 text-slate-300"
                  >
                    <td className="px-4 py-3 text-white">{row.label}</td>
                    <td className="px-4 py-3">{row.sessions}</td>
                    <td className="px-4 py-3">{row.sets}</td>
                    <td className="px-4 py-3 text-slate-400">{fmtVol(row.volume)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
