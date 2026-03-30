import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const REST_STORAGE_KEY = 'ironlog_rest_seconds';

export function readRestDurationSeconds() {
  try {
    const n = Number(localStorage.getItem(REST_STORAGE_KEY));
    if (Number.isFinite(n) && n >= 10 && n <= 600) return Math.floor(n);
  } catch {
    /* ignore */
  }
  return 90;
}

export function writeRestDurationSeconds(sec) {
  const n = Math.min(600, Math.max(10, Math.floor(Number(sec) || 90)));
  localStorage.setItem(REST_STORAGE_KEY, String(n));
  return n;
}

export default function RestTimerBar({
  secondsLeft,
  totalSeconds,
  onSkip,
  onAddSeconds,
  soundEnabled,
  hapticEnabled = true,
  onBarHeightChange,
}) {
  const prevRef = useRef(secondsLeft);
  const rootRef = useRef(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = secondsLeft;
    if (secondsLeft !== 0 || prev === 0) return;
    if (hapticEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([60, 40, 60]);
      } catch {
        /* iOS may ignore */
      }
    }
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.08, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      o.start(ctx.currentTime);
      o.stop(ctx.currentTime + 0.26);
    } catch {
      /* ignore */
    }
  }, [secondsLeft, soundEnabled, hapticEnabled]);

  useLayoutEffect(() => {
    if (secondsLeft <= 0) {
      onBarHeightChange?.(0);
      return undefined;
    }
    const el = rootRef.current;
    if (!el) return undefined;
    const report = () => onBarHeightChange?.(el.offsetHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => {
      ro.disconnect();
      onBarHeightChange?.(0);
    };
  }, [secondsLeft, onBarHeightChange]);

  if (secondsLeft <= 0) return null;

  const pct = totalSeconds > 0 ? Math.min(100, (secondsLeft / totalSeconds) * 100) : 0;

  return createPortal(
    <div
      ref={rootRef}
      className="fixed bottom-0 left-0 right-0 z-50 safe-pb border-t border-slate-700 bg-surface-card/98 px-4 py-3 shadow-lg backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Rest</p>
          <p className="font-mono text-2xl font-semibold text-white tabular-nums">
            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
          </p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onAddSeconds?.(30)}
            className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200"
          >
            +30s
          </button>
          <button
            type="button"
            onClick={() => onSkip?.()}
            className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white"
          >
            Skip
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
