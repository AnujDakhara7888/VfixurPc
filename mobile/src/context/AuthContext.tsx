import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, saveTokens, clearTokens } from '@/api/client';
import type { User } from '@/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login:    (username: string, password: string) => Promise<void>;
  register: (body: { name: string; email: string; phone: string; username: string; password: string }) => Promise<void>;
  logout:   () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const login = async (username: string, password: string) => {
    const data = await authApi.login(username, password);
    await saveTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  };

  const register = async (body: Parameters<typeof authApi.register>[0]) => {
    const data = await authApi.register(body);
    await saveTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  };

  const logout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    await clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
