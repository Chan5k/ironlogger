import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import api from '../api/client.js';
import { useWeightUnit } from '../hooks/useWeightUnit.js';
import { kgToLbs, LBS_PER_KG } from '../utils/weightUnits.js';

function fmtShort(d) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Progress() {
  const weightUnit = useWeightUnit();
  const [exercises, setExercises] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await api.get('/exercises');
      setExercises(data.exercises || []);
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setPoints([]);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/workouts/progress/${selectedId}`);
        if (!alive) return;
        setPoints(
          (data.points || []).map((p) => ({
            ...p,
            label: fmtShort(p.date),
          }))
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedId]);

  const chartPoints = useMemo(() => {
    if (weightUnit === 'kg') return points;
    return points.map((p) => ({
      ...p,
      maxWeight: kgToLbs(p.maxWeight),
      volume: p.volume * LBS_PER_KG,
    }));
  }, [points, weightUnit]);

  const selected = exercises.find((e) => e._id === selectedId);

  const fmtWt = (v) =>
    `${typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(1)) : v} ${weightUnit}`;
  const fmtVol = (v) =>
    `${typeof v === 'number' ? Math.round(v).toLocaleString() : v} ${weightUnit}×reps`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Progress</h1>
        <p className="text-sm text-slate-400">
          Completed workouts only. Max weight, reps, and volume ignore warm-up sets; normal and
          failure sets count.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-500">Exercise</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-surface-card px-4 py-3 text-white"
        >
          <option value="">Select…</option>
          {exercises.map((e) => (
            <option key={e._id} value={e._id}>
              {e.name} ({e.category})
            </option>
          ))}
        </select>
      </div>

      {selected ? (
        <p className="text-sm text-slate-400">
          Tracking <span className="text-white">{selected.name}</span>
        </p>
      ) : null}

      {loading ? (
        <p className="text-slate-500">Loading chart…</p>
      ) : points.length === 0 && selectedId ? (
        <p className="text-slate-500">No completed sessions with this exercise yet.</p>
      ) : points.length === 0 ? (
        <p className="text-slate-500">Choose an exercise to see charts.</p>
      ) : (
        <div className="space-y-8">
          <div className="h-64 w-full rounded-2xl border border-slate-800 bg-surface-card p-2">
            <p className="mb-2 px-2 text-xs font-medium text-slate-400">
              Max weight ({weightUnit})
            </p>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={chartPoints} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
                  labelStyle={{ color: '#e2e8f0' }}
                  formatter={(value) => [fmtWt(value), `Weight (${weightUnit})`]}
                />
                <Legend />
                <Line type="monotone" dataKey="maxWeight" name={`Weight (${weightUnit})`} stroke="#60a5fa" dot />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="h-64 w-full rounded-2xl border border-slate-800 bg-surface-card p-2">
            <p className="mb-2 px-2 text-xs font-medium text-slate-400">Total reps (session)</p>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={chartPoints} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Legend />
                <Line type="monotone" dataKey="totalReps" name="Reps" stroke="#34d399" dot />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="h-64 w-full rounded-2xl border border-slate-800 bg-surface-card p-2">
            <p className="mb-2 px-2 text-xs font-medium text-slate-400">
              Volume ({weightUnit} × reps)
            </p>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={chartPoints} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
                  labelStyle={{ color: '#e2e8f0' }}
                  formatter={(value) => [fmtVol(value), 'Volume']}
                />
                <Legend />
                <Line type="monotone" dataKey="volume" name={`Volume (${weightUnit}×reps)`} stroke="#f472b6" dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
