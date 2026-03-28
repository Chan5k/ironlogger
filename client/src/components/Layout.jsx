import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { appPath } from '../constants/routes.js';

const nav = [
  { to: appPath(), label: 'Home', end: true },
  { to: appPath('workouts'), label: 'Workouts' },
  { to: appPath('library'), label: 'Library' },
  { to: appPath('templates'), label: 'Plans' },
  { to: appPath('progress'), label: 'Progress' },
  { to: appPath('statistics'), label: 'Statistics' },
  { to: appPath('activity'), label: 'Activity' },
  { to: appPath('settings'), label: 'Settings' },
];

function navClass({ isActive }) {
  return `shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors md:text-sm ${
    isActive
      ? 'bg-surface-elevated text-white ring-1 ring-slate-600/60'
      : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-200'
  }`;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-surface/95 backdrop-blur-md safe-pt">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Link
            to={appPath()}
            className="text-lg font-semibold tracking-tight text-white transition-colors hover:text-accent-muted focus:outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-accent"
          >
            IronLog
          </Link>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/');
            }}
            className="shrink-0 text-sm text-slate-400 hover:text-white"
          >
            Sign out
          </button>
        </div>

        {user?.name ? (
          <p className="mx-auto max-w-4xl px-4 pb-1 text-xs text-slate-500">{user.name}</p>
        ) : null}

        <nav
          className="mx-auto max-w-4xl border-t border-slate-800/60 px-2 py-2 md:px-4 md:py-2.5"
          aria-label="Main"
        >
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 md:flex-wrap md:overflow-visible md:gap-2">
            {nav.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={navClass}>
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}
