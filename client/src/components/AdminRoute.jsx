import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { appPath } from '../constants/routes.js';

export default function AdminRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-400">Loading…</div>
    );
  }
  if (!user?.isAdmin) {
    return <Navigate to={appPath()} replace />;
  }
  return <Outlet />;
}
