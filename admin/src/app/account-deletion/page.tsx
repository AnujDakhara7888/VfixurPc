'use client';

import { FormEvent, useRef, useState } from 'react';

const API_URL = (process.env.NEXT_PUBLIC_API_URL?.trim() ||
  'https://vfixurpc-backend-160921860149.us-central1.run.app/api/v1').replace(/\/+$/, '');

// Independent of the staff API client, cookies and AuthContext.
async function request(path: string, method: string, body: object, token?: string) {
  const response = await fetch(`${API_URL}${path}`, {
    method, credentials: 'omit', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
    throw new Error(typeof message === 'string' ? message : `Request failed (${response.status}). Please try again.`);
  }
  return data;
}

export default function DeletionPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || confirmation !== 'DELETE') return;
    inFlight.current = true;
    setBusy(true); setError('');
    try {
      // Tokens live only in this invocation; never persist or refresh this session.
      let session;
      if (!challengeId) {
        const login = await request('/auth/login', 'POST', { username: username.trim(), password });
        if (login.requiresOtp) {
          setChallengeId(login.challengeId);
          setMaskedEmail(login.maskedEmail || 'your registered email');
          return;
        }
        session = login;
      } else {
        if (!/^\d{6}$/.test(code)) throw new Error('Enter the six-digit code from your email.');
        session = await request('/auth/login/verify-otp', 'POST', { challengeId, code });
      }
      if (session.user?.role !== 'CUSTOMER') throw new Error('Staff accounts must be managed by the account owner.');
      if (typeof session.accessToken !== 'string' || !session.accessToken) throw new Error('Sign-in failed. Please try again.');
      await request('/auth/account', 'DELETE', { password, confirmation: 'DELETE' }, session.accessToken);
      setDone(true); setUsername(''); setPassword(''); setConfirmation(''); setCode(''); setChallengeId('');
    } catch (e) {
      setError(e instanceof Error && e.name !== 'TypeError' && e.name !== 'TimeoutError'
        ? e.message
        : 'The server response could not be confirmed. If deletion succeeded, you cannot sign in again. Contact support before retrying if unsure.');
    } finally {
      setBusy(false); inFlight.current = false;
    }
  }

  return (
    <main className="max-w-xl mx-auto p-6 sm:p-8">
      <h1 className="text-2xl font-bold mb-5">VfixurPC account deletion</h1>
      <p className="mb-4">Deleting permanently disables your customer account, revokes its sessions and anonymises your profile, saved device details and booking contact details. Request attachments and account notification preferences are removed.</p>
      <p className="mb-4">Invoice, tax, quote and warranty records remain separate and may still identify you. Condition photos are retained as warranty or dispute evidence, not as general request uploads. Previously sent messages and backup copies are not erased by this action. Contact support to request review of retained data.</p>
      <p className="mb-6">An ongoing repair is not cancelled. Keep your request number and arrange any outstanding handover with support before deleting. Account access cannot be restored.</p>
      {done ? <p role="status" className="font-semibold mb-6">Your account access has been removed and your profile anonymised. No customer sign-in was saved in this browser. The retained records described above have not been erased.</p> : (
        <form onSubmit={remove} className="space-y-4 mb-6">
          <fieldset disabled={busy} className="space-y-4">
            <label className="block">Username
              <input className="block w-full border rounded p-3 mt-1" autoComplete="username" autoCapitalize="none" required value={username} onChange={e => { setUsername(e.target.value); setChallengeId(''); setCode(''); }} />
            </label>
            <label className="block">Confirm your password
              <input className="block w-full border rounded p-3 mt-1" type="password" autoComplete="current-password" required maxLength={64} value={password} onChange={e => { setPassword(e.target.value); setChallengeId(''); setCode(''); }} />
            </label>
            {!!challengeId && <label className="block">Email verification code
              <span className="block text-sm text-gray-600 mt-1">Enter the six-digit code sent to {maskedEmail}.</span>
              <input className="block w-full border rounded p-3 mt-1" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            </label>}
            <label className="block">Type DELETE to confirm permanent account deletion
              <input className="block w-full border rounded p-3 mt-1" autoComplete="off" autoCapitalize="characters" spellCheck={false} required pattern="DELETE" value={confirmation} onChange={e => setConfirmation(e.target.value)} />
            </label>
            {!!error && <p role="alert" className="text-red-700">{error}</p>}
            <button type="submit" disabled={busy || !username.trim() || !password || confirmation !== 'DELETE' || (!!challengeId && code.length !== 6)} className="bg-red-700 text-white rounded px-4 py-3 disabled:opacity-50">
              {busy ? 'Working...' : challengeId ? 'Verify and permanently delete my account' : 'Permanently delete my account'}
            </button>
          </fieldset>
        </form>
      )}
      <p className="mb-4">Cannot sign in? Email from your registered address to request deletion. Support will need to verify your identity. Never send your password.</p>
      <a className="text-brand-800 underline" href="mailto:contact@vfixurpc.com?subject=VfixurPC%20account%20deletion%20request">Request deletion by email</a>
      <p className="mt-4"><a className="text-brand-800 underline" href="/privacy">Privacy policy and retained records</a></p>
    </main>
  );
}
