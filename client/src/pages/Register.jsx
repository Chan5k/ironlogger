import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { appPath } from '../constants/routes.js';
import RegisterForm from '../components/auth/RegisterForm.jsx';

export default function Register() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const from = typeof location.state?.from === 'string' ? location.state.from : null;

  if (!loading && isAuthenticated) {
    return <Navigate to={from && from.startsWith('/') ? from : appPath()} replace />;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <Link
        to="/"
        className="mb-6 text-sm text-slate-500 transition-colors hover:text-slate-300"
      >
        ← Back to home
      </Link>
      <h1 className="mb-1 text-2xl font-bold text-white">Create account</h1>
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
