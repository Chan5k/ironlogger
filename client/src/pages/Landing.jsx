import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Dumbbell,
  LayoutTemplate,
  LineChart,
  Smartphone,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { appPath } from '../constants/routes.js';
import LandingAuthModal from '../components/LandingAuthModal.jsx';

/** Hover lift + shadow; reduced motion keeps color/opacity only */
const landingAnimPrimary =
  'transition-all duration-motion ease-motion-emphasized will-change-transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-accent/40 hover:brightness-[1.05] active:translate-y-0 active:scale-[0.98] active:brightness-100 active:shadow-lg motion-reduce:transition-colors motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-lg motion-reduce:hover:brightness-100 motion-reduce:hover:shadow-accent/20 motion-reduce:active:scale-100';

const landingAnimGhost =
  'transition-all duration-motion ease-motion-emphasized will-change-transform hover:-translate-y-0.5 hover:bg-slate-800/85 hover:text-white hover:shadow-md hover:shadow-black/35 active:translate-y-0 active:scale-[0.98] motion-reduce:transition-colors motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none motion-reduce:active:scale-100';

const landingAnimOutline =
  'transition-all duration-motion ease-motion-emphasized will-change-transform hover:-translate-y-0.5 hover:border-slate-500 hover:bg-slate-800/55 hover:shadow-md hover:shadow-black/25 active:translate-y-0 active:scale-[0.98] motion-reduce:transition-colors motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none motion-reduce:active:scale-100';

const landingAnimBrandLink =
  'transition-all duration-motion ease-motion-emphasized hover:scale-[1.04] hover:text-accent-muted active:scale-[0.99] motion-reduce:transition-colors motion-reduce:hover:scale-100 motion-reduce:active:scale-100';

/** Decorative mock UI: hover motion (non-interactive) */
const mockChrome =
  'transition-all duration-motion ease-motion-emphasized hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/55 hover:ring-1 hover:ring-white/[0.08] motion-reduce:transition-shadow motion-reduce:hover:translate-y-0';

const mockDot =
  'transition-transform duration-motion ease-motion-emphasized hover:scale-125 motion-reduce:hover:scale-100';

const mockUrlBar =
  'transition-all duration-motion ease-motion-emphasized hover:border-slate-600 hover:bg-surface-elevated/40 hover:text-slate-300';

const mockNavPill = (active) =>
  `shrink-0 cursor-default rounded-lg px-2 py-1 text-[9px] font-medium transition-all duration-motion ease-motion-emphasized hover:scale-105 sm:text-[10px] motion-reduce:hover:scale-100 ${
    active
      ? 'bg-surface-elevated text-white ring-1 ring-slate-600/50 hover:ring-accent/35'
      : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-300'
  }`;

const mockStatCard =
  'cursor-default rounded-xl border border-slate-800 bg-surface-card p-2 transition-all duration-motion ease-motion-emphasized hover:-translate-y-0.5 hover:border-slate-600 hover:shadow-md hover:shadow-black/30 sm:p-2.5 motion-reduce:transition-colors motion-reduce:hover:translate-y-0';

const mockRow =
  'cursor-default transition-all duration-motion ease-motion-emphasized hover:-translate-y-px hover:border-slate-600 hover:bg-surface-elevated/25 motion-reduce:hover:translate-y-0';

const mockBadge =
  'cursor-default transition-all duration-motion ease-motion-emphasized hover:scale-105 hover:brightness-110 motion-reduce:hover:scale-100';

const mockBarCol =
  'flex flex-1 flex-col items-center gap-1.5 transition-transform duration-motion ease-motion-emphasized hover:-translate-y-1 motion-reduce:hover:translate-y-0';

const mockBarFill =
  'w-full max-w-[2.25rem] rounded-t-md bg-gradient-to-t from-accent/90 to-accent-muted/70 transition-all duration-motion ease-motion-emphasized hover:from-accent hover:to-accent-muted motion-reduce:transition-none';

const enter =
  'motion-reduce:animate-none motion-reduce:opacity-100 animate-ui-page-in [animation-fill-mode:both]';

function staggerClass(i, visible) {
  if (!visible) return 'opacity-0';
  return `${enter} [animation-delay:${i * 80}ms]`;
}

