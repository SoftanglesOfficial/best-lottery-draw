import { useEffect, useState } from 'react';
import { useAuth } from './auth';
import { useActiveCompany } from './useActiveCompany';
import { sessionActiveCount, sessionHeartbeat } from './api';

export function useActiveUserCount() {
  const { user } = useAuth();
  const { companyId } = useActiveCompany();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user?.id || companyId == null) {
      setCount(0);
      return;
    }

    const ping = async () => {
      await sessionHeartbeat(user.id, companyId);
      const result = await sessionActiveCount(companyId);
      if (result.success) setCount(result.count);
    };

    void ping();
    const timer = window.setInterval(() => void ping(), 60_000);
    return () => window.clearInterval(timer);
  }, [user?.id, companyId]);

  return count;
}
