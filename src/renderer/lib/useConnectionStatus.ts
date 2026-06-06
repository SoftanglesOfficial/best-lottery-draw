import { useEffect, useState } from 'react';

export function useConnectionStatus() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const removeLost = window.api.onDbConnectionLost(() => setIsConnected(false));
    const removeRestored = window.api.onDbConnectionRestored(() => setIsConnected(true));

    return () => {
      removeLost();
      removeRestored();
    };
  }, []);

  return isConnected;
}
