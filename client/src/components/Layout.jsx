import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Calendar,
  Dumbbell,
  Home,
  Library,
  Menu,
  Settings,
  Shield,
  TrendingUp,
  Trophy,
  Rss,
  Target,
  Utensils,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { APP_BASE, appPath } from '../constants/routes.js';
import UserMenu from './UserMenu.jsx';
import NotificationBell from './NotificationBell.jsx';
import api from '../api/client.js';
import {
  flushOfflineQueue,
  getOfflineQueueLength,
  OFFLINE_QUEUE_EVENT,
} from '../utils/offlineQueue.js';
import { appAlert } from '../lib/appDialogApi.js';
import ResumeNewWorkoutCallout from './ResumeNewWorkoutCallout.jsx';
import EmailVerificationBanner from './EmailVerificationBanner.jsx';
import ThemeToggle from './ThemeToggle.jsx';

/** Lucide defaults to outline strokes; keep nav glyphs uniform at 20px. */
const NAV_ICON_STROKE = 1.75;
const navIconSize = 20;

function makeNavIcon(LucideIcon) {
  function NavGlyph({ className }) {
    return (
      <LucideIcon
        size={navIconSize}
        strokeWidth={NAV_ICON_STROKE}
        className={`shrink-0 ${className || ''}`}
        aria-hidden
      />
    );
  }
  return NavGlyph;
}

const IconHome = makeNavIcon(Home);
const IconWorkouts = makeNavIcon(Dumbbell);
const IconLibrary = makeNavIcon(Library);
const IconPlans = makeNavIcon(Calendar);
const IconProgress = makeNavIcon(TrendingUp);
const IconStatistics = makeNavIcon(BarChart3);
const IconActivity = makeNavIcon(Activity);
const IconFollowing = makeNavIcon(Users);
const IconLeaderboards = makeNavIcon(Trophy);
const IconFeed = makeNavIcon(Rss);
const IconGoals = makeNavIcon(Target);
const IconNutrition = makeNavIcon(Utensils);
const IconSettings = makeNavIcon(Settings);
const IconAdmin = makeNavIcon(Shield);

function mobileNavLinkClass(isActive) {
  return [
    'group relative flex w-full items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium transition-[background-color,color] duration-motion ease-motion-standard',
    'active:bg-slate-300/70 dark:active:bg-slate-800/55',
    isActive
      ? 'bg-slate-200/90 dark:bg-slate-800/50 text-slate-900 dark:text-white'
      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/35 hover:text-slate-900 dark:hover:text-white',
  ].join(' ');
}

function railNavLinkClass(isActive) {
  return [
    'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors duration-motion ease-motion-standard',
    isActive
      ? 'bg-blue-600/15 text-slate-900 dark:text-white ring-1 ring-blue-500/25'
      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/90 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-slate-100',
  ].join(' ');
}

