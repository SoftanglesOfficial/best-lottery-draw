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

export function ActiveShiftRoute() {
  const { activeShift } = useAuth();
  if (!activeShift) {
    return <Navigate to="/open-shift" replace />;
  }
  return <Outlet />;
}

export function PublicRoute() {
  const { isAuthenticated, isRestoring, user, activeShift } = useAuth();
  if (isRestoring) return null;
  if (isAuthenticated) {
    if (!user?.activeCompanyId) return <Navigate to="/dashboard" replace />;
    return <Navigate to={activeShift ? '/menu' : '/open-shift'} replace />;
  }
  return <Outlet />;
}
