import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { appPath } from '../constants/routes.js';
import LandingAuthModal from '../components/LandingAuthModal.jsx';

const reasons = [
  {
    title: 'Built for the gym floor',
    body: 'Log sets quickly between reps—no spreadsheet tabs or notebook pages to juggle mid-session.',
  },
  {
    title: 'See what actually worked',
    body: 'Volume, frequency, and lift trends turn your history into decisions, not guesswork.',
  },
  {
    title: 'Repeat good weeks',
    body: 'Save templates and plans so strong routines are one tap away, not something you rebuild every Monday.',
  },
  {
    title: 'Your log, your device',
    body: 'Use it in the browser or install as an app; kg or lbs and optional reminders match how you train.',
  },
];

const features = [
  {
    title: 'Live workout logging',
    body: 'Log sets, reps, weight, and RPE as you train. Pause, resume, and finish sessions with an accurate timer.',
  },
  {
    title: 'Exercise library',
    body: 'Build a personal library of movements and reuse them across workouts and plans.',
  },
  {
    title: 'Plans & templates',
    body: 'Save repeatable routines and start a full session from a plan in one tap.',
  },
  {
    title: 'Progress & volume',
    body: 'Charts and summaries for total volume, weekly consistency, and lift trends over time.',
  },
  {
    title: 'Activity & notes',
    body: 'Track daily activity and keep context on how training fits your week.',
  },
  {
    title: 'Reminders & units',
    body: 'Optional workout reminders, kg or lbs, and install as a PWA for a native feel on your phone.',
  },
];

function AppPreview() {
  const nav = ['Home', 'Workouts', 'Library', 'Plans', 'Progress'];
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="overflow-hidden rounded-2xl border border-slate-700/80 bg-surface shadow-2xl shadow-black/40 ring-1 ring-white/5">
        <div
          className="flex items-center gap-2 border-b border-slate-800 bg-surface-card px-3 py-2.5"
          aria-hidden
        >
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
          </div>
          <div className="mx-auto min-w-0 flex-1 truncate rounded-md bg-surface px-2 py-1 text-center text-[10px] text-slate-500">
            ironlog · dashboard
          </div>
        </div>
        <div className="p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-sm font-semibold tracking-tight text-white">IronLog</span>
            <span className="text-[10px] text-slate-500">Sign out</span>
          </div>
          <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
            {nav.map((label, i) => (
              <span
                key={label}
                className={`shrink-0 rounded-lg px-2 py-1 text-[9px] font-medium sm:text-[10px] ${
                  i === 0
                    ? 'bg-surface-elevated text-white ring-1 ring-slate-600/50'
                    : 'text-slate-500'
                }`}
              >
                {label}
              </span>
            ))}
          </div>
          <div className="mb-2">
            <p className="text-xs font-bold text-white">Dashboard</p>
            <p className="text-[10px] text-slate-500">Your training at a glance</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Total sessions', '24'],
              ['This week', '3'],
              ['This month', '11'],
              ['Est. volume', '182k'],
            ].map(([label, val]) => (
              <div
                key={label}
                className="rounded-xl border border-slate-800 bg-surface-card p-2 sm:p-2.5"
              >
                <p className="text-[8px] text-slate-500 sm:text-[9px]">{label}</p>
                <p className="text-base font-semibold text-white sm:text-lg">{val}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 rounded-xl border border-slate-800 bg-surface-card p-2.5 sm:p-3">
            <p className="text-[8px] text-slate-500 sm:text-[9px]">Last session</p>
            <p className="mt-0.5 text-xs font-medium text-white">Upper strength</p>
            <p className="text-[10px] text-slate-400">Sat, Mar 28</p>
            <span className="mt-2 inline-block rounded-full bg-emerald-950/80 px-2 py-0.5 text-[9px] text-emerald-400">
              Completed
            </span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-slate-600">Sample preview — not live data</p>
    </div>
  );
}

