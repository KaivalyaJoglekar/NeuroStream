'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { login, register } from '../services/auth.service';
import {
  clearStoredToken,
  clearStoredUser,
  getStoredToken,
  getStoredUser,
  setStoredToken,
  setStoredUser,
} from '../lib/storage';
import { User } from '../types/domain';

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isReady: boolean;
  loginAction: (payload: { email: string; password: string }) => Promise<{ ok: boolean; error?: string }>;
  registerAction: (payload: { name: string; email: string; password: string }) => Promise<{ ok: boolean; error?: string }>;
  logoutAction: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const storedUser = getStoredUser();
    const storedToken = getStoredToken();

    if (storedUser && storedToken) {
      setUser(storedUser);
      setToken(storedToken);
    }

    setIsReady(true);
  }, []);

  const loginAction = useCallback(async (payload: { email: string; password: string }) => {
    const response = await login(payload);

    if (!response.success || !response.data) {
      return {
        ok: false,
        error: response.error ?? 'Unable to login.',
      };
    }

    setStoredToken(response.data.token);
    setStoredUser(response.data.user);
    setUser(response.data.user);
    setToken(response.data.token);

    return { ok: true };
  }, []);

  const registerAction = useCallback(async (payload: { name: string; email: string; password: string }) => {
    const response = await register(payload);

    if (!response.success || !response.data) {
      return {
        ok: false,
        error: response.error ?? 'Unable to register.',
      };
    }

    setStoredToken(response.data.token);
    setStoredUser(response.data.user);
    setUser(response.data.user);
    setToken(response.data.token);

    return { ok: true };
  }, []);

  const logoutAction = useCallback(() => {
    clearStoredToken();
    clearStoredUser();
    setUser(null);
    setToken(null);
    router.push('/login');
  }, [router]);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isReady,
      loginAction,
      registerAction,
      logoutAction,
    }),
    [isReady, loginAction, logoutAction, registerAction, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return context;
}
