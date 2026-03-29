import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { drawWorkoutShareCard } from '../utils/drawWorkoutShareCard.js';

export default function WorkoutShareModal({ open, onClose, cardOptions }) {
  const canvasRef = useRef(null);
  const [err, setErr] = useState('');

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cardOptions) return;
    try {
      drawWorkoutShareCard(canvas, cardOptions);
      setErr('');
    } catch (e) {
      setErr('Could not render image.');
    }
  }, [cardOptions]);

  useEffect(() => {
    if (!open) return;
    redraw();
  }, [open, redraw]);

  async function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'ironlog-workout.png';
    a.click();
  }

  async function nativeShare() {
    const canvas = canvasRef.current;
    if (!canvas || !navigator.share) return;
    await new Promise((resolve, reject) => {
      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            reject(new Error('no blob'));
            return;
          }
          const file = new File([blob], 'ironlog-workout.png', { type: 'image/png' });
          try {
            await navigator.share({
              files: [file],
              title: 'Workout',
              text: `${cardOptions?.workoutTitle || 'Workout'} on IronLog`,
            });
            resolve();
          } catch (e) {
            if (e?.name === 'AbortError') resolve();
            else reject(e);
          }
        },
        'image/png',
        0.95
      );
    });
  }

  if (!open) return null;

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-black/70 motion-reduce:animate-none animate-ui-backdrop-in"
        aria-hidden
      />
      <div
        className="relative z-10 flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0f141d] shadow-xl motion-reduce:animate-none animate-ui-modal-in"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        aria-modal="true"
        aria-label="Share workout image"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <p className="text-sm font-semibold text-white">Share workout</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="mb-3 text-xs text-slate-500">
            Optimized for Instagram stories (9:16). Save or use your device share sheet.
          </p>
          {err ? <p className="mb-2 text-sm text-rose-400">{err}</p> : null}
          <div className="mx-auto flex max-h-[55vh] justify-center overflow-hidden rounded-xl border border-slate-800 bg-black">
            <canvas ref={canvasRef} className="max-h-[55vh] w-auto max-w-full object-contain" />
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-slate-800 p-4 sm:flex-row">
          <button
            type="button"
            onClick={() => downloadPng()}
            className="h-11 flex-1 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Download PNG
          </button>
          {canNativeShare ? (
            <button
              type="button"
              onClick={() => nativeShare().catch(() => {})}
              className="h-11 flex-1 rounded-xl border border-slate-600 px-4 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Share…
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
