import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useConnectionStatus } from './useConnectionStatus';
import { api } from './api';

interface ConnectionContextValue {
  isConnected: boolean;
  reconnect: () => Promise<void>;
}

const ConnectionContext = createContext<ConnectionContextValue>({
  isConnected: true,
  reconnect: async () => undefined,
});

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const isConnected = useConnectionStatus();

  const reconnect = useCallback(async () => {
    await api.dbReconnect();
  }, []);

  const value = useMemo(() => ({ isConnected, reconnect }), [isConnected, reconnect]);

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export function useDbConnection() {
  return useContext(ConnectionContext);
}
