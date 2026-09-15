/**
 * System → Admin Users (Super Admin only): CRUD + password reset.
 * Server-side guards: last Super Admin protection, no self-delete/demote.
 */
import { KeyRound, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useApiQuery } from '../../lib/hooks';
import { formatDateTime } from '../../lib/format';
import type { AdminUser, Role } from '../../lib/types';
import { Badge, Button, FormField, Input, PageHeader } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { CrudPage, type FieldDef } from '../../components/crud/CrudPage';
import { useToast } from '../../components/ui/Toast';

const ROLE_TONES: Record<string, 'fuchsia' | 'violet' | 'sky'> = {
  super_admin: 'fuchsia',
  editor: 'violet',
  moderator: 'sky',
};

function ResetPasswordModal({ user, onClose, onDone }: { user: AdminUser | null; onClose: () => void; onDone: () => void }) {
  const { success, error: toastError } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!user) return;
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/admin/users/${user.id}/reset-password`, { newPassword: password });
      success(`Password reset for ${user.name} — their sessions were signed out`);
      onDone();
      onClose();
      setPassword('');
      setConfirm('');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Reset failed';
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title="Reset password"
      description={user ? `Set a new password for ${user.name} (${user.email})` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={saving}>
            <KeyRound size={14} /> Reset password
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-zinc-500">All active sessions of this user will be signed out.</p>
        <FormField label="New password" required help="Minimum 10 characters, at least one letter and one number.">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </FormField>
        <FormField label="Confirm password" required>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </FormField>
        {error && <p className="text-sm text-rose-400">{error}</p>}
      </div>
    </Modal>
  );
}

export function AdminUsersPage() {
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const { data: roles } = useApiQuery(() => api.get<Role[]>('/api/admin/users/roles'), []);

  const roleOptions = (roles ?? []).map((r) => ({ value: r.key, label: r.name }));

  const fields: FieldDef[] = [
    { name: 'name', label: 'Full name', type: 'text', required: true },
    { name: 'email', label: 'Email', type: 'text', required: true, placeholder: 'admin@example.com' },
    { name: 'username', label: 'Username', type: 'text', required: true, placeholder: ' lowercase, no spaces' },
    { name: 'role_key', label: 'Role', type: 'select', required: true, options: roleOptions, defaultValue: 'moderator' },
    { name: 'password', label: 'Password', type: 'password', required: true, createOnly: true, help: 'Minimum 10 characters, one letter + one number.' },
    { name: 'is_active', label: 'Account active', type: 'switch', defaultValue: true, editOnly: true },
  ];

  return (
    <>
      <CrudPage
        title="Admin Users"
        description="Accounts that can access this panel. Roles control what each account can do."
        endpoint="/api/admin/users"
        resource="admin_users"
        createLabel="New admin user"
        searchPlaceholder="Search users…"
        fields={fields}
        defaults={{ role_key: 'moderator', is_active: true }}
        filters={[
          {
            name: 'role_key',
            options: roleOptions,
          },
        ]}
        emptyIcon={ShieldCheck}
        modalSize="md"
        toForm={(row) => ({
          name: row.name,
          email: row.email,
          username: row.username,
          role_key: row.role_key,
          is_active: Boolean(row.is_active),
        })}
        columns={[
          {
            key: 'name',
            label: 'User',
            render: (row: AdminUser) => (
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/40 to-fuchsia-600/40 text-xs font-bold text-white">
                  {row.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-100">{row.name}</p>
                  <p className="truncate text-xs text-zinc-600">
                    {row.email} · @{row.username}
                  </p>
                </div>
              </div>
            ),
          },
          {
            key: 'role_key',
            label: 'Role',
            render: (row: AdminUser) => <Badge tone={ROLE_TONES[row.role_key] ?? 'zinc'}>{row.role_name}</Badge>,
          },
          {
            key: 'is_active',
            label: 'Status',
            render: (row: AdminUser) => (
              <Badge tone={row.is_active ? 'emerald' : 'zinc'}>{row.is_active ? 'Active' : 'Deactivated'}</Badge>
            ),
          },
          {
            key: 'last_login_at',
            label: 'Last login',
            render: (row: AdminUser) => (
              <span className="whitespace-nowrap text-xs text-zinc-500">{row.last_login_at ? formatDateTime(row.last_login_at) : 'Never'}</span>
            ),
          },
        ]}
        rowActions={(row: AdminUser) => (
          <Button size="sm" variant="outline" onClick={() => setResetTarget(row)}>
            <KeyRound size={12} /> Reset password
          </Button>
        )}
      />
      <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} onDone={() => undefined} />
    </>
  );
}
