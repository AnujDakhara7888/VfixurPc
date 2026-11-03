import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { authApi, saveTokens, clearTokens, session, onSessionCleared } from '@/api/client';
import type { User } from '@/types';
import * as Notifications from 'expo-notifications';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  restoreError: string | null;
  retryRestore: () => Promise<void>;
  login:    (username: string, password: string) => Promise<LoginChallenge | null>;
  verifyLoginOtp: (challengeId: string, code: string) => Promise<void>;
  resendLoginOtp: (challengeId: string) => Promise<void>;
  register: (body: { name: string; email: string; phone: string; username: string; password: string; dateOfBirth?: string }) => Promise<RegistrationChallenge | null>;
  verifyRegistrationOtp: (challengeId: string, code: string) => Promise<void>;
  resendRegistrationOtp: (challengeId: string) => Promise<void>;
  requestEmailChange: (newEmail: string, password: string) => Promise<EmailChangeChallenge>;
  verifyEmailChange: (challengeId: string, code: string) => Promise<void>;
  logout:   () => Promise<void>;
}

export type LoginChallenge = { requiresOtp: true; challengeId: string; maskedEmail: string; channel: 'email'; expiresInSeconds: number };
export type RegistrationChallenge = LoginChallenge;
export type EmailChangeChallenge = { challengeId: string; maskedEmail: string; expiresInSeconds: number };

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const generation = useRef(0);
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const fetchMe = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true); setRestoreError(null);
    try {
      const access = await session.get('access_token');
      const refresh = await session.get('refresh_token');
      if (current !== generation.current) return;
      if (!access && !refresh) { setUser(null); return; }
      const me = await authApi.me();
      if (current === generation.current) setUser(me);
    } catch {
      // Definitive authentication failures are handled by onSessionCleared. A
      // network/storage failure must not discard a saved session or cached user.
      if (current === generation.current) setRestoreError('We could not restore your session. Check your connection and retry.');
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => onSessionCleared(() => { generation.current++; setUser(null); setRestoreError(null); setLoading(false); }), []);
  useEffect(() => { void fetchMe(); return () => { generation.current++; }; }, [fetchMe]);

  const login = async (username: string, password: string) => {
    const current = ++generation.current;
    const data = await authApi.login(username, password);
    if (current !== generation.current) return null;
    if (data.requiresOtp) return data as LoginChallenge;
    await saveTokens(data.accessToken, data.refreshToken);
    if (current === generation.current) { setUser(data.user); setRestoreError(null); setLoading(false); }
    return null;
  };

  const verifyLoginOtp = async (challengeId: string, code: string) => {
    const current = ++generation.current;
    const data = await authApi.verifyLoginOtp(challengeId, code);
    if (current !== generation.current) return;
    await saveTokens(data.accessToken, data.refreshToken);
    if (current === generation.current) { setUser(data.user); setRestoreError(null); setLoading(false); }
  };

  const resendLoginOtp = async (challengeId: string) => { await authApi.resendLoginOtp(challengeId); };

  const register = async (body: Parameters<typeof authApi.register>[0]) => {
    const current = ++generation.current;
    const data = await authApi.register(body);
    if (current !== generation.current) return null;
    if (data.requiresOtp) return data as RegistrationChallenge;
    await saveTokens(data.accessToken, data.refreshToken);
    if (current === generation.current) { setUser(data.user); setRestoreError(null); setLoading(false); }
    return null;
  };

  const verifyRegistrationOtp = async (challengeId: string, code: string) => {
    const current = ++generation.current;
    const data = await authApi.verifyRegistrationOtp(challengeId, code);
    if (current !== generation.current) return;
    await saveTokens(data.accessToken, data.refreshToken);
    if (current === generation.current) { setUser(data.user); setRestoreError(null); setLoading(false); }
  };

  const resendRegistrationOtp = async (challengeId: string) => { await authApi.resendRegistrationOtp(challengeId); };

  const requestEmailChange = async (newEmail: string, password: string) =>
    authApi.requestEmailChange(newEmail, password) as Promise<EmailChangeChallenge>;

  const verifyEmailChange = async (challengeId: string, code: string) => {
    const current = ++generation.current;
    const data = await authApi.verifyEmailChange(challengeId, code);
    if (current !== generation.current) return;
    await saveTokens(data.accessToken, data.refreshToken);
    if (current === generation.current) { setUser(data.user); setRestoreError(null); setLoading(false); }
  };

  const logout = async () => {
    generation.current++;
    try { await authApi.logout(); } catch { /* ignore */ }
    await clearTokens();
    await Notifications.setBadgeCountAsync(0).catch(()=>{});
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, restoreError, retryRestore: fetchMe, login, verifyLoginOtp, resendLoginOtp, register, verifyRegistrationOtp, resendRegistrationOtp, requestEmailChange, verifyEmailChange, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
