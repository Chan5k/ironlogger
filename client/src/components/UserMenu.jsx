import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AlertTriangle, BadgeCheck, ChevronDown, LogOut, Settings, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { appPath } from '../constants/routes.js';

function initialsFromUser(user) {
  const n = (user?.name || '').trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  const e = (user?.email || '?').split('@')[0];
  return e.slice(0, 2).toUpperCase();
}

/** Match mobile drawer in `Layout.jsx` (backdrop + aside). */
const MENU_ANIM_MS = 200;

export default function UserMenu({ onSignOut }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [signOutLayerMounted, setSignOutLayerMounted] = useState(false);
  const [signOutLayerVisible, setSignOutLayerVisible] = useState(false);
  const rootRef = useRef(null);
  const menuOpenRafRef = useRef({ outer: 0, inner: 0 });
  const signOutDismissTimerRef = useRef(null);
  const signOutCancelRef = useRef(null);

  const initials = useMemo(() => initialsFromUser(user), [user]);

  const profileTo =
    user?.publicProfileEnabled && user?.publicProfileSlug
      ? `/u/${encodeURIComponent(user.publicProfileSlug)}`
      : appPath('settings');

  useEffect(() => {
    let exitTimer;
    if (open) {
      setMenuMounted(true);
      setMenuVisible(false);
      /** Two frames so the closed state is painted before opening — otherwise `transition` often skips on enter. */
      menuOpenRafRef.current.outer = requestAnimationFrame(() => {
        menuOpenRafRef.current.inner = requestAnimationFrame(() => setMenuVisible(true));
      });
    } else {
      setMenuVisible(false);
      exitTimer = window.setTimeout(() => setMenuMounted(false), MENU_ANIM_MS);
    }
    return () => {
      cancelAnimationFrame(menuOpenRafRef.current.outer);
      cancelAnimationFrame(menuOpenRafRef.current.inner);
      clearTimeout(exitTimer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(signOutDismissTimerRef.current), []);

  useEffect(() => {
    if (!signOutLayerMounted) return undefined;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setSignOutLayerVisible(true));
    });
    return () => cancelAnimationFrame(id);
  }, [signOutLayerMounted]);

  useEffect(() => {
    if (!signOutLayerMounted || !signOutLayerVisible) return undefined;
    signOutCancelRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [signOutLayerMounted, signOutLayerVisible]);

  const dismissSignOutConfirm = useCallback(() => {
    setSignOutLayerVisible(false);
    clearTimeout(signOutDismissTimerRef.current);
    signOutDismissTimerRef.current = window.setTimeout(() => {
      setSignOutLayerMounted(false);
      signOutDismissTimerRef.current = null;
    }, 260);
  }, []);

  useEffect(() => {
    if (!signOutLayerMounted) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') dismissSignOutConfirm();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [signOutLayerMounted, dismissSignOutConfirm]);

  function openSignOutConfirm() {
    setOpen(false);
    setSignOutLayerMounted(true);
    setSignOutLayerVisible(false);
  }

  function confirmSignOut() {
    clearTimeout(signOutDismissTimerRef.current);
    signOutDismissTimerRef.current = null;
    setSignOutLayerMounted(false);
    setSignOutLayerVisible(false);
    onSignOut();
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg py-1.5 pl-1 pr-2 text-left transition-colors duration-motion ease-motion-standard hover:bg-slate-800/60 active:scale-[0.98]"
        aria-expanded={open || menuVisible}
        aria-haspopup="menu"
        aria-label="Account menu"
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700/90 text-sm font-semibold tracking-tight text-slate-100 ring-1 ring-slate-600/50">
          {initials}
          {user?.emailVerified ? (
            <BadgeCheck
              className="absolute -bottom-0.5 -right-0.5 h-4 w-4 text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.45)]"
              strokeWidth={2}
              aria-label="Verified email"
              title="Verified email"
            />
          ) : null}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-motion ease-motion-standard motion-reduce:duration-0 ${open ? 'rotate-180' : ''}`}
          strokeWidth={2}
          aria-hidden
        />
      </button>

      {menuMounted ? (
        <div
          className={`absolute right-0 z-[60] mt-2 w-52 origin-top-right rounded-[10px] border border-slate-200/80 dark:border-slate-700/80 bg-surface-card py-1 shadow-xl ring-1 ring-black/20 transition-[opacity,transform] duration-motion-slow ease-motion-standard motion-reduce:duration-0 ${
            menuVisible
              ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
              : 'pointer-events-none -translate-y-2 scale-[0.98] opacity-0'
          }`}
          role="menu"
          aria-hidden={!menuVisible}
        >
          <Link
            to={profileTo}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 transition-colors duration-motion ease-motion-standard hover:bg-slate-800/70"
          >
            <User className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={1.75} aria-hidden />
            Profile
          </Link>
          <Link
            to={appPath('settings')}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-200 transition-colors duration-motion ease-motion-standard hover:bg-slate-800/70"
          >
            <Settings className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={1.75} aria-hidden />
            Settings
          </Link>
          <div className="my-1 border-t border-slate-200/90 dark:border-slate-800/90" />
          <button
            type="button"
            role="menuitem"
            onClick={() => openSignOutConfirm()}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-rose-400/95 transition-colors duration-motion ease-motion-standard hover:bg-rose-950/30"
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
            Sign out
          </button>
        </div>
      ) : null}

      {signOutLayerMounted
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
              role="presentation"
            >
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                className={`absolute inset-0 bg-slate-900/65 dark:bg-black/65 backdrop-blur-[3px] transition-opacity duration-motion-slow ease-motion-standard motion-reduce:transition-none motion-reduce:opacity-100 ${
                  signOutLayerVisible ? 'opacity-100' : 'opacity-0'
                }`}
                onClick={() => dismissSignOutConfirm()}
              />
              <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="sign-out-dialog-title"
                aria-describedby="sign-out-dialog-desc"
                className={`relative z-10 w-full max-w-[min(100%,22rem)] rounded-2xl border border-slate-300/80 dark:border-slate-600/80 bg-surface-card px-5 pb-5 pt-4 shadow-2xl shadow-slate-400/25 dark:shadow-black/50 ring-1 ring-white/5 transition-[opacity,transform] duration-motion-slow ease-motion-standard motion-reduce:transition-none ${
                  signOutLayerVisible
                    ? 'translate-y-0 scale-100 opacity-100'
                    : 'translate-y-3 scale-[0.96] opacity-0'
                } motion-reduce:translate-y-0 motion-reduce:scale-100 motion-reduce:opacity-100`}
              >
                <div className="mb-3 flex gap-3">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400/95 ring-1 ring-amber-500/25 motion-reduce:animate-none ${
                      signOutLayerVisible
                        ? 'animate-sign-out-icon motion-reduce:opacity-100'
                        : 'opacity-0'
                    }`}
                    aria-hidden
                  >
                    <AlertTriangle className="h-6 w-6" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <h2
                      id="sign-out-dialog-title"
                      className="text-base font-semibold tracking-tight text-slate-900 dark:text-white"
                    >
                      Sign out?
                    </h2>
                    <p id="sign-out-dialog-desc" className="mt-1 text-sm leading-snug text-slate-400">
                      You will need to sign in again to access your workouts and profile.
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    ref={signOutCancelRef}
                    type="button"
                    className="rounded-xl border border-slate-300/80 dark:border-slate-600/80 bg-slate-800/40 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors duration-motion ease-motion-standard hover:bg-slate-800/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                    onClick={() => dismissSignOutConfirm()}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-rose-600/90 px-4 py-2.5 text-sm font-semibold text-slate-900 dark:text-white shadow-lg shadow-rose-950/40 transition-colors duration-motion ease-motion-standard hover:bg-rose-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                    onClick={() => confirmSignOut()}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
