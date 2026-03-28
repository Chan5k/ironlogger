import { useEffect } from 'react';

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
 * Full-screen celebration when user hits a weight PR.
 * Backdrop fades in first; card springs in after a short beat; copy staggers in.
 */
export default function PrCelebrationOverlay({ open, exerciseName, weight, weightUnit, onDismiss }) {
  useEffect(() => {
    if (!open) return undefined;
    const id = window.setTimeout(() => {
      onDismiss();
    }, DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [open, onDismiss]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pr-celebration-title"
      onClick={onDismiss}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDismiss();
      }}
    >
      {/* Fade in alone so the modal does not pop at full opacity */}
      <div
        className="animate-pr-backdrop pointer-events-none absolute inset-0 bg-black/72 backdrop-blur-md"
        aria-hidden
      />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        {SPARKS.map((p, i) => (
          <span
            key={i}
            className="pointer-events-none absolute h-3 w-3 animate-pr-spark rounded-full bg-amber-300/90 shadow-[0_0_12px_rgba(251,191,36,0.9)]"
            style={{ left: p.left, top: p.top, animationDelay: p.delay }}
          />
        ))}

        <div
          className="animate-pr-card-in w-full cursor-default rounded-3xl border border-amber-400/40 bg-gradient-to-br from-amber-950/95 via-slate-900/98 to-slate-950 p-8 text-center shadow-[0_0_40px_rgba(251,191,36,0.2),0_25px_50px_-12px_rgba(0,0,0,0.6)] ring-1 ring-amber-500/35 [animation-delay:140ms]"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="animate-pr-reveal-line mb-1 text-xs font-semibold uppercase tracking-[0.25em] text-amber-400/90 [animation-delay:420ms]">
            Personal record
          </p>
          <h2
            id="pr-celebration-title"
            className="animate-pr-reveal-line mb-2 bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl [animation-delay:560ms]"
          >
            New PR!
          </h2>
          <p className="animate-pr-reveal-line mb-1 text-lg font-semibold text-white [animation-delay:700ms]">
            {exerciseName || 'Lift'}
          </p>
          <p className="animate-pr-reveal-line font-mono text-2xl font-bold text-amber-200 tabular-nums [animation-delay:820ms]">
            {weight} {weightUnit}
          </p>
          <p className="animate-pr-reveal-line mt-6 text-xs text-slate-500 [animation-delay:1000ms]">
            Tap anywhere to close
          </p>
        </div>
      </div>
    </div>
  );
}
