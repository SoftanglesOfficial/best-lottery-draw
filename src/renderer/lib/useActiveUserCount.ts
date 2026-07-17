import { useEffect, useState } from 'react';
import { useAuth } from './auth';
import { api } from './api';

export function useActiveUserCount() {
  const { user } = useAuth();
  const companyId = user?.activeCompanyId ?? null;
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user?.id || companyId == null) {
      setCount(0);
      return;
    }

    const ping = async () => {
      await api.sessionHeartbeat(user.id, companyId);
      const result = await api.sessionActiveCount(companyId);
      if (result.success) setCount(result.count);
    };

    void ping();
    const timer = window.setInterval(() => void ping(), 60_000);
    return () => window.clearInterval(timer);
  }, [user?.id, companyId]);

  return count;
}
