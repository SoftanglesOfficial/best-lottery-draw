import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from './api';
import type { ActiveShift, SessionUser } from '../../shared/types';

interface AuthContextValue {
  user: SessionUser | null;
  activeCompanyName: string | null;
  activeShift: ActiveShift | null;
  isAuthenticated: boolean;
  isRestoring: boolean;
  login: (username: string, password: string) => Promise<{
    success: boolean;
    error?: string;
    redirectTo?: '/dashboard';
  }>;
  logout: () => void;
  setActiveCompany: (user: SessionUser, companyName: string) => void;
  setActiveShift: (shift: ActiveShift | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toSessionUser(user: SessionUser & { createdAt?: Date | null; updatedAt?: Date | null }): SessionUser {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    companyId: user.companyId,
    activeCompanyId: user.activeCompanyId,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeCompanyName, setActiveCompanyName] = useState<string | null>(null);
  const [activeShift, setActiveShift] = useState<ActiveShift | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const result = await api.authRestore();
        if (result.success) {
          let restoredShift: ActiveShift | null = null;
          if (result.user.activeCompanyId != null) {
            const shiftResult = await api.shiftsGetActive();
            restoredShift = shiftResult.success ? shiftResult.shift : null;
          }
          setUser(toSessionUser(result.user));
          setActiveCompanyName(result.companyName ?? null);
          setActiveShift(restoredShift);
        }
      } finally {
        setIsRestoring(false);
      }
    })();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await api.authLogin(username, password);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    const sessionUser = { ...toSessionUser(result.user), activeCompanyId: null };
    setUser(sessionUser);
    setActiveCompanyName(null);
    setActiveShift(null);
    return { success: true, redirectTo: '/dashboard' as const };
  }, []);

  const logout = useCallback(async () => {
    await api.authLogout();
    setUser(null);
    setActiveCompanyName(null);
    setActiveShift(null);
    navigate('/');
  }, [navigate]);

  const setActiveCompany = useCallback((updatedUser: SessionUser, companyName: string) => {
    setUser(toSessionUser(updatedUser));
    setActiveCompanyName(companyName);
    setActiveShift(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      activeCompanyName,
      activeShift,
      isAuthenticated: user !== null,
      isRestoring,
      login,
      logout,
      setActiveCompany,
      setActiveShift,
    }),
    [user, activeCompanyName, activeShift, isRestoring, login, logout, setActiveCompany],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export { AuthContext };
