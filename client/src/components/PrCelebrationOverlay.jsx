import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import ExerciseIcon from './ExerciseIcon.jsx';

/** Short ascending fanfare (Web Audio). */
export function playPrFanfare() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const freqs = [392, 523.25, 659.25, 783.99];
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      o.connect(g);
      g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.07;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      o.start(t);
      o.stop(t + 0.42);
    });
    ctx.resume?.();
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
 * Centered full-viewport celebration when user hits a PR (portal — avoids scroll offset from nested layout).
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
    const id = window.setTimeout(() => {
      onDismiss();
    }, DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [open, onDismiss]);

  if (!open) return null;

  const node = (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center overflow-y-auto overflow-x-hidden p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pr-celebration-title"
      onClick={onDismiss}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDismiss();
      }}
    >
      <div
        className="animate-pr-backdrop pointer-events-none fixed inset-0 bg-black/70 backdrop-blur-md"
        aria-hidden
      />

      <div className="relative z-10 my-auto flex w-full max-w-sm flex-col items-center">
        {SPARKS.map((p, i) => (
          <span
            key={i}
            className="pointer-events-none absolute h-3 w-3 animate-pr-spark rounded-full bg-accent-muted/90 shadow-[0_0_14px_rgba(59,130,246,0.85)]"
            style={{ left: p.left, top: p.top, animationDelay: p.delay }}
          />
        ))}

        <div
          className="animate-pr-card-in w-full cursor-default rounded-3xl border border-blue-500/35 bg-gradient-to-br from-surface-card via-[#1a2332] to-surface p-8 text-center shadow-[0_0_36px_rgba(37,99,235,0.18),0_25px_50px_-12px_rgba(0,0,0,0.55)] ring-1 ring-blue-500/25 [animation-delay:140ms]"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="animate-pr-reveal-line mb-1 text-xs font-semibold uppercase tracking-[0.25em] text-accent-muted [animation-delay:420ms]">
            Personal record
          </p>
          <h2
            id="pr-celebration-title"
            className="animate-pr-reveal-line mb-2 text-3xl font-black tracking-tight text-white sm:text-4xl [animation-delay:560ms]"
          >
            New PR!
          </h2>
          <div className="animate-pr-reveal-line mb-1 flex flex-col items-center gap-3 [animation-delay:700ms]">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 ring-1 ring-accent/35">
              <ExerciseIcon
                name={exerciseName || 'Lift'}
                category={exerciseCategory}
                className="h-9 w-9 text-accent-muted"
                strokeWidth={1.65}
              />
            </div>
            <p className="text-lg font-semibold text-white">{exerciseName || 'Lift'}</p>
          </div>
          {headline ? (
            <p className="animate-pr-reveal-line mx-auto max-w-[280px] text-sm font-medium leading-snug text-slate-200 [animation-delay:760ms]">
              {headline}
            </p>
          ) : null}
          <p className="animate-pr-reveal-line mt-3 font-mono text-xl font-bold tabular-nums text-accent-muted [animation-delay:820ms]">
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
