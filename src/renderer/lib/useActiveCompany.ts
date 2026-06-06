import { useEffect, useRef } from 'react';
import { useToast } from '../components/Toast';
import { useAuth } from './auth';

export function useActiveCompany() {
  const { user, activeCompanyName } = useAuth();
  const { showToast } = useToast();
  const companyId = user?.activeCompanyId ?? null;
  const warnedRef = useRef(false);

  useEffect(() => {
    if (user && companyId == null && !warnedRef.current) {
      warnedRef.current = true;
      showToast('No active company selected. Open a company first.', 'error');
    }
  }, [user, companyId, showToast]);

  return { companyId, companyName: activeCompanyName, user };
}
