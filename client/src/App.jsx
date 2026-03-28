import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { APP_BASE } from './constants/routes.js';
import Layout from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Workouts from './pages/Workouts.jsx';
import WorkoutEdit from './pages/WorkoutEdit.jsx';
import Library from './pages/Library.jsx';
import Templates from './pages/Templates.jsx';
import TemplateEdit from './pages/TemplateEdit.jsx';
import Progress from './pages/Progress.jsx';
import Statistics from './pages/Statistics.jsx';
import Settings from './pages/Settings.jsx';
import Activity from './pages/Activity.jsx';
import AdminRoute from './components/AdminRoute.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import AdminUserDetail from './pages/AdminUserDetail.jsx';

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Loading…
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path={`${APP_BASE}/*`}
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="workouts" element={<Workouts />} />
        <Route path="workouts/new" element={<WorkoutEdit />} />
        <Route path="workouts/:id" element={<WorkoutEdit />} />
        <Route path="library" element={<Library />} />
        <Route path="templates" element={<Templates />} />
        <Route path="templates/new" element={<TemplateEdit />} />
        <Route path="templates/:id" element={<TemplateEdit />} />
        <Route path="progress" element={<Progress />} />
        <Route path="statistics" element={<Statistics />} />
        <Route path="activity" element={<Activity />} />
        <Route path="settings" element={<Settings />} />
        <Route path="admin" element={<AdminRoute />}>
          <Route index element={<AdminUsers />} />
          <Route path="users/:userId" element={<AdminUserDetail />} />
        </Route>
        <Route path="*" element={<Navigate to={APP_BASE} replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
