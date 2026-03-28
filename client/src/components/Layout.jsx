import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { appPath } from '../constants/routes.js';
import api from '../api/client.js';
import {
  flushOfflineQueue,
  getOfflineQueueLength,
  OFFLINE_QUEUE_EVENT,
} from '../utils/offlineQueue.js';

const navBase = [
  { to: appPath(), label: 'Home', end: true },
  { to: appPath('workouts'), label: 'Workouts' },
  { to: appPath('library'), label: 'Library' },
  { to: appPath('templates'), label: 'Plans' },
  { to: appPath('progress'), label: 'Progress' },
  { to: appPath('statistics'), label: 'Statistics' },
  { to: appPath('activity'), label: 'Activity' },
  { to: appPath('settings'), label: 'Settings' },
];

function navClassDesktop({ isActive }) {
  return `shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors md:text-sm ${
    isActive
      ? 'bg-surface-elevated text-white ring-1 ring-slate-600/60'
      : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-200'
  }`;
}

function navClassMobile({ isActive }) {
  return `flex w-full items-center rounded-xl px-4 py-3.5 text-base font-medium transition-colors ${
    isActive
      ? 'bg-surface-elevated text-white ring-1 ring-slate-600/60'
      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
  }`;
}

function MenuIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [offlinePending, setOfflinePending] = useState(0);
  const [offlineFlushing, setOfflineFlushing] = useState(false);

  const refreshOfflinePending = useCallback(() => {
    setOfflinePending(getOfflineQueueLength());
  }, []);

  useEffect(() => {
    refreshOfflinePending();
    window.addEventListener(OFFLINE_QUEUE_EVENT, refreshOfflinePending);
    return () => window.removeEventListener(OFFLINE_QUEUE_EVENT, refreshOfflinePending);
  }, [refreshOfflinePending]);

  const runOfflineFlush = useCallback(async () => {
    setOfflineFlushing(true);
    try {
      await flushOfflineQueue(api);
    } finally {
      setOfflineFlushing(false);
      refreshOfflinePending();
    }
  }, [refreshOfflinePending]);

  useEffect(() => {
    const onOnline = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine && getOfflineQueueLength() > 0) {
        runOfflineFlush();
      }
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [runOfflineFlush]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const nav = useMemo(() => {
    if (user?.isAdmin) {
      return [...navBase, { to: appPath('admin'), label: 'Admin' }];
    }
    return navBase;
  }, [user?.isAdmin]);

  function handleSignOut() {
    setMenuOpen(false);
    logout();
    navigate('/');
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Mobile drawer + backdrop */}
      <div className="md:hidden" aria-hidden={!menuOpen}>
        <div
          className={`fixed inset-0 z-[48] bg-black/65 transition-opacity duration-200 ease-out ${
            menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          onClick={() => setMenuOpen(false)}
          aria-hidden
        />
        <aside
          id="mobile-navigation"
          className={`fixed left-0 top-0 z-[50] flex h-full w-[min(18rem,88vw)] max-w-full flex-col border-r border-slate-800 bg-surface-card shadow-2xl transition-transform duration-200 ease-out safe-pt safe-pb ${
            menuOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
          }`}
          aria-label="Main navigation"
          aria-hidden={!menuOpen}
        >
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <span className="text-lg font-semibold text-white">Menu</span>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Close menu"
              data-testid="mobile-menu-close"
              onClick={() => setMenuOpen(false)}
            >
              <CloseIcon />
            </button>
          </div>
          {user?.name ? (
            <p className="border-b border-slate-800/80 px-4 py-3 text-sm text-slate-400">{user.name}</p>
          ) : null}
          <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="App sections">
            <ul className="space-y-1">
              {nav.map(({ to, label, end }) => (
                <li key={to}>
                  <NavLink to={to} end={end} className={navClassMobile} onClick={() => setMenuOpen(false)}>
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="border-t border-slate-800 p-3">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full rounded-xl border border-slate-700 py-3 text-center text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </aside>
      </div>

      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-surface/95 backdrop-blur-md safe-pt">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              className="md:hidden -ml-1 rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              aria-label="Open menu"
              data-testid="mobile-menu-button"
              onClick={() => setMenuOpen(true)}
            >
              <MenuIcon />
            </button>
            <Link
              to={appPath()}
              className="min-w-0 truncate text-lg font-semibold tracking-tight text-white transition-colors hover:text-accent-muted focus:outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-accent"
            >
              IronLog
            </Link>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="hidden shrink-0 text-sm text-slate-400 hover:text-white md:inline"
          >
            Sign out
          </button>
        </div>

        {user?.name ? (
          <p className="mx-auto hidden max-w-4xl px-4 pb-1 text-xs text-slate-500 md:block">{user.name}</p>
        ) : null}

        <nav
          className="mx-auto hidden max-w-4xl border-t border-slate-800/60 px-2 py-2 md:block md:px-4 md:py-2.5"
          aria-label="Main"
        >
          <div className="-mx-1 flex flex-wrap gap-1 px-1 pb-0.5 md:gap-2">
            {nav.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={navClassDesktop}>
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      {offlinePending > 0 ? (
        <div className="border-b border-amber-900/60 bg-amber-950/40 px-4 py-2 text-center text-sm text-amber-200">
          <span className="mr-2">
            {offlinePending} workout change{offlinePending !== 1 ? 's' : ''} waiting to sync.
          </span>
          <button
            type="button"
            disabled={offlineFlushing || (typeof navigator !== 'undefined' && !navigator.onLine)}
            onClick={() => runOfflineFlush()}
            className="font-medium text-amber-100 underline decoration-amber-500/60 underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {offlineFlushing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}
