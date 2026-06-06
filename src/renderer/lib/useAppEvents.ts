import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './auth';

export function useAppEvents() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    const removeNavigate = window.api.onAppNavigate?.((path: string) => {
      navigate(path);
    });
    const removeLogout = window.api.onAppLogout?.(() => {
      logout();
    });
    return () => {
      removeNavigate?.();
      removeLogout?.();
    };
  }, [navigate, logout]);
}