const why = [
  {
    title: 'Built for between sets',
    body: 'Tap weight and reps, hit done, move on. No hunting through menus while the bar is waiting.',
  },
  {
    title: 'Progress you can read',
    body: 'Volume, frequency, and lift trends in plain charts—so you know what to load next week.',
  },
  {
    title: 'Repeat what works',
    body: 'Save templates and plans. Strong weeks become one-tap starts, not a rebuild every Monday.',
  },
];

const features = [
  {
    icon: Zap,
    title: 'Log in seconds',
    body: 'Rest timer, set checkoffs, kg or lbs. Install as a PWA on your phone for a focused, full-screen log.',
  },
  {
    icon: LineChart,
    title: 'Charts that match training',
    body: 'See volume and consistency over time. Built for lifters who care about trends, not vanity metrics.',
  },
  {
    icon: Trophy,
    title: 'PRs that stick',
    body: 'Personal records surface when you earn them—weight, reps, or volume—so wins don’t get lost in the noise.',
  },
  {
    icon: LayoutTemplate,
    title: 'Plans & templates',
    body: 'Turn a good session into a reusable template. Start a full workout from a plan without retyping exercises.',
  },
];

function useInViewOnce() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -7% 0px', threshold: 0.07 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return [ref, visible];
}

function PreviewChrome({ children, urlLabel }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-700/80 bg-surface shadow-2xl shadow-black/45 ring-1 ring-white/[0.06] ${mockChrome}`}
    >
      <div
        className="flex items-center gap-2 border-b border-slate-800 bg-surface-card px-3 py-2"
        aria-hidden
      >
        <div className="flex gap-1.5">
          <span className={`h-2 w-2.5 rounded-full bg-red-500/55 ${mockDot}`} />
          <span className={`h-2 w-2.5 rounded-full bg-amber-500/55 ${mockDot}`} />
          <span className={`h-2 w-2.5 rounded-full bg-emerald-500/55 ${mockDot}`} />
        </div>
        <div
          className={`mx-auto min-w-0 flex-1 truncate rounded-md border border-transparent bg-surface px-2 py-1 text-center text-[10px] font-medium text-slate-500 ${mockUrlBar}`}
        >
          {urlLabel}
        </div>
      </div>
      {children}
    </div>
  );
}

function DashboardPreview() {
  const nav = ['Home', 'Workouts', 'Library', 'Plans', 'Progress'];
  return (
    <div className="relative">
      <PreviewChrome urlLabel="ironlog · dashboard">
        <div className="p-3 sm:p-4">
          <div
            className={`mb-3 flex items-center justify-between border-b border-slate-800/80 pb-2 transition-colors duration-motion hover:border-slate-700/90`}
          >
            <span className="text-sm font-semibold tracking-tight text-white transition-transform duration-motion ease-motion-emphasized hover:translate-x-0.5">
              IronLog
            </span>
            <span className="cursor-default text-[10px] text-slate-500 transition-colors duration-motion hover:text-slate-400">
              Menu
            </span>
          </div>
          <div className="mb-3 flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {nav.map((label, i) => (
              <span key={label} className={mockNavPill(i === 0)}>
                {label}
              </span>
            ))}
          </div>
          <p className="transition-colors duration-motion hover:text-accent-muted/90 text-xs font-semibold text-white">
            Dashboard
          </p>
          <p className="text-[10px] text-slate-500 transition-colors duration-motion hover:text-slate-400">
            This week at a glance
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Sessions', '12'],
              ['This week', '4'],
              ['Volume', '42.8k'],
              ['Streak', '5d'],
            ].map(([label, val]) => (
              <div key={label} className={mockStatCard}>
                <p className="text-[8px] font-medium uppercase tracking-wide text-slate-500 sm:text-[9px]">{label}</p>
                <p className="mt-0.5 text-base font-semibold tabular-nums text-white sm:text-lg">{val}</p>
              </div>
            ))}
          </div>
          <div className={`mt-2 rounded-xl border border-slate-800 bg-surface-card p-2.5 ${mockRow}`}>
            <p className="text-[8px] font-medium uppercase tracking-wide text-slate-500">Last session</p>
            <p className="mt-1 text-xs font-medium text-white">Push — strength</p>
            <p className="text-[10px] text-slate-400">Completed · 18 sets</p>
          </div>
        </div>
      </PreviewChrome>
      <p className="mt-2.5 text-center text-[11px] text-slate-600 transition-colors duration-motion hover:text-slate-500">
        Illustrative UI
      </p>
    </div>
  );
}

function WorkoutSessionPreview() {
  return (
    <div className="relative">
      <PreviewChrome urlLabel="ironlog · workout">
        <div className="space-y-2.5 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">In session</p>
              <p className="text-sm font-semibold text-white transition-colors duration-motion hover:text-slate-100">
                Upper A
              </p>
            </div>
            <span
              className={`shrink-0 rounded-lg bg-accent/20 px-2 py-1 text-[10px] font-semibold text-accent-muted ${mockBadge}`}
            >
              Live
            </span>
          </div>
          <div className={`rounded-xl border border-slate-800 bg-surface-card p-2.5 ${mockRow}`}>
            <p className="text-xs font-medium text-white">Bench press</p>
            <div className="mt-2 space-y-1.5">
              {[
                ['100', '8', true],
                ['100', '8', true],
                ['100', '6', false],
              ].map(([w, r, done], i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-surface/80 px-2 py-1.5 text-[11px] transition-all duration-motion ease-motion-emphasized hover:bg-surface-elevated/40 hover:shadow-sm"
                >
                  <span className="tabular-nums text-slate-400 transition-colors duration-motion hover:text-slate-300">
                    {w} kg × {r}
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[9px] font-semibold transition-all duration-motion ease-motion-emphasized hover:scale-105 motion-reduce:hover:scale-100 ${
                      done ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {done ? 'Done' : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div
            className={`flex items-center justify-between rounded-xl border border-accent/25 bg-accent/10 px-3 py-2 transition-all duration-motion ease-motion-emphasized hover:border-accent/40 hover:bg-accent/18 hover:shadow-md hover:shadow-accent/10`}
          >
            <div className="flex items-center gap-2">
              <Timer
                className="h-4 w-4 text-accent-muted transition-transform duration-motion ease-motion-emphasized hover:rotate-12 hover:scale-110 motion-reduce:hover:scale-100 motion-reduce:hover:rotate-0"
                aria-hidden
              />
              <span className="text-xs font-medium text-white">Rest</span>
            </div>
            <span className="font-mono text-sm font-semibold tabular-nums text-accent-muted transition-transform duration-motion hover:scale-105 motion-reduce:hover:scale-100">
              1:12
            </span>
          </div>
        </div>
      </PreviewChrome>
      <p className="mt-2.5 text-center text-[11px] text-slate-600 transition-colors duration-motion hover:text-slate-500">
        Illustrative UI
      </p>
    </div>
  );
}

function PlansPreview() {
  return (
    <div className="relative">
      <PreviewChrome urlLabel="ironlog · plans">
        <div className="p-3 sm:p-4">
          <p className="text-xs font-semibold text-white transition-colors duration-motion hover:text-accent-muted/90">
            Templates
          </p>
          <p className="text-[10px] text-slate-500 transition-colors duration-motion hover:text-slate-400">
            One tap to start the same session
          </p>
          <ul className="mt-3 space-y-2">
            {['Strength — upper', 'Volume — lower', 'Deload week'].map((name) => (
              <li
                key={name}
                className={`flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-surface-card px-2.5 py-2 ${mockRow}`}
              >
                <span className="min-w-0 truncate text-[11px] font-medium text-white transition-colors duration-motion hover:text-slate-100">
                  {name}
                </span>
                <span
                  className={`shrink-0 text-[9px] font-semibold text-accent-muted ${mockBadge} rounded px-1`}
                >
                  Start
                </span>
              </li>
            ))}
          </ul>
        </div>
      </PreviewChrome>
      <p className="mt-2.5 text-center text-[11px] text-slate-600 transition-colors duration-motion hover:text-slate-500">
        Illustrative UI
      </p>
    </div>
  );
}

function ProgressPreview() {
  const bars = [
    { label: 'W1', h: 40 },
    { label: 'W2', h: 55 },
    { label: 'W3', h: 48 },
    { label: 'W4', h: 72 },
    { label: 'W5', h: 65 },
    { label: 'W6', h: 88 },
  ];
  return (
    <div className="relative">
      <PreviewChrome urlLabel="ironlog · progress">
        <div className="p-3 sm:p-4">
          <p className="text-xs font-semibold text-white transition-colors duration-motion hover:text-accent-muted/90">
            Volume trend
          </p>
          <p className="text-[10px] text-slate-500 transition-colors duration-motion hover:text-slate-400">
            Last 6 weeks · kg
          </p>
          <div className="mt-4 flex h-28 items-end justify-between gap-1.5 px-1">
            {bars.map(({ label, h }) => (
              <div key={label} className={mockBarCol}>
                <div className={mockBarFill} style={{ height: `${h}%` }} />
                <span className="text-[9px] font-medium text-slate-500 transition-colors duration-motion hover:text-slate-400">
                  {label}
                </span>
              </div>
            ))}
          </div>
          <div className={`mt-3 flex items-center justify-between rounded-xl border border-slate-800 bg-surface-card px-3 py-2 ${mockRow}`}>
            <span className="text-[10px] text-slate-500 transition-colors duration-motion hover:text-slate-400">
              Best week
            </span>
            <span className="text-xs font-semibold tabular-nums text-white transition-transform duration-motion hover:scale-105 motion-reduce:hover:scale-100">
              12.4k kg
            </span>
          </div>
        </div>
      </PreviewChrome>
      <p className="mt-2.5 text-center text-[11px] text-slate-600 transition-colors duration-motion hover:text-slate-500">
        Illustrative UI
      </p>
    </div>
  );
}

export default function Landing() {
  const { isAuthenticated, loading } = useAuth();
  const [authModal, setAuthModal] = useState(/** @type {null | 'login' | 'register'} */ (null));

  const [whyRef, whyVis] = useInViewOnce();
  const [featRef, featVis] = useInViewOnce();
  const [prevRef, prevVis] = useInViewOnce();
  const [ctaRef, ctaVis] = useInViewOnce();
  const [footRef, footVis] = useInViewOnce();

  if (!loading && isAuthenticated) {
    return <Navigate to={appPath()} replace />;
  }

  return (
    <div className="min-h-screen bg-surface text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-surface/85 backdrop-blur-md safe-pt">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 motion-reduce:animate-none animate-ui-fade-in sm:px-6">
          <Link
            to="/"
            className={`text-lg font-semibold tracking-tight text-white focus:outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-accent ${landingAnimBrandLink}`}
          >
            IronLog
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setAuthModal('login')}
              className={`min-h-11 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 sm:px-4 ${landingAnimGhost}`}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => setAuthModal('register')}
              className={`min-h-11 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-accent/20 ${landingAnimPrimary}`}
            >
              Sign up free
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section
          className="relative overflow-hidden border-b border-slate-800/60"
          aria-labelledby="landing-hero-heading"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(37,99,235,0.18),transparent)] motion-reduce:animate-none animate-landing-glow"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:pb-24 lg:pt-20">
            <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-14 xl:gap-16">
              <div className="min-w-0">
                <p
                  className={`mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent-muted ${enter} [animation-delay:0ms]`}
                >
                  <Dumbbell
                    className="h-3.5 w-3.5 opacity-90 transition-transform duration-motion ease-motion-emphasized hover:rotate-12 hover:scale-125 motion-reduce:hover:scale-100 motion-reduce:hover:rotate-0"
                    aria-hidden
                  />
                  Workout tracker
                </p>
                <h1
                  id="landing-hero-heading"
                  className={`text-[1.65rem] font-bold leading-[1.12] tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08] ${enter} [animation-delay:70ms]`}
                >
                  Track workouts fast.
                  <span className="text-slate-300"> See progress clearly.</span>
                </h1>
                <p
                  className={`mt-5 max-w-lg text-base leading-relaxed text-slate-400 sm:text-lg ${enter} [animation-delay:140ms]`}
                >
                  A lean log for serious lifting—quick sets on the gym floor, charts that tell the truth,
                  and templates when you want the same week again.{' '}
                  <span className="text-slate-300">Phone-first.</span> Works in the browser; add to Home
                  Screen for an app-like flow.
                </p>
                <ul className={`mt-6 flex flex-col gap-2.5 text-sm text-slate-400 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2 ${enter} [animation-delay:210ms]`}>
                  <li className="flex items-center gap-2 transition-transform duration-motion ease-motion-emphasized hover:translate-x-1 motion-reduce:hover:translate-x-0">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-400 transition-transform duration-motion ease-motion-emphasized hover:scale-110 hover:rotate-6 motion-reduce:hover:scale-100">
                      <Smartphone className="h-3 w-3" aria-hidden />
                    </span>
                    Built for mobile
                  </li>
                  <li className="flex items-center gap-2 transition-transform duration-motion ease-motion-emphasized hover:translate-x-1 motion-reduce:hover:translate-x-0">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent/15 text-accent-muted transition-transform duration-motion ease-motion-emphasized hover:scale-110 hover:rotate-6 motion-reduce:hover:scale-100">
                      <Trophy className="h-3 w-3" aria-hidden />
                    </span>
                    PRs &amp; progress charts
                  </li>
                  <li className="flex items-center gap-2 transition-transform duration-motion ease-motion-emphasized hover:translate-x-1 motion-reduce:hover:translate-x-0">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-700/80 text-slate-300 transition-transform duration-motion ease-motion-emphasized hover:scale-110 hover:rotate-6 motion-reduce:hover:scale-100">
                      <LayoutTemplate className="h-3 w-3" aria-hidden />
                    </span>
                    Plans &amp; templates
                  </li>
                </ul>
                <div className={`mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center ${enter} [animation-delay:280ms]`}>
                  <button
                    type="button"
                    onClick={() => setAuthModal('register')}
                    className={`inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-accent px-6 text-sm font-semibold text-white shadow-lg shadow-accent/25 sm:w-auto sm:min-w-[11rem] ${landingAnimPrimary}`}
                  >
                    Start free
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthModal('login')}
                    className={`inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-600 bg-surface-card/50 px-6 text-sm font-medium text-slate-200 sm:w-auto ${landingAnimOutline}`}
                  >
                    Log in
                  </button>
                </div>
              </div>
              <div
                className={`mx-auto w-full max-w-md lg:mx-0 lg:max-w-none lg:justify-self-end ${enter} [animation-delay:120ms] lg:[animation-delay:90ms]`}
              >
                <DashboardPreview />
              </div>
            </div>
          </div>
        </section>

        {/* Why */}
        <section className="py-14 sm:py-20" aria-labelledby="landing-why-heading">
          <div ref={whyRef} className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2
                id="landing-why-heading"
                className={`text-2xl font-bold tracking-tight text-white sm:text-3xl ${staggerClass(0, whyVis)}`}
              >
                Why IronLog
              </h2>
              <p className={`mt-3 text-sm leading-relaxed text-slate-400 sm:text-base ${staggerClass(1, whyVis)}`}>
                Training software should respect your session—fast when you’re under the bar, clear when
                you’re planning the next block.
              </p>
            </div>
            <ul className="mt-12 grid gap-4 sm:grid-cols-3 sm:gap-5">
              {why.map(({ title, body }, i) => (
                <li
                  key={title}
                  className={`group relative rounded-2xl border border-slate-800/90 bg-surface-card/50 p-6 shadow-sm shadow-black/20 transition-all duration-motion ease-motion-emphasized hover:-translate-y-1.5 hover:border-slate-600/90 hover:shadow-xl hover:shadow-black/30 motion-reduce:transition-colors motion-reduce:hover:translate-y-0 ${staggerClass(i + 2, whyVis)}`}
                >
                  <span
                    className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent/12 text-sm font-bold text-accent-muted transition-transform duration-motion ease-motion-emphasized group-hover:scale-110 group-hover:bg-accent/20 motion-reduce:group-hover:scale-100"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <h3 className="text-base font-semibold text-white transition-colors duration-motion group-hover:text-white">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400 transition-colors duration-motion group-hover:text-slate-300">
                    {body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Features */}
        <section
          ref={featRef}
          className="border-t border-slate-800/80 bg-surface-card/[0.35] py-14 sm:py-20"
          aria-labelledby="landing-features-heading"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2
                id="landing-features-heading"
                className={`text-2xl font-bold tracking-tight text-white sm:text-3xl ${staggerClass(0, featVis)}`}
              >
                What you get
              </h2>
              <p className={`mt-3 text-sm text-slate-400 sm:text-base ${staggerClass(1, featVis)}`}>
                Four things that cover how most lifters actually train—not a feature laundry list.
              </p>
            </div>
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:gap-6">
              {features.map(({ icon: Icon, title, body }, i) => (
                <li
                  key={title}
                  className={`group flex gap-4 rounded-2xl border border-slate-800 bg-surface p-5 transition-all duration-motion ease-motion-emphasized hover:-translate-y-1.5 hover:border-slate-600 hover:shadow-xl hover:shadow-black/25 sm:p-6 motion-reduce:transition-colors motion-reduce:hover:translate-y-0 ${staggerClass(i + 2, featVis)}`}
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent-muted ring-1 ring-accent/20 transition-all duration-motion ease-motion-emphasized group-hover:scale-110 group-hover:rotate-3 group-hover:bg-accent/20 group-hover:ring-accent/35 motion-reduce:group-hover:scale-100 motion-reduce:group-hover:rotate-0"
                    aria-hidden
                  >
                    <Icon className="h-5 w-5 transition-transform duration-motion group-hover:scale-105" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="font-semibold text-white transition-colors duration-motion group-hover:text-accent-muted/95">
                      {title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400 transition-colors duration-motion group-hover:text-slate-300">
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Product preview */}
        <section ref={prevRef} className="py-14 sm:py-20" aria-labelledby="landing-preview-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2
                id="landing-preview-heading"
                className={`text-2xl font-bold tracking-tight text-white sm:text-3xl ${staggerClass(0, prevVis)}`}
              >
                Inside the app
              </h2>
              <p className={`mt-3 text-sm text-slate-400 sm:text-base ${staggerClass(1, prevVis)}`}>
                Live logging, templates, and volume trends—without switching apps.
              </p>
            </div>
            <div className="mt-12 grid gap-8 lg:grid-cols-3 lg:gap-6">
              <div className={staggerClass(2, prevVis)}>
                <WorkoutSessionPreview />
              </div>
              <div className={staggerClass(3, prevVis)}>
                <PlansPreview />
              </div>
              <div className={staggerClass(4, prevVis)}>
                <ProgressPreview />
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section
          ref={ctaRef}
          className="border-t border-slate-800/80 pb-16 pt-4 sm:pb-20"
          aria-labelledby="landing-cta-heading"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div
              className={`relative overflow-hidden rounded-2xl border border-slate-700/80 bg-gradient-to-br from-surface-card via-surface-card to-slate-950/80 p-8 shadow-xl shadow-black/30 ring-1 ring-white/[0.04] transition-all duration-motion ease-motion-emphasized hover:border-slate-600/80 hover:shadow-2xl hover:shadow-black/40 sm:p-10 md:p-12 motion-reduce:hover:shadow-xl ${staggerClass(0, ctaVis)}`}
            >
              <div
                className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl motion-reduce:animate-none animate-landing-glow"
                aria-hidden
              />
              <div className="relative mx-auto max-w-xl text-center">
                <h2
                  id="landing-cta-heading"
                  className={`text-xl font-bold tracking-tight text-white sm:text-2xl md:text-3xl ${staggerClass(1, ctaVis)}`}
                >
                  Ready for your next session?
                </h2>
                <p
                  className={`mt-3 text-sm leading-relaxed text-slate-400 sm:text-base ${staggerClass(2, ctaVis)}`}
                >
                  Create an account in a minute. Your log stays on your account—no clutter, no upsell
                  wall on the basics.
                </p>
                <div className={`mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center ${staggerClass(3, ctaVis)}`}>
                  <button
                    type="button"
                    onClick={() => setAuthModal('register')}
                    className={`inline-flex min-h-12 items-center justify-center rounded-xl bg-accent px-8 text-sm font-semibold text-white shadow-lg shadow-accent/25 ${landingAnimPrimary}`}
                  >
                    Sign up free
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthModal('login')}
                    className={`inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-600 bg-transparent px-8 text-sm font-medium text-slate-200 ${landingAnimOutline}`}
                  >
                    I have an account
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer
        ref={footRef}
        className={`border-t border-slate-800/80 py-8 text-center transition-all duration-700 ease-motion-emphasized motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none ${
          footVis ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}
      >
        <p className="text-xs text-slate-600 transition-colors duration-motion ease-motion-emphasized hover:text-slate-400">
          IronLog — workout log &amp; progress
        </p>
      </footer>

      <LandingAuthModal
        mode={authModal}
        onClose={() => setAuthModal(null)}
        onSwitchMode={(m) => setAuthModal(m)}
      />
    </div>
  );
}
