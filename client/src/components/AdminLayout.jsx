import { NavLink, Outlet } from 'react-router-dom';
import { appPath } from '../constants/routes.js';

const tabClass = ({ isActive }) =>
  [
    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-blue-600/20 text-white ring-1 ring-blue-500/30'
      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200',
  ].join(' ');

export default function AdminLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Admin</h1>
        <p className="text-sm text-slate-400">Overview, users, built-in exercise demos, and audit trail</p>
      </div>

      <nav className="flex flex-wrap gap-2 border-b border-slate-800 pb-3" aria-label="Admin sections">
        <NavLink to={appPath('admin')} end className={tabClass}>
          Overview
        </NavLink>
        <NavLink to={appPath('admin/users')} className={tabClass}>
          Users
        </NavLink>
        <NavLink to={appPath('admin/exercises')} className={tabClass}>
          Built-in demos
        </NavLink>
        <NavLink to={appPath('admin/audit')} className={tabClass}>
          Audit log
        </NavLink>
      </nav>

      <Outlet />
    </div>
  );
}
