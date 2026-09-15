/**
 * Profile: account info + change password (current password required).
 */
import { KeyRound, LogOut, Save, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Button, FormField, Input, PageHeader } from '../../components/ui/primitives';
import { useToast } from '../../components/ui/Toast';
import type { CurrentUser } from '../../lib/types';

export function ProfilePage() {
  const { user, logout } = useAuth();
  const { success, error: toastError } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!user) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      setErrors({ confirm: 'Passwords do not match' });
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      await api.put('/api/auth/change-password', { currentPassword, newPassword });
      success('Password changed — other sessions were signed out');
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setErrors(err.fieldErrors());
        toastError('Please fix the highlighted fields');
      } else {
        toastError(err instanceof ApiError ? err.message : 'Change failed');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Profile" description="Your account and security settings." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rj-card h-fit p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 font-display text-xl font-bold text-white shadow-glow">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-bold text-white">{user.name}</p>
              <p className="truncate text-sm text-zinc-500">{user.email}</p>
              <Badge tone={user.roleKey === 'super_admin' ? 'fuchsia' : user.roleKey === 'editor' ? 'violet' : 'sky'} className="mt-1">
                <ShieldCheck size={11} /> {user.roleName}
              </Badge>
            </div>
          </div>
          <dl className="mt-6 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Username</dt>
              <dd className="text-zinc-300">@{user.username}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Permissions</dt>
              <dd className="text-zinc-300">{user.permissions.includes('*') ? 'Full access' : `${user.permissions.length} permissions`}</dd>
            </div>
          </dl>
          <Button variant="ghost" className="mt-6 text-rose-400" onClick={() => void logout()}>
            <LogOut size={14} /> Sign out
          </Button>
        </div>

        <form onSubmit={submit} className="rj-card h-fit space-y-4 p-6">
          <h2 className="font-display text-base font-semibold text-white">Change password</h2>
          <FormField label="Current password" error={errors.currentPassword} required>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" required />
          </FormField>
          <FormField label="New password" error={errors.newPassword} required help="Minimum 10 characters.">
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" required minLength={10} />
          </FormField>
          <FormField label="Confirm new password" error={errors.confirm} required>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required minLength={10} />
          </FormField>
          <div className="flex justify-end border-t border-white/5 pt-4">
            <Button type="submit" variant="primary" loading={saving}>
              <Save size={14} /> Update password
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
