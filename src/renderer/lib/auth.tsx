import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { authLogin, userSetActiveCompany } from './api';
import type { SessionUser } from '../../shared/types';

interface AuthContextValue {
  user: SessionUser | null;
  activeCompanyName: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{
    success: boolean;
    error?: string;
    redirectTo?: '/dashboard' | '/open-company';
  }>;
  logout: () => void;
  setActiveCompany: (user: SessionUser, companyName: string) => void;
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

  const login = useCallback(async (username: string, password: string) => {
    const result = await authLogin(username, password);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    const sessionUser = toSessionUser(result.user);
    setUser(sessionUser);

    if (sessionUser.activeCompanyId != null) {
      const active = await userSetActiveCompany(sessionUser.id, sessionUser.activeCompanyId);
      if (active.success) {
        setUser(toSessionUser(active.user));
        setActiveCompanyName(active.companyName);
        return { success: true, redirectTo: '/dashboard' as const };
      }
      setActiveCompanyName(null);
    } else {
      setActiveCompanyName(null);
    }

    return { success: true, redirectTo: '/open-company' as const };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setActiveCompanyName(null);
    navigate('/');
  }, [navigate]);

  const setActiveCompany = useCallback((updatedUser: SessionUser, companyName: string) => {
    setUser(toSessionUser(updatedUser));
    setActiveCompanyName(companyName);
  }, []);

  const value = useMemo(
    () => ({
      user,
      activeCompanyName,
      isAuthenticated: user !== null,
      login,
      logout,
      setActiveCompany,
    }),
    [user, activeCompanyName, login, logout, setActiveCompany],
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
