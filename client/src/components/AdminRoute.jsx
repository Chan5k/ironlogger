import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { appPath } from '../constants/routes.js';

export default function AdminRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-slate-400 motion-reduce:animate-none animate-ui-fade-in">
        <span
          className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-slate-300 dark:border-slate-600 border-t-accent motion-reduce:animate-none"
          aria-hidden
        />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }
  if (!user?.isStaff) {
    return <Navigate to={appPath()} replace />;
  }
  return <Outlet />;
}
