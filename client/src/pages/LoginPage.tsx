/**
 * Login + password-reset pages. Errors are surfaced from the API; no secrets
 * or credentials are ever stored in frontend code.
 */
import { KeyRound, Lock, LogIn, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { Button, FormField, Input } from '../components/ui/primitives';
import { useToast } from '../components/ui/Toast';

function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden lg:flex lg:w-[42%] lg:flex-col lg:justify-between lg:p-10">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/25 via-zinc-950 to-fuchsia-600/20" />
      <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-violet-600/30 blur-[100px]" />
      <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-fuchsia-600/20 blur-[110px]" />
      <div className="relative flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 font-display text-xl font-bold text-white shadow-glow">
          R
        </div>
        <div>
          <p className="font-display text-lg font-bold tracking-wide text-white">RJNX ADMIN</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Central Management Dashboard</p>
        </div>
      </div>
      <div className="relative">
        <h2 className="font-display text-3xl font-bold leading-tight text-white">
          One panel.
          <br />
          Two websites.
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-400">
          Manage the RJNX personal website and RJNX Esports — teams, players, matches, news, media and more — from a single
          secure control center.
        </p>
      </div>
      <div className="relative flex items-center gap-2 text-xs text-zinc-500">
        <ShieldCheck size={14} className="text-violet-400" />
        Secure session authentication · Role-based access control
      </div>
    </div>
  );
}

export function LoginPage() {
  const { login, status } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  if (status === 'authenticated') return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(identifier, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const submitForgot = async (e: FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMessage(null);
    try {
      const res = await api.post<{ message: string }>('/api/auth/forgot-password', { email: forgotEmail });
      setForgotMessage(res.message);
    } catch (err) {
      setForgotMessage(err instanceof ApiError ? err.message : 'Request failed');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-950">
      <BrandPanel />
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 font-display text-lg font-bold text-white shadow-glow">
              R
            </div>
            <div>
              <p className="font-display text-base font-bold tracking-wide text-white">RJNX ADMIN</p>
              <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500">Central Management</p>
            </div>
          </div>

          <h1 className="font-display text-2xl font-bold text-white">Welcome back</h1>
          <p className="mt-1 text-sm text-zinc-500">Sign in to manage RJNX content.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {error && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300" role="alert">
                {error}
              </div>
            )}
            <FormField label="Email or username" required>
              <Input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="admin@rjnx.local"
                autoComplete="username"
                autoFocus
                required
              />
            </FormField>
            <FormField label="Password" required>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                autoComplete="current-password"
                required
              />
            </FormField>
            <Button type="submit" variant="primary" loading={loading} className="h-10 w-full">
              <LogIn size={15} /> Sign in
            </Button>
          </form>

          <button
            onClick={() => {
              setForgotOpen((o) => !o);
              setForgotMessage(null);
            }}
            className="mt-5 text-xs text-zinc-500 transition hover:text-violet-400"
          >
            Forgot your password?
          </button>

          {forgotOpen && (
            <form onSubmit={submitForgot} className="mt-3 rounded-xl border border-white/10 bg-zinc-900/60 p-4">
              <FormField label="Account email" help="A reset link will be sent (or printed in the server log when mail is not configured).">
                <Input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="you@example.com" required />
              </FormField>
              <Button type="submit" variant="outline" size="sm" loading={forgotLoading} className="mt-3">
                <KeyRound size={13} /> Send reset link
              </Button>
              {forgotMessage && <p className="mt-3 text-xs leading-5 text-zinc-400">{forgotMessage}</p>}
            </form>
          )}

          <p className="mt-10 flex items-center gap-1.5 text-[11px] text-zinc-700">
            <Lock size={11} /> Authorized personnel only. All activity is logged.
          </p>
        </div>
      </div>
    </div>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { success, error: toastError } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', { token, newPassword });
      success('Password updated — you can sign in now');
      setDone(true);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Reset failed';
      setError(message);
      toastError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 font-display text-lg font-bold text-white shadow-glow">
            R
          </div>
          <p className="font-display text-base font-bold tracking-wide text-white">RJNX ADMIN</p>
        </div>
        {done ? (
          <div className="rj-card p-6 text-center">
            <p className="text-sm text-zinc-300">Your password has been reset.</p>
            <Link to="/login" className="mt-4 inline-block text-sm text-violet-400 hover:text-violet-300">
              Continue to sign in →
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="rj-card space-y-4 p-6">
            <div>
              <h1 className="font-display text-lg font-bold text-white">Choose a new password</h1>
              <p className="mt-1 text-xs text-zinc-500">Minimum 10 characters.</p>
            </div>
            {!token && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-300">
                This link is missing its token — request a new reset link from the sign-in page.
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300" role="alert">
                {error}
              </div>
            )}
            <FormField label="New password" required>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" required minLength={10} />
            </FormField>
            <FormField label="Confirm password" required>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required minLength={10} />
            </FormField>
            <Button type="submit" variant="primary" loading={loading} className="h-10 w-full" disabled={!token}>
              <KeyRound size={15} /> Reset password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
