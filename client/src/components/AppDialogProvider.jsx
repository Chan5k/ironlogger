import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { setAppDialogImpl } from '../lib/appDialogApi.js';
import { MOTION } from '../lib/motion.js';

/**
 * In-app alerts / confirms / copy sheet — bottom sheet on narrow viewports, centered card on md+.
 */
export default function AppDialogProvider({ children }) {
  const [active, setActive] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const queueRef = useRef([]);
  const activeRef = useRef(null);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const finishAndAdvance = useCallback((result) => {
    const cur = activeRef.current;
    setSheetOpen(false);
    window.setTimeout(() => {
      cur?.resolve?.(result);
      const next = queueRef.current.shift() ?? null;
      activeRef.current = next;
      setActive(next);
    }, MOTION.slow);
  }, []);

  useLayoutEffect(() => {
    if (!active) {
      setSheetOpen(false);
      return undefined;
    }
    setSheetOpen(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setSheetOpen(true));
    });
    return () => cancelAnimationFrame(id);
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (active.kind === 'confirm') finishAndAdvance(false);
        else if (active.kind === 'prompt') finishAndAdvance(null);
        else if (active.kind === 'alert') finishAndAdvance(undefined);
        else if (active.kind === 'copy') finishAndAdvance(undefined);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, finishAndAdvance]);

  const enqueue = useCallback((item) => {
    return new Promise((resolve) => {
      const entry = { ...item, resolve };
      setActive((cur) => {
        if (cur) {
          queueRef.current.push(entry);
          return cur;
        }
        activeRef.current = entry;
        return entry;
      });
    });
  }, []);

  const alertFn = useCallback((message) => enqueue({ kind: 'alert', message }), [enqueue]);
  const confirmFn = useCallback((message) => enqueue({ kind: 'confirm', message }), [enqueue]);
  const promptFn = useCallback(
    (opts) =>
      enqueue({
        kind: 'prompt',
        title: opts?.title || 'Input',
        message: String(opts?.message ?? ''),
        placeholder: opts?.placeholder || '',
        defaultValue: opts?.defaultValue ?? '',
        confirmLabel: opts?.confirmLabel || 'OK',
      }),
    [enqueue]
  );
  const copySheetFn = useCallback(
    ({ url, title }) => enqueue({ kind: 'copy', url, title: title || 'Copy link' }),
    [enqueue]
  );

  useEffect(() => {
    setAppDialogImpl({ alert: alertFn, confirm: confirmFn, prompt: promptFn, copySheet: copySheetFn });
    return () => setAppDialogImpl(null);
  }, [alertFn, confirmFn, promptFn, copySheetFn]);

  const sheetMode = active?.kind === 'copy';

  const portal =
    active &&
    createPortal(
      <div
        className={`fixed inset-0 z-[400] flex max-h-[100dvh] justify-center overflow-y-auto overflow-x-hidden p-4 ${
          sheetMode ? 'items-end sm:items-center' : 'items-center'
        }`}
        role="presentation"
      >
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          className={`fixed inset-0 bg-black/65 backdrop-blur-[2px] transition-opacity duration-motion-slow ease-motion-standard motion-reduce:transition-none ${
            sheetOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => {
            if (active.kind === 'confirm') finishAndAdvance(false);
            else if (active.kind === 'prompt') finishAndAdvance(null);
            else if (active.kind === 'alert') finishAndAdvance(undefined);
            else if (active.kind === 'copy') finishAndAdvance(undefined);
          }}
        />
        <div
          role={active.kind === 'confirm' || active.kind === 'prompt' ? 'alertdialog' : 'dialog'}
          aria-modal="true"
          aria-labelledby="app-dialog-title"
          className={`relative z-10 my-auto flex max-h-[min(90dvh,32rem)] w-full max-w-lg flex-col border border-slate-600/80 bg-[#121826] shadow-2xl shadow-black/50 ring-1 ring-white/5 transition-[transform,opacity] duration-motion-slow ease-motion-emphasized motion-reduce:transition-none ${
            sheetMode
              ? `max-sm:max-h-[min(85dvh,28rem)] max-sm:rounded-t-2xl max-sm:border-b-0 sm:rounded-2xl ${
                  sheetOpen
                    ? 'translate-y-0 opacity-100 sm:translate-y-0 sm:scale-100'
                    : 'translate-y-full opacity-100 sm:translate-y-3 sm:scale-[0.96] sm:opacity-0'
                }`
              : `rounded-2xl ${
                  sheetOpen ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-[0.97] opacity-0'
                }`
          } motion-reduce:translate-y-0 motion-reduce:scale-100 motion-reduce:opacity-100`}
        >
          {sheetMode ? (
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-600/80 sm:hidden" aria-hidden />
          ) : null}

          {active.kind === 'copy' ? (
            <CopySheetBody
              title={active.title}
              url={active.url}
              onDone={() => finishAndAdvance(undefined)}
            />
          ) : active.kind === 'prompt' ? (
            <PromptBody
              title={active.title}
              message={active.message}
              placeholder={active.placeholder}
              defaultValue={active.defaultValue}
              confirmLabel={active.confirmLabel}
              onCancel={() => finishAndAdvance(null)}
              onConfirm={(value) => finishAndAdvance(value)}
            />
          ) : (
            <>
              <div className="min-w-0 px-5 pb-2 pt-4 sm:pt-5">
                <h2 id="app-dialog-title" className="text-lg font-semibold tracking-tight text-white">
                  {active.kind === 'confirm' ? 'Confirm' : 'IronLog'}
                </h2>
                <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-300">
                  {active.message}
                </p>
              </div>
              <div className="mt-4 flex flex-col-reverse gap-2 border-t border-slate-800/90 px-4 py-4 safe-pb sm:flex-row sm:justify-end sm:gap-3">
                {active.kind === 'confirm' ? (
                  <>
                    <button
                      type="button"
                      className="rounded-xl border border-slate-600/80 px-4 py-3 text-sm font-semibold text-slate-200 transition-colors duration-motion ease-motion-standard hover:bg-slate-800/50 sm:py-2.5"
                      onClick={() => finishAndAdvance(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors duration-motion ease-motion-standard hover:bg-blue-500 sm:py-2.5"
                      onClick={() => finishAndAdvance(true)}
                    >
                      OK
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors duration-motion ease-motion-standard hover:bg-blue-500 sm:ml-auto sm:w-auto sm:py-2.5"
                    onClick={() => finishAndAdvance(undefined)}
                  >
                    OK
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>,
      document.body
    );

  return (
    <>
      {children}
      {portal}
    </>
  );
}

function PromptBody({ title, message, placeholder, defaultValue, confirmLabel, onCancel, onConfirm }) {
  const [value, setValue] = useState(defaultValue || '');
  const inputRef = useRef(null);

  useEffect(() => {
    setValue(defaultValue || '');
  }, [defaultValue]);

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 100);
    return () => window.clearTimeout(t);
  }, []);

  function submit() {
    const t = String(value).trim();
    onConfirm(t.length ? t : null);
  }

  return (
    <>
      <div className="min-w-0 px-5 pb-2 pt-4 sm:pt-5">
        <h2 id="app-dialog-title" className="text-lg font-semibold tracking-tight text-white">
          {title}
        </h2>
        <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-300">
          {message}
        </p>
        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          className="mt-4 w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-3 text-[15px] text-white outline-none focus:border-slate-500"
        />
      </div>
      <div className="mt-4 flex flex-col-reverse gap-2 border-t border-slate-800/90 px-4 py-4 safe-pb sm:flex-row sm:justify-end sm:gap-3">
        <button
          type="button"
          className="rounded-xl border border-slate-600/80 px-4 py-3 text-sm font-semibold text-slate-200 transition-colors duration-motion ease-motion-standard hover:bg-slate-800/50 sm:py-2.5"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors duration-motion ease-motion-standard hover:bg-blue-500 sm:py-2.5"
          onClick={submit}
        >
          {confirmLabel}
        </button>
      </div>
    </>
  );
}

function CopySheetBody({ title, url, onDone }) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
        return;
      }
    } catch {
      /* fall through */
    }
    try {
      inputRef.current?.select();
      document.execCommand('copy');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <div className="min-w-0 px-5 pb-2 pt-3 sm:pt-5">
        <h2 id="app-dialog-title" className="text-lg font-semibold tracking-tight text-white">
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-400">Select and copy, or use the button below.</p>
        <input
          ref={inputRef}
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          className="mt-4 w-full min-w-0 rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-3 font-mono text-sm text-slate-200 outline-none focus:border-slate-500"
        />
        {copied ? <p className="mt-2 text-sm font-medium text-emerald-400">Copied to clipboard</p> : null}
      </div>
      <div className="mt-2 flex flex-col-reverse gap-2 border-t border-slate-800/90 px-4 py-4 safe-pb sm:flex-row sm:justify-end sm:gap-3">
        <button
          type="button"
          className="rounded-xl border border-slate-600/80 px-4 py-3 text-sm font-semibold text-slate-200 transition-colors duration-motion ease-motion-standard hover:bg-slate-800/50 sm:py-2.5"
          onClick={onDone}
        >
          Done
        </button>
        <button
          type="button"
          className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors duration-motion ease-motion-standard hover:bg-blue-500 sm:py-2.5"
          onClick={() => copy()}
        >
          Copy
        </button>
      </div>
    </>
  );
}
