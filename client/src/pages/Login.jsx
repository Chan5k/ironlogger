import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { appPath } from '../constants/routes.js';
import LoginForm from '../components/auth/LoginForm.jsx';

export default function Login() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const from = typeof location.state?.from === 'string' ? location.state.from : null;

  if (!loading && isAuthenticated) {
    return <Navigate to={from && from.startsWith('/') ? from : appPath()} replace />;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8 motion-reduce:animate-none animate-ui-page-in">
      <Link
        to="/"
        className="mb-6 -ml-2 inline-flex min-h-11 min-w-11 items-center self-start rounded-xl px-3 py-2 text-sm text-slate-400 transition-colors duration-motion ease-motion-standard hover:bg-slate-800/60 hover:text-white"
      >
        ← Back to home
      </Link>
      <h1 className="mb-1 text-2xl font-bold text-white">Welcome back</h1>
      <p className="mb-8 text-sm text-slate-400">Sign in to track your training</p>
      <LoginForm
        idPrefix="page-login"
        className="space-y-4"
        footer={
          <p className="mt-6 text-center text-sm text-slate-500">
            No account?{' '}
            <Link
              to="/register"
              state={from ? { from } : undefined}
              className="text-accent-muted hover:underline"
            >
              Create one
            </Link>
          </p>
        }
      />
    </div>
  );
}
