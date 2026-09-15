/**
 * RJNX Website → Contact Messages: submissions from the public contact form.
 * Statuses: unread → read → replied → archived.
 */
import { Archive, Mail, MailOpen, Reply, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useApiQuery, useDebounce } from '../../lib/hooks';
import { formatDateTime, timeAgo } from '../../lib/format';
import { MESSAGE_STATUS } from '../../lib/constants';
import type { ContactMessage } from '../../lib/types';
import { Badge, Button, PageHeader, Select } from '../../components/ui/primitives';
import { DataTable, ListToolbar } from '../../components/ui/DataTable';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../auth/AuthContext';

export function MessagesPage() {
  const { hasPerm } = useAuth();
  const canWrite = hasPerm('messages:write');
  const { success, error: toastError } = useToast();

  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 350);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContactMessage | null>(null);
  const [busy, setBusy] = useState(false);

  const query = useMemo(
    () => ({ q: debounced || undefined, status: status || undefined, page, perPage: 20 }),
    [debounced, status, page],
  );
  const { data, loading, error, refetch } = useApiQuery(() => api.list<ContactMessage>('/api/admin/website/messages', query), [query]);

  const setStatusFor = async (message: ContactMessage, next: ContactMessage['status']) => {
    setBusy(true);
    try {
      const res = await api.patch<ContactMessage>(`/api/admin/website/messages/${message.id}/status`, { status: next });
      success(`Marked as ${next}`);
      if (selected?.id === message.id) setSelected(res);
      refetch();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.del(`/api/admin/website/messages/${deleteTarget.id}`);
      success('Message deleted');
      if (selected?.id === deleteTarget.id) setSelected(null);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Contact Messages" description="Messages submitted through the RJNX website contact form." />

      <ListToolbar
        search={search}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search name, email, subject…"
        filters={
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-auto" aria-label="Filter by status">
            <option value="">Status: All</option>
            {Object.entries(MESSAGE_STATUS).map(([value, m]) => (
              <option key={value} value={value}>
                {m.label}
              </option>
            ))}
          </Select>
        }
      />

      <DataTable
        columns={[
          {
            key: 'name',
            label: 'From',
            render: (row) => (
              <div>
                <p className={`font-medium ${row.status === 'unread' ? 'text-white' : 'text-zinc-300'}`}>{row.name}</p>
                <a href={`mailto:${row.email}`} className="text-xs text-violet-400 hover:text-violet-300">
                  {row.email}
                </a>
              </div>
            ),
          },
          {
            key: 'subject',
            label: 'Subject',
            render: (row) => (
              <div className="max-w-md">
                <p className={`truncate ${row.status === 'unread' ? 'font-medium text-zinc-100' : 'text-zinc-300'}`}>
                  {row.subject || '(no subject)'}
                </p>
                <p className="truncate text-xs text-zinc-600">{row.message}</p>
              </div>
            ),
          },
          { key: 'status', label: 'Status', render: (row) => <Badge tone={MESSAGE_STATUS[row.status]?.tone}>{MESSAGE_STATUS[row.status]?.label}</Badge> },
          { key: 'created_at', label: 'Received', render: (row) => <span className="whitespace-nowrap text-xs text-zinc-500">{timeAgo(row.created_at)}</span> },
        ]}
        rows={data?.data ?? null}
        loading={loading}
        error={error?.message ?? null}
        onRetry={refetch}
        meta={data?.meta ?? null}
        onPageChange={setPage}
        emptyIcon={Mail}
        emptyTitle="No messages"
        emptyDescription="Contact form submissions will appear here."
        rowActions={(row) => (
          <>
            <Button size="sm" variant="outline" onClick={() => setSelected(row)}>
              <MailOpen size={13} /> Open
            </Button>
            {canWrite && row.status === 'unread' && (
              <Button size="icon" variant="ghost" title="Mark as read" aria-label="Mark as read" onClick={() => setStatusFor(row, 'read')}>
                <MailOpen size={14} />
              </Button>
            )}
            {canWrite && (
              <Button size="icon" variant="ghost" title="Delete" aria-label="Delete" className="hover:text-rose-400" onClick={() => setDeleteTarget(row)}>
                <Trash2 size={14} />
              </Button>
            )}
          </>
        )}
      />

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.subject || '(no subject)'}
        description={selected ? `From ${selected.name} · ${formatDateTime(selected.created_at)}` : undefined}
        footer={
          selected ? (
            <>
              <div className="mr-auto flex flex-wrap gap-1.5">
                {canWrite && selected.status !== 'read' && (
                  <Button size="sm" variant="outline" onClick={() => setStatusFor(selected, 'read')} disabled={busy}>
                    <MailOpen size={13} /> Mark read
                  </Button>
                )}
                {canWrite && (
                  <Button size="sm" variant="outline" onClick={() => setStatusFor(selected, 'replied')} disabled={busy}>
                    <Reply size={13} /> Mark replied
                  </Button>
                )}
                {canWrite && (
                  <Button size="sm" variant="outline" onClick={() => setStatusFor(selected, 'archived')} disabled={busy}>
                    <Archive size={13} /> Archive
                  </Button>
                )}
                {canWrite && (
                  <Button size="sm" variant="ghost" className="text-rose-400" onClick={() => setDeleteTarget(selected)} disabled={busy}>
                    <Trash2 size={13} /> Delete
                  </Button>
                )}
              </div>
              <a
                href={`mailto:${selected.email}?subject=${encodeURIComponent(`Re: ${selected.subject || 'Your message'}`)}`}
                className="inline-flex"
              >
                <Button variant="primary">
                  <Reply size={14} /> Reply by email
                </Button>
              </a>
            </>
          ) : undefined
        }
      >
        {selected && (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <Badge tone={MESSAGE_STATUS[selected.status]?.tone}>{MESSAGE_STATUS[selected.status]?.label}</Badge>
              <span>{selected.email}</span>
            </div>
            <div className="whitespace-pre-wrap rounded-lg bg-zinc-950/60 p-4 text-sm leading-6 text-zinc-300 ring-1 ring-white/5">
              {selected.message}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={busy}
        title="Delete message"
        message={
          <>
            Delete the message from <span className="font-medium text-zinc-200">{deleteTarget?.name}</span>? This cannot be
            undone.
          </>
        }
      />
    </div>
  );
}
