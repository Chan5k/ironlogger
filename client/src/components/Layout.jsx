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

const iconBase = 'h-5 w-5 shrink-0 stroke-[1.5]';

function IconHome({ className }) {
  return (
    <svg className={`${iconBase} ${className || ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}
function IconWorkouts({ className }) {
  return (
    <svg className={`${iconBase} ${className || ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 8v8M19 8v8M7 12h10" />
    </svg>
  );
}
function IconLibrary({ className }) {
  return (
    <svg className={`${iconBase} ${className || ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}
function IconPlans({ className }) {
  return (
    <svg className={`${iconBase} ${className || ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
function IconProgress({ className }) {
  return (
    <svg className={`${iconBase} ${className || ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}
function IconStatistics({ className }) {
  return (
    <svg className={`${iconBase} ${className || ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
function IconActivity({ className }) {
  return (
    <svg className={`${iconBase} ${className || ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function IconFollowing({ className }) {
  return (
    <svg className={`${iconBase} ${className || ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
function IconSettings({ className }) {
  return (
    <svg className={`${iconBase} ${className || ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function IconAdmin({ className }) {
  return (
    <svg className={`${iconBase} ${className || ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function navClassDesktop({ isActive }) {
  return `shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-150 md:text-sm ${
    isActive
      ? 'bg-slate-800/55 text-white'
      : 'text-slate-500 hover:bg-slate-800/40 hover:text-slate-200'
  }`;
}

function mobileNavLinkClass(isActive) {
  return [
    'group relative flex w-full items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium transition-[background-color,color] duration-150 ease-out',
    'active:bg-slate-800/55',
    isActive
      ? 'bg-slate-800/50 text-white'
      : 'text-slate-300 hover:bg-slate-800/35 hover:text-white',
  ].join(' ');
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

function buildNavSections(isAdmin) {
  const other = [
    { to: appPath('settings'), label: 'Settings', Icon: IconSettings },
    ...(isAdmin ? [{ to: appPath('admin'), label: 'Admin', Icon: IconAdmin }] : []),
  ];
  return [
    {
      id: 'main',
      title: 'Main',
      items: [
        { to: appPath(), label: 'Home', end: true, Icon: IconHome },
        { to: appPath('workouts'), label: 'Workouts', Icon: IconWorkouts },
        { to: appPath('library'), label: 'Library', Icon: IconLibrary },
      ],
    },
    {
      id: 'tracking',
      title: 'Tracking',
      items: [
        { to: appPath('templates'), label: 'Plans', Icon: IconPlans },
        { to: appPath('progress'), label: 'Progress', Icon: IconProgress },
        { to: appPath('statistics'), label: 'Statistics', Icon: IconStatistics },
      ],
    },
    {
      id: 'social',
      title: 'Social',
      items: [
        { to: appPath('activity'), label: 'Activity', Icon: IconActivity },
        { to: appPath('following'), label: 'Following', Icon: IconFollowing },
      ],
    },
    {
      id: 'other',
      title: 'Other',
      items: other,
    },
  ];
}

/** Flat list for desktop horizontal nav (same order as sections). */
function flattenNavSections(sections) {
  return sections.flatMap((s) => s.items);
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [offlinePending, setOfflinePending] = useState(0);
  const [offlineFlushing, setOfflineFlushing] = useState(false);

  const navSections = useMemo(() => buildNavSections(!!user?.isAdmin), [user?.isAdmin]);
  const navFlat = useMemo(() => flattenNavSections(navSections), [navSections]);

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
          className={`fixed inset-0 z-[48] bg-black/60 transition-opacity duration-200 ease-out ${
            menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          onClick={() => setMenuOpen(false)}
          aria-hidden
        />
        <aside
          id="mobile-navigation"
          className={`fixed left-0 top-0 z-[50] flex h-full w-[min(19rem,88vw)] max-w-full flex-col border-r border-slate-800/90 bg-surface-card shadow-[4px_0_24px_rgba(0,0,0,0.35)] transition-transform duration-200 ease-out safe-pt safe-pb ${
            menuOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
          }`}
          aria-label="Main navigation"
          aria-hidden={!menuOpen}
        >
          <div className="border-b border-slate-800/80 px-4 pb-4 pt-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold tracking-tight text-white">Menu</h2>
                {user?.name ? (
                  <p className="mt-2 text-xs font-normal text-slate-400/90">{user.name}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-white active:bg-slate-800"
                aria-label="Close menu"
                data-testid="mobile-menu-close"
                onClick={() => setMenuOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-4" aria-label="App sections">
            <div className="flex flex-col gap-6">
              {navSections.map((section) => (
                <div key={section.id}>
                  <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500/70">
                    {section.title}
                  </p>
                  <ul className="flex flex-col gap-2">
                    {section.items.map(({ to, label, end, Icon }) => (
                      <li key={to}>
                        <NavLink
                          to={to}
                          end={end}
                          className={({ isActive }) => mobileNavLinkClass(isActive)}
                          onClick={() => setMenuOpen(false)}
                        >
                          {({ isActive }) => (
                            <>
                              <span
                                className="pointer-events-none absolute left-0 top-2 bottom-2 w-[3px] rounded-r-sm bg-accent transition-opacity duration-150"
                                style={{ opacity: isActive ? 1 : 0 }}
                                aria-hidden
                              />
                              <Icon
                                className={
                                  isActive
                                    ? 'text-accent-muted'
                                    : 'text-slate-500 transition-colors duration-150 group-hover:text-slate-300'
                                }
                              />
                              <span className="relative min-w-0 flex-1">{label}</span>
                            </>
                          )}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </nav>

          <div className="mt-auto border-t border-slate-800/80 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full rounded-lg py-2 text-center text-sm font-medium text-rose-400/90 transition-colors hover:bg-slate-800/40 hover:text-rose-300 active:bg-slate-800/60"
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
              className="md:hidden -ml-1 rounded-lg p-2 text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-white active:bg-slate-800"
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
              className="min-w-0 truncate text-lg font-semibold tracking-tight text-white transition-colors hover:text-accent-muted focus:outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-accent"
            >
              IronLog
            </Link>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="hidden shrink-0 rounded-lg px-2 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800/40 hover:text-white md:inline"
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
          <div className="-mx-1 flex flex-wrap gap-2 px-1 pb-0.5">
            {navFlat.map(({ to, label, end }) => (
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
