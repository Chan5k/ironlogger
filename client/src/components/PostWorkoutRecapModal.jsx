import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';
import api from '../api/client.js';
import WorkoutAiReviewBody from './WorkoutAiReviewBody.jsx';

export default function PostWorkoutRecapModal({ open, workoutId, onClose }) {
  const [step, setStep] = useState('offer');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) {
      setStep('offer');
      setData(null);
      setErr('');
    }
  }, [open]);

  if (!open || !workoutId) return null;

  async function runReview() {
    setStep('loading');
    setErr('');
    try {
      const { data: res } = await api.post('/ai/review-workout', { workoutId });
      setData(res);
      setStep('result');
    } catch (e) {
      setErr(e.response?.data?.error || 'Could not generate recap. Try again from the workout page.');
      setStep('error');
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[280] flex min-h-[100dvh] items-center justify-center overflow-y-auto overflow-x-hidden p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-workout-recap-title"
    >
      {/* backdrop */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close"
        className="animate-ui-backdrop-in fixed inset-0 bg-black/70 backdrop-blur-[2px] motion-reduce:animate-none"
        onClick={onClose}
      />

      {/* modal card */}
      <div
        className="animate-ui-modal-in relative z-10 my-auto w-full max-w-md rounded-2xl border border-violet-800/40 bg-[#121826] p-5 shadow-2xl shadow-violet-950/40 ring-1 ring-violet-500/15 motion-reduce:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── offer ── */}
        {step === 'offer' ? (
          <div className="animate-ai-stagger-in">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600/20 ring-1 ring-violet-500/30 motion-safe:animate-pulse">
              <Sparkles className="h-6 w-6 text-violet-300" strokeWidth={1.5} aria-hidden />
            </div>
            <h2 id="post-workout-recap-title" className="text-center text-base font-semibold text-white">
              Nice work — session logged
            </h2>
            <p className="mt-1.5 text-center text-[13px] leading-snug text-slate-400">
              Want a quick AI recap? We&apos;ll compare this workout to your recent training and share what went well, what to sharpen, and how.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={runReview}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-600/20 active:scale-[0.97] active:bg-violet-700"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                Yes, show recap
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-700 px-5 py-2 text-sm font-medium text-slate-400 transition-all hover:border-slate-600 hover:bg-slate-800/60 hover:text-slate-200 active:scale-[0.97]"
              >
                Not now
              </button>
            </div>
          </div>
        ) : null}

        {/* ── loading ── */}
        {step === 'loading' ? (
          <div className="animate-ai-stagger-in flex flex-col items-center py-5">
            <span
              className="inline-block h-9 w-9 animate-spin rounded-full border-2 border-slate-700 border-t-violet-400"
              aria-hidden
            />
            <p className="mt-3 text-center text-sm text-slate-300">Analyzing your session…</p>
            <p className="mt-0.5 text-center text-[11px] text-slate-500 animate-ai-spinner-pulse">Comparing to recent workouts</p>
          </div>
        ) : null}

        {/* ── result ── */}
        {step === 'result' && data ? (
          <div className="animate-ai-stagger-in max-h-[min(72vh,30rem)] overflow-y-auto overscroll-contain pr-1">
            <WorkoutAiReviewBody data={data} defaultExpanded />
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-xl border border-slate-700 py-2 text-sm font-medium text-slate-300 transition-all hover:border-slate-600 hover:bg-slate-800/50 hover:text-white active:scale-[0.98]"
            >
              Done
            </button>
          </div>
        ) : null}

        {/* ── error ── */}
        {step === 'error' ? (
          <div className="animate-ai-stagger-in">
            <p className="text-sm text-red-400">{err}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={runReview}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-violet-500 active:scale-[0.97]"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-400 transition-all hover:bg-slate-800/50 hover:text-slate-200 active:scale-[0.97]"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
