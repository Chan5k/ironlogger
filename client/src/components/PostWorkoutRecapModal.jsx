import { createPortal } from 'react-dom';
import { CheckCircle } from 'lucide-react';

export default function PostWorkoutRecapModal({ open, onClose }) {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[280] flex min-h-[100dvh] items-center justify-center overflow-y-auto overflow-x-hidden p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-workout-recap-title"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close"
        className="animate-ui-backdrop-in fixed inset-0 bg-slate-900/70 dark:bg-black/70 backdrop-blur-[2px] motion-reduce:animate-none"
        onClick={onClose}
      />

      <div
        className="animate-ui-modal-in relative z-10 my-auto w-full max-w-md rounded-2xl border border-slate-300 dark:border-slate-700 bg-app-panel p-5 shadow-2xl ring-1 ring-white/5 motion-reduce:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600/15 ring-1 ring-emerald-500/25">
          <CheckCircle className="h-7 w-7 text-emerald-400" strokeWidth={1.75} aria-hidden />
        </div>
        <h2 id="post-workout-recap-title" className="text-center text-base font-semibold text-slate-900 dark:text-white">
          Workout saved
        </h2>
        <p className="mt-1.5 text-center text-[13px] leading-snug text-slate-500 dark:text-slate-400">
          Your session is logged. You can keep editing this workout or close this dialog.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-95 active:scale-[0.98]"
        >
          Done
        </button>
      </div>
    </div>,
    document.body
  );
}
