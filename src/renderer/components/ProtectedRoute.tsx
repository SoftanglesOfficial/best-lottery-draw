import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function ProtectedRoute() {
  const { isAuthenticated, isRestoring } = useAuth();
  if (isRestoring) return null;
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

export function ActiveCompanyRoute() {
  const { user } = useAuth();
  if (!user?.activeCompanyId) {
    return <Navigate to="/open-company" replace />;
  }
  return <Outlet />;
}

export function PublicRoute() {
  const { isAuthenticated, isRestoring, user } = useAuth();
  if (isRestoring) return null;
  if (isAuthenticated) {
    return <Navigate to={user?.activeCompanyId ? '/dashboard' : '/open-company'} replace />;
  }
  return <Outlet />;
}
