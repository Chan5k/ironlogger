import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { appPath } from '../constants/routes.js';
import RegisterForm from '../components/auth/RegisterForm.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function Register() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const from = typeof location.state?.from === 'string' ? location.state.from : null;

  if (!loading && isAuthenticated) {
    return <Navigate to={from && from.startsWith('/') ? from : appPath()} replace />;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8 motion-reduce:animate-none animate-ui-page-in">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          to="/"
          className="-ml-2 inline-flex min-h-11 min-w-11 items-center rounded-xl px-3 py-2 text-sm text-slate-500 transition-colors duration-motion ease-motion-standard hover:bg-slate-200/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
        >
          ← Back to home
        </Link>
        <ThemeToggle />
      </div>
      <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-white">Create account</h1>
      <p className="mb-8 text-sm text-slate-400">Start logging workouts on any device</p>
      <RegisterForm
        idPrefix="page-register"
        className="space-y-4"
        footer={
          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link
              to="/login"
              state={from ? { from } : undefined}
              className="text-accent-muted hover:underline"
            >
              Sign in
            </Link>
          </p>
        }
      />
    </div>
  );
}
