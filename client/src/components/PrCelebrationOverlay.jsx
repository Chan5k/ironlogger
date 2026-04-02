import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import ExerciseIcon from './ExerciseIcon.jsx';

/** Haptic-only — Web Audio fanfare was pausing background music on phones. */
export function playPrFanfare() {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([35, 45, 55, 45, 90]);
    }
  } catch {
    /* ignore */
  }
}

const SPARKS = [
  { left: '12%', top: '18%', delay: '380ms' },
  { left: '78%', top: '22%', delay: '460ms' },
  { left: '88%', top: '55%', delay: '520ms' },
  { left: '8%', top: '62%', delay: '440ms' },
  { left: '50%', top: '10%', delay: '500ms' },
  { left: '22%', top: '78%', delay: '560ms' },
  { left: '70%', top: '72%', delay: '420ms' },
];

const DISMISS_MS = 5200;

/**
 * Viewport-centered celebration portal when user hits a PR.
 * Uses position:fixed + inset-0 on the overlay AND margin:auto on the card
 * so it's always dead-center regardless of scroll position.
 */
export default function PrCelebrationOverlay({
  open,
  exerciseName,
  exerciseCategory = 'other',
  weight,
  reps,
  weightUnit,
  headline,
  onDismiss,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const id = window.setTimeout(() => onDismiss(), DISMISS_MS);
    return () => {
      document.body.style.overflow = prev;
      window.clearTimeout(id);
    };
  }, [open, onDismiss]);

  if (!open) return null;

  const node = (
    <div
      className="fixed inset-0 z-[10050] flex min-h-[100dvh] items-center justify-center p-4"
      style={{ top: 0, left: 0, right: 0, bottom: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pr-celebration-title"
      onClick={onDismiss}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDismiss();
      }}
    >
      <div
        className="animate-pr-backdrop pointer-events-none fixed inset-0 z-0 bg-surface/85 backdrop-blur-lg"
        style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        aria-hidden
      />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        {SPARKS.map((p, i) => (
          <span
            key={i}
            className="pointer-events-none absolute h-3 w-3 animate-pr-spark rounded-full bg-accent-muted shadow-[0_0_14px_rgba(37,99,235,0.7)]"
            style={{ left: p.left, top: p.top, animationDelay: p.delay }}
          />
        ))}

        <div
          className="animate-pr-card-in w-full cursor-default rounded-3xl border border-slate-200/80 dark:border-slate-700/80 bg-surface-card p-8 text-center shadow-[0_0_60px_rgba(37,99,235,0.12),0_25px_50px_-12px_rgba(0,0,0,0.5)] ring-1 ring-slate-600/40 [animation-delay:140ms]"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="animate-pr-reveal-line mb-1 text-xs font-semibold uppercase tracking-[0.25em] text-accent-muted [animation-delay:420ms]">
            Personal record
          </p>
          <h2
            id="pr-celebration-title"
            className="animate-pr-reveal-line mb-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl [animation-delay:560ms]"
          >
            New PR!
          </h2>
          <div className="animate-pr-reveal-line mb-1 flex flex-col items-center gap-3 [animation-delay:700ms]">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 ring-1 ring-accent/30">
              <ExerciseIcon
                name={exerciseName || 'Lift'}
                category={exerciseCategory}
                className="h-9 w-9 text-accent-muted"
                strokeWidth={1.65}
              />
            </div>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">{exerciseName || 'Lift'}</p>
          </div>
          {headline ? (
            <p className="animate-pr-reveal-line mx-auto max-w-[280px] text-sm font-medium leading-snug text-slate-300 [animation-delay:760ms]">
              {headline}
            </p>
          ) : null}
          <p className="animate-pr-reveal-line mt-3 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white [animation-delay:820ms]">
            {weight} {weightUnit}
            {typeof reps === 'number' && reps > 0 ? (
              <span className="text-slate-400"> · {reps} reps</span>
            ) : null}
          </p>
          <p className="animate-pr-reveal-line mt-6 text-xs text-slate-500 [animation-delay:1000ms]">
            Tap anywhere to close
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
