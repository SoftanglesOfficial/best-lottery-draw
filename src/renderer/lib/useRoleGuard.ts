import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import type { UserRole } from '../../shared/types';

export function useRoleGuard(allowedRoles: UserRole[]) {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !allowedRoles.includes(user.role)) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, allowedRoles, navigate]);

  return user && allowedRoles.includes(user.role);
}