export default function Landing() {
  const { isAuthenticated, loading } = useAuth();
  const [authModal, setAuthModal] = useState(/** @type {null | 'login' | 'register'} */ (null));

  if (!loading && isAuthenticated) {
    return <Navigate to={appPath()} replace />;
  }

  return (
    <div className="min-h-screen bg-surface text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-surface/90 backdrop-blur-md safe-pt">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link
            to="/"
            className="text-lg font-semibold tracking-tight text-white transition-colors duration-motion ease-motion-standard hover:text-accent-muted focus:outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-accent"
          >
            IronLog
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setAuthModal('login')}
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-300 transition-colors duration-motion ease-motion-standard hover:bg-slate-800/60 hover:text-white"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => setAuthModal('register')}
              className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white transition-opacity duration-motion ease-motion-standard hover:opacity-90"
            >
              Sign up
            </button>
          </div>
        </div>
      </header>

      <main className="motion-reduce:animate-none animate-ui-page-in">
        <section className="mx-auto max-w-5xl px-4 pb-16 pt-10 sm:pb-20 sm:pt-14">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-10">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-accent-muted">
                Workout journal
              </p>
              <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-[2.5rem]">
                Train, log, and see your progress in one place.
              </h1>
              <p className="mt-4 max-w-xl text-base text-slate-400 sm:text-lg">
                IronLog is built for lifters who want fast logging on any device, reusable plans, and
                charts that actually reflect how you train.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setAuthModal('register')}
                  className="rounded-xl bg-accent px-5 py-3 text-center text-sm font-semibold text-white transition-opacity duration-motion ease-motion-standard hover:opacity-90"
                >
                  Create free account
                </button>
                <button
                  type="button"
                  onClick={() => setAuthModal('login')}
                  className="rounded-xl border border-slate-600 px-5 py-3 text-center text-sm font-medium text-slate-200 transition-colors duration-motion ease-motion-standard hover:border-slate-500 hover:bg-slate-800/40"
                >
                  I already have an account
                </button>
              </div>
            </div>
            <AppPreview />
          </div>
        </section>

        <section className="border-t border-slate-800/80 py-14 sm:py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-center text-xl font-bold text-white sm:text-2xl">
              Why use IronLog?
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-slate-400 sm:text-base">
              A training journal should make showing up easier—not add admin after every workout.
            </p>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2">
              {reasons.map(({ title, body }) => (
                <li
                  key={title}
                  className="flex gap-4 rounded-2xl border border-slate-800/80 bg-surface-card/40 p-5 sm:p-6"
                >
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-sm font-bold text-accent-muted"
                    aria-hidden
                  >
                    ✓
                  </span>
                  <div>
                    <h3 className="font-semibold text-white">{title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-slate-800/80 bg-surface-card/30 py-14 sm:py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-center text-xl font-bold text-white sm:text-2xl">
              Everything you need to stay consistent
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-slate-400 sm:text-base">
              From the first set to long-term trends — features that match a real training workflow.
            </p>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ title, body }) => (
                <li
                  key={title}
                  className="rounded-2xl border border-slate-800 bg-surface-card p-5 transition-colors duration-motion ease-motion-standard hover:border-slate-700"
                >
                  <h3 className="font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
          <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-surface-card to-surface p-8 text-center sm:p-10">
            <h2 className="text-xl font-bold text-white sm:text-2xl">Ready to log your next session?</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
              Sign up in seconds. Your data stays with your account.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => setAuthModal('register')}
                className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-opacity duration-motion ease-motion-standard hover:opacity-90"
              >
                Sign up free
              </button>
              <button
                type="button"
                onClick={() => setAuthModal('login')}
                className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-medium text-slate-200 transition-colors duration-motion ease-motion-standard hover:border-slate-500"
              >
                Log in
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-600">
        IronLog — workout training log
      </footer>

      <LandingAuthModal
        mode={authModal}
        onClose={() => setAuthModal(null)}
        onSwitchMode={(m) => setAuthModal(m)}
      />
    </div>
  );
}
