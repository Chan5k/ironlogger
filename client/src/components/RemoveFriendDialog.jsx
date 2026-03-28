import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { UserMinus } from 'lucide-react';

/**
 * Animated confirmation (portal) — stop following someone from the Following feed.
 * @param {{ userId: string, name: string } | null} friend
 * @param {() => void} onClosed — parent clears `friend` after exit animation
 * @param {() => Promise<void>} onRemove
 * @param {boolean} busy
 * @param {string} [error]
 */
export default function RemoveFriendDialog({ friend, onClosed, onRemove, busy, error }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);
  const cancelRef = useRef(null);

  const dismiss = useCallback(() => {
    setVisible(false);
    clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onClosed();
    }, 260);
  }, [onClosed]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  useEffect(() => {
    if (!friend) {
      setVisible(false);
      return undefined;
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(id);
  }, [friend]);

  useEffect(() => {
    if (!friend) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [friend]);

  useEffect(() => {
    if (!friend) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) dismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [friend, busy, dismiss]);

  useEffect(() => {
    if (friend && visible) cancelRef.current?.focus();
  }, [friend, visible]);

  async function confirm() {
    if (busy) return;
    try {
      await onRemove();
      dismiss();
    } catch {
      /* parent shows error */
    }
  }

  if (!friend) return null;

  const titleId = 'remove-friend-dialog-title';
  const descId = 'remove-friend-dialog-desc';

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6" role="presentation">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        disabled={busy}
        className={`absolute inset-0 bg-black/65 backdrop-blur-[3px] transition-opacity duration-[240ms] ease-out motion-reduce:transition-none motion-reduce:opacity-100 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={() => !busy && dismiss()}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={`relative z-10 w-full max-w-[min(100%,22rem)] rounded-2xl border border-slate-600/80 bg-surface-card px-5 pb-5 pt-4 shadow-2xl shadow-black/50 ring-1 ring-white/5 transition-[opacity,transform] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          visible
            ? 'translate-y-0 scale-100 opacity-100'
            : 'translate-y-3 scale-[0.96] opacity-0'
        } motion-reduce:translate-y-0 motion-reduce:scale-100 motion-reduce:opacity-100`}
      >
        <div className="mb-3 flex gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400/95 ring-1 ring-rose-500/25 motion-reduce:animate-none ${
              visible ? 'animate-sign-out-icon motion-reduce:opacity-100' : 'opacity-0'
            }`}
            aria-hidden
          >
            <UserMinus className="h-6 w-6" strokeWidth={2} />
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 id={titleId} className="text-base font-semibold tracking-tight text-white">
              Remove from Following?
            </h2>
            <p id={descId} className="mt-1 text-sm leading-snug text-slate-400">
              Stop following <span className="font-medium text-slate-200">{friend.name}</span>? They
              won&apos;t appear in your feed anymore. If they follow you, they&apos;ll still see you until they
              remove you too.
            </p>
          </div>
        </div>
        {error ? (
          <p className="mt-3 text-sm text-red-300/95" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            disabled={busy}
            className="rounded-xl border border-slate-600/80 bg-slate-800/40 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:opacity-50"
            onClick={() => !busy && dismiss()}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-xl bg-rose-600/90 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-950/40 transition-colors hover:bg-rose-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:opacity-50"
            onClick={() => confirm()}
          >
            {busy ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
