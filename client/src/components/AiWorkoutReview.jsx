import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import api from '../api/client.js';
import WorkoutAiReviewBody from './WorkoutAiReviewBody.jsx';

export default function AiWorkoutReview({ workoutId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [dismissed, setDismissed] = useState(false);

  if (!workoutId || dismissed) return null;

  async function fetchReview() {
    setLoading(true);
    setErr('');
    try {
      const { data: res } = await api.post('/ai/review-workout', { workoutId });
      setData(res);
    } catch (e) {
      setErr(e.response?.data?.error || 'Could not generate review');
    } finally {
      setLoading(false);
    }
  }

  if (!data && !loading && !err) {
    return (
      <button
        type="button"
        onClick={fetchReview}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-700/50 bg-violet-950/25 px-4 py-2.5 text-sm font-medium text-violet-200 transition-all duration-200 hover:bg-violet-950/40 hover:shadow-md hover:shadow-violet-900/20 active:scale-[0.98] disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        AI workout review
      </button>
    );
  }

  if (loading) {
    return (
      <div className="animate-ai-stagger-in flex items-center gap-3 rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-app-panel/95 px-4 py-3">
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 dark:border-slate-600 border-t-violet-400"
          aria-hidden
        />
        <p className="text-sm text-slate-400">Generating AI review…</p>
      </div>
    );
  }

  if (err) {
    return (
      <div className="animate-ai-stagger-in rounded-xl border border-red-900/50 bg-red-950/20 px-4 py-3">
        <p className="text-sm text-red-400">{err}</p>
        <button
          type="button"
          onClick={fetchReview}
          className="mt-2 text-xs text-red-300 underline transition-colors hover:text-red-200 active:scale-[0.97]"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="animate-ai-stagger-in relative rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-app-panel/95 px-4 py-3.5">
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute right-2.5 top-2.5 rounded-md px-1.5 py-0.5 text-xs text-slate-500 transition-all hover:bg-slate-700/50 hover:text-slate-300 active:scale-90"
        aria-label="Dismiss review"
      >
        ✕
      </button>
      <WorkoutAiReviewBody data={data} />
    </div>
  );
}
