import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import LoginForm from './auth/LoginForm.jsx';
import RegisterForm from './auth/RegisterForm.jsx';
import { MOTION } from '../lib/motion.js';

/**
 * @param {{ mode: 'login' | 'register' | null, onClose: () => void, onSwitchMode: (m: 'login' | 'register') => void }} props
 */
export default function LandingAuthModal({ mode, onClose, onSwitchMode }) {
  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);
  const closeTimerRef = useRef(null);
  const panelRef = useRef(null);

  const runClose = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    setEntered(false);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setExiting(false);
      onClose();
    }, MOTION.out);
  }, [exiting, onClose]);

  useLayoutEffect(() => {
    if (!mode) {
      setEntered(false);
      setExiting(false);
      return undefined;
    }
    setExiting(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(id);
  }, [mode]);

  useEffect(() => {
    if (!mode) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') runClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mode, runClose]);

  useEffect(() => {
    if (!mode || !entered) return undefined;
    const t = window.setTimeout(() => {
      const el = panelRef.current?.querySelector('input:not([type="hidden"])');
      el?.focus();
    }, 120);
    return () => window.clearTimeout(t);
  }, [mode, entered]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (!mode) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mode]);

  if (!mode) return null;

  const backdropActive = entered && !exiting;
  const panelActive = entered && !exiting;

  const portal = createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center sm:p-6" role="presentation">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        className={`absolute inset-0 bg-[#05080d]/80 backdrop-blur-sm transition-[opacity,backdrop-filter] duration-motion-slow ease-motion-standard motion-reduce:transition-none ${
          backdropActive ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={() => runClose()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="landing-auth-title"
        className={`relative z-10 flex max-h-[min(90dvh,36rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-600/80 bg-[#121826] shadow-2xl shadow-black/50 ring-1 ring-white/[0.06] transition-[opacity,transform] duration-motion-slow ease-motion-standard motion-reduce:transition-none max-sm:max-h-[min(88dvh,34rem)] max-sm:rounded-t-2xl max-sm:rounded-b-xl ${
          panelActive
            ? 'translate-y-0 scale-100 opacity-100'
            : 'translate-y-6 scale-[0.96] opacity-0 sm:translate-y-4 sm:scale-[0.98]'
        }`}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-600/80 sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-3 border-b border-slate-800/90 px-5 pb-3 pt-4 sm:pt-5">
          <div className="min-w-0">
            <h2 id="landing-auth-title" className="text-xl font-bold tracking-tight text-white">
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {mode === 'login' ? 'Sign in to track your training' : 'Start logging workouts on any device'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => runClose()}
            className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors duration-motion ease-motion-standard hover:bg-slate-800/80 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {mode === 'login' ? (
            <LoginForm
              idPrefix="landing-login"
              className="space-y-4"
              footer={
                <p className="mt-6 text-center text-sm text-slate-500">
                  No account?{' '}
                  <button
                    type="button"
                    onClick={() => onSwitchMode('register')}
                    className="font-medium text-accent-muted hover:underline"
                  >
                    Create one
                  </button>
                </p>
              }
            />
          ) : (
            <RegisterForm
              idPrefix="landing-register"
              className="space-y-4"
              footer={
                <p className="mt-6 text-center text-sm text-slate-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => onSwitchMode('login')}
                    className="font-medium text-accent-muted hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              }
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );

  return portal;
}
