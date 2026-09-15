/**
 * Authentication state: session persistence, login/logout, permission checks.
 * The httpOnly session cookie is the source of truth — this context simply
 * mirrors `GET /api/auth/me` and exposes `hasPerm()` for the UI.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { CurrentUser } from '../lib/types';

interface AuthState {
  user: CurrentUser | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hasPerm: (permission: string) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');

  const refresh = useCallback(async () => {
    try {
      const me = await api.get<{ user: CurrentUser }>('/api/auth/me');
      setUser(me.user);
      setStatus('authenticated');
    } catch {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onUnauthorized = () => {
      setUser(null);
      setStatus('unauthenticated');
    };
    window.addEventListener('rjnx:unauthorized', onUnauthorized);
    return () => window.removeEventListener('rjnx:unauthorized', onUnauthorized);
  }, [refresh]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const res = await api.post<{ user: CurrentUser }>('/api/auth/login', { identifier, password });
      setUser(res.user);
      setStatus('authenticated');
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  const hasPerm = useCallback(
    (permission: string) =>
      !!user && (user.permissions.includes('*') || user.permissions.includes(permission)),
    [user],
  );

  const value = useMemo(
    () => ({ user, status, login, logout, refresh, hasPerm }),
    [user, status, login, logout, refresh, hasPerm],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