function NavSectionsList({ navSections, onNavClick, variant = 'drawer' }) {
  const linkClass = variant === 'rail' ? railNavLinkClass : mobileNavLinkClass;
  return (
    <div className="flex flex-col gap-6">
      {navSections.map((section) => (
        <div key={section.id}>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500/80">
            {section.title}
          </p>
          <ul className="flex flex-col gap-1">
            {section.items.map(({ to, label, end, Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) => linkClass(isActive)}
                  onClick={onNavClick}
                >
                  {({ isActive }) => (
                    <>
                      {variant === 'drawer' ? (
                        <span
                          className="pointer-events-none absolute left-0 top-2 bottom-2 w-[3px] rounded-r-sm bg-slate-700/90 dark:bg-white/90 transition-opacity duration-motion ease-motion-standard"
                          style={{ opacity: isActive ? 1 : 0 }}
                          aria-hidden
                        />
                      ) : null}
                      <Icon
                        className={
                          isActive
                            ? 'text-blue-400/95'
                            : 'text-slate-500 transition-colors duration-motion ease-motion-standard group-hover:text-slate-700 dark:group-hover:text-slate-300'
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
  );
}

function MenuIcon() {
  return <Menu className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />;
}

function CloseIcon() {
  return <X className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />;
}

function buildNavSections(isStaff) {
  const other = [{ to: appPath('settings'), label: 'Settings', Icon: IconSettings }];
  return [
    {
      id: 'main',
      title: 'Main',
      items: [
        { to: appPath(), label: 'Home', end: true, Icon: IconHome },
        { to: appPath('workouts'), label: 'Workouts', Icon: IconWorkouts },
        { to: appPath('library'), label: 'Library', Icon: IconLibrary },
        ...(isStaff ? [{ to: appPath('admin'), label: 'Admin', Icon: IconAdmin }] : []),
      ],
    },
    {
      id: 'tracking',
      title: 'Tracking',
      items: [
        { to: appPath('templates'), label: 'Plans', Icon: IconPlans },
        { to: appPath('progress'), label: 'Progress', Icon: IconProgress },
        { to: appPath('statistics'), label: 'Statistics', Icon: IconStatistics },
        { to: appPath('goals'), label: 'Goals', Icon: IconGoals },
        { to: appPath('nutrition'), label: 'Nutrition', Icon: IconNutrition },
      ],
    },
    {
      id: 'social',
      title: 'Social',
      items: [
        { to: appPath('feed'), label: 'Activity Feed', Icon: IconFeed },
        { to: appPath('activity'), label: 'Activity', Icon: IconActivity },
        { to: appPath('following'), label: 'Following', Icon: IconFollowing },
        { to: appPath('leaderboards'), label: 'Leaderboards', Icon: IconLeaderboards },
      ],
    },
    {
      id: 'other',
      title: 'Other',
      items: other,
    },
  ];
}

export default function Layout() {
  const { user, logout, impersonating, endImpersonation } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [offlinePending, setOfflinePending] = useState(0);
  const [offlineFlushing, setOfflineFlushing] = useState(false);
  const [networkOnline, setNetworkOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine
  );

  const navSections = useMemo(() => buildNavSections(!!user?.isStaff), [user?.isStaff]);

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
      setNetworkOnline(true);
      if (typeof navigator !== 'undefined' && navigator.onLine && getOfflineQueueLength() > 0) {
        runOfflineFlush();
      }
    };
    const onOffline = () => setNetworkOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [runOfflineFlush]);

  useEffect(() => {
    const onVisible = () => {
      if (
        document.visibilityState === 'visible' &&
        typeof navigator !== 'undefined' &&
        navigator.onLine &&
        getOfflineQueueLength() > 0
      ) {
        runOfflineFlush();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
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

  const showHubTabs =
    location.pathname === APP_BASE ||
    location.pathname === `${APP_BASE}/` ||
    location.pathname === appPath('statistics');

  return (
    <div className="flex min-h-svh flex-col overflow-x-hidden bg-app-canvas">
      <header className="sticky top-0 z-50 flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800/60 bg-app-canvas/95 px-4 pb-3 pt-3 backdrop-blur-md safe-pt">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            className="-ml-1 rounded-lg p-2 text-slate-600 transition-colors duration-motion ease-motion-standard hover:bg-slate-200/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white active:scale-[0.97] md:hidden"
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
            aria-label="IronLog home"
            className="flex shrink-0 items-center rounded-lg transition-[filter,opacity] duration-motion ease-motion-standard hover:opacity-95 hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          >
            <img
              src={`${import.meta.env.BASE_URL}icons/icon-192.png`}
              alt=""
              width={32}
              height={32}
              decoding="async"
              fetchPriority="high"
              className="h-8 w-8 rounded-lg object-contain ring-1 ring-white/25 shadow-[0_0_24px_rgba(59,130,246,0.2)]"
            />
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <ThemeToggle />
          <NotificationBell />
          <UserMenu onSignOut={handleSignOut} />
        </div>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1">
      {/* Desktop / tablet: persistent sidebar */}
      <aside
        className="sticky top-0 z-30 hidden h-svh min-h-0 w-[15rem] shrink-0 flex-col border-r border-slate-200/70 dark:border-slate-800/70 bg-app-canvas md:flex"
        aria-label="Main navigation"
      >
        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-6 pt-5" aria-label="App sections">
          <NavSectionsList navSections={navSections} variant="rail" />
        </nav>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-app-canvas">
      {/* Mobile drawer + backdrop */}
      <div className="md:hidden" aria-hidden={!menuOpen}>
        <div
          className={`fixed inset-0 z-[55] bg-slate-900/60 dark:bg-black/60 transition-opacity duration-motion ease-motion-standard ${
            menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          onClick={() => setMenuOpen(false)}
          aria-hidden
        />
        <aside
          id="mobile-navigation"
          className={`fixed left-0 top-0 z-[56] flex h-full w-[min(19rem,88vw)] max-w-full flex-col border-r border-slate-200/90 dark:border-slate-800/90 bg-surface-card shadow-[4px_0_24px_rgba(0,0,0,0.35)] transition-transform duration-motion-slow ease-motion-emphasized safe-pt safe-pb ${
            menuOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
          }`}
          aria-label="Main navigation"
          aria-hidden={!menuOpen}
        >
          <div className="border-b border-slate-200/80 dark:border-slate-800/80 px-4 pb-4 pt-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Menu</h2>
                {user?.name ? (
                  <p className="mt-2 text-xs font-normal text-slate-400/90">{user.name}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors duration-motion ease-motion-standard hover:bg-slate-200/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white active:bg-slate-200 dark:active:bg-slate-800"
                aria-label="Close menu"
                data-testid="mobile-menu-close"
                onClick={() => setMenuOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-4" aria-label="App sections">
            <NavSectionsList navSections={navSections} onNavClick={() => setMenuOpen(false)} />
          </nav>

        </aside>
      </div>

      <EmailVerificationBanner />

      {impersonating ? (
        <div className="flex flex-col gap-2 border-b border-amber-800/70 bg-amber-950/45 px-4 py-2.5 text-center text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-center sm:gap-4">
          <span>
            Viewing as <span className="font-medium text-slate-900 dark:text-white">{user?.email}</span> — leave support mode when finished.
          </span>
          <button
            type="button"
            onClick={async () => {
              try {
                await endImpersonation();
              } catch (e) {
                await appAlert(e.response?.data?.error || 'Could not end impersonation');
              }
            }}
            className="rounded-lg bg-amber-200/15 px-3 py-1.5 text-sm font-semibold text-amber-50 ring-1 ring-amber-500/40 transition-[background-color,box-shadow] duration-motion ease-motion-standard hover:bg-amber-200/25"
          >
            Exit impersonation
          </button>
        </div>
      ) : null}

      {!networkOnline ? (
        <div className="border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-900/85 px-4 py-2 text-center text-sm text-slate-300">
          You&apos;re offline. You can still log workouts; saves queue and sync automatically when you reconnect (or tap
          Sync below if you have pending changes).
        </div>
      ) : null}

      {offlinePending > 0 ? (
        <div className="border-b border-amber-900/60 bg-amber-950/40 px-4 py-2 text-center text-sm text-amber-200">
          <span className="mr-2">
            {offlinePending} workout change{offlinePending !== 1 ? 's' : ''} waiting to sync.
          </span>
          <button
            type="button"
            disabled={offlineFlushing || (typeof navigator !== 'undefined' && !navigator.onLine)}
            onClick={() => runOfflineFlush()}
            className="font-medium text-amber-100 underline decoration-amber-500/60 underline-offset-2 transition-opacity duration-motion ease-motion-standard disabled:cursor-not-allowed disabled:opacity-50"
          >
            {offlineFlushing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      ) : null}

      {showHubTabs ? (
        <div className="border-b border-slate-200/70 dark:border-slate-800/70 bg-app-canvas/90 px-4 backdrop-blur-sm md:px-6">
          <nav className="-mb-px flex gap-8" aria-label="Dashboard views">
            <NavLink
              end
              to={appPath()}
              className={({ isActive }) =>
                [
                  'border-b-2 py-3 text-sm font-semibold transition-colors duration-motion ease-motion-standard',
                  isActive
                    ? 'border-blue-600 text-slate-900 dark:text-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300',
                ].join(' ')
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to={appPath('statistics')}
              className={({ isActive }) =>
                [
                  'border-b-2 py-3 text-sm font-semibold transition-colors duration-motion ease-motion-standard',
                  isActive
                    ? 'border-blue-600 text-slate-900 dark:text-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300',
                ].join(' ')
              }
            >
              Analytics
            </NavLink>
          </nav>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
        {/\/workouts\/new\/?$/.test(location.pathname) ? null : (
          <ResumeNewWorkoutCallout className="mb-4 md:mb-6" />
        )}
        <div
          key={location.pathname}
          className="motion-reduce:animate-none animate-ui-page-in"
        >
          <Outlet />
        </div>
      </main>
      </div>
      </div>
    </div>
  );
}
