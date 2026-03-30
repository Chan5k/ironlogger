import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Dumbbell } from 'lucide-react';
import { appPath } from '../constants/routes.js';
import { getResumeableNewWorkoutDraftPreview } from '../utils/workoutDraftStorage.js';

/**
 * Shown on Dashboard / Workouts when an unsaved new workout exists for this tab.
 * Must use a plain <Link> — not NewWorkoutLink — so the draft session is not reset.
 */
export default function ResumeNewWorkoutCallout({ className = '' }) {
  const { pathname } = useLocation();
  const preview = useMemo(() => getResumeableNewWorkoutDraftPreview(), [pathname]);

  if (!preview) return null;

  let updatedLabel = '';
  if (preview.updatedAt) {
    try {
      updatedLabel = new Date(preview.updatedAt).toLocaleString(undefined, {
        dateStyle: 'short',
        timeStyle: 'short',
      });
    } catch {
      /* ignore */
    }
  }

  return (
    <aside
      className={`rounded-2xl border border-amber-500/35 bg-amber-950/30 p-4 ring-1 ring-amber-500/15 ${className}`}
      aria-label="Unsaved workout draft"
    >
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-200">
          <Dumbbell className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-100">Workout in progress</p>
          <p className="mt-0.5 text-xs text-slate-400">
            Not saved yet — it won&apos;t appear in your list until you tap{' '}
            <span className="text-slate-300">Save workout</span>.
          </p>
          <p className="mt-2 truncate text-sm text-white">
            {preview.title}
            <span className="text-slate-500">
              {' '}
              · {preview.exerciseCount} exercise{preview.exerciseCount !== 1 ? 's' : ''}
              {updatedLabel ? ` · ${updatedLabel}` : ''}
            </span>
          </p>
          <Link
            to={appPath('workouts/new')}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Continue workout
          </Link>
        </div>
      </div>
    </aside>
  );
}
