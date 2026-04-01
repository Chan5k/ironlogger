import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';

/**
 * Animated light/dark control (CSS transitions — smooth on iOS/Android).
 * Cycles: Dark → Light → System → Dark.
 */
export default function ThemeToggle({ className = '' }) {
  const { mode, setMode, effectiveDark } = useTheme();

  function cycle() {
    if (mode === 'dark') setMode('light');
    else if (mode === 'light') setMode('system');
    else setMode('dark');
  }

  const label =
    mode === 'system' ? `System (${effectiveDark ? 'dark' : 'light'})` : mode === 'light' ? 'Light' : 'Dark';

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Theme: ${label}. Tap to change.`}
      title={`Theme: ${label}`}
      className={`relative h-9 w-[3.5rem] shrink-0 rounded-full border border-slate-400/90 bg-slate-300/90 p-0.5 shadow-inner transition-[background-color,border-color] duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:border-slate-600 dark:bg-slate-800/95 ${className}`}
    >
      <span
        className="absolute left-0.5 top-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-slate-200/90 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none dark:bg-slate-600 dark:ring-slate-500/50"
        style={{
          transform: effectiveDark ? 'translateX(0)' : 'translateX(calc(3.5rem - 0.25rem - 1.75rem - 0.25rem))',
        }}
        aria-hidden
      >
        {effectiveDark ? (
          <Moon className="h-3.5 w-3.5 text-slate-700 dark:text-blue-100" strokeWidth={2.25} />
        ) : (
          <Sun className="h-3.5 w-3.5 text-amber-600" strokeWidth={2.25} />
        )}
      </span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
