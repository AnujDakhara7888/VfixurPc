'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, authApi, saveTokens, clearTokens } from '@/lib/api';
import axios from 'axios';
import Cookies from 'js-cookie';
import { usePathname } from 'next/navigation';
import type { User } from '@/types';
import { useQueryClient } from '@tanstack/react-query';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const publicPage = ['/account-deletion', '/privacy', '/terms', '/login'].includes(pathname?.replace(/\/+$/, '') || '/');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async (signal: AbortSignal) => {
    // Bootstrap cannot use the shared redirecting interceptor: navigation to a
    // public page must cancel even a pending refresh without changing staff cookies.
    const access = Cookies.get('access_token');
    const refresh = Cookies.get('refresh_token');
    const unchanged = () => !signal.aborted && Cookies.get('access_token') === access && Cookies.get('refresh_token') === refresh;
    if (!access && !refresh) { setUser(null); setLoading(false); return; }
    const client = axios.create({ baseURL: api.defaults.baseURL, signal, timeout: 15000 });
    setLoading(true);
    try {
      let me;
      try {
        me = await client.get('/users/me', { headers: access ? { Authorization: `Bearer ${access}` } : {} });
        if (!unchanged()) return;
      } catch (error) {
        if (!axios.isAxiosError(error) || error.response?.status !== 401 || !refresh || !unchanged()) throw error;
        const { data } = await client.post('/auth/refresh', { refreshToken: refresh });
        if (!unchanged()) return;
        me = await client.get('/users/me', { headers: { Authorization: `Bearer ${data.accessToken}` } });
        if (!unchanged()) return;
        saveTokens(data.accessToken, data.refreshToken);
      }
      if (!signal.aborted) setUser(me.data);
    } catch (error) {
      if (unchanged() && axios.isAxiosError(error) && [400, 401, 403].includes(error.response?.status ?? 0)) {
        clearTokens(); setUser(null);
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (publicPage) { setLoading(false); return; }
    const controller = new AbortController();
    void fetchMe(controller.signal);
    return () => controller.abort();
  }, [fetchMe, publicPage]);

  const login = async (username: string, password: string) => {
    const data = await authApi.login(username, password);
    saveTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  };

  const logout = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration('/');
        const subscription = await registration?.pushManager?.getSubscription();
        await subscription?.unsubscribe();
      } catch { /* Server logout also removes subscriptions. */ }
    }
    localStorage.removeItem('push-user');
    try { await authApi.logout(); } catch { /* ignore */ }
    clearTokens();
    queryClient.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
