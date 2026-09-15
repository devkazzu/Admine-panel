/**
 * RJNX Esports → Applications: review recruitment applications and move them
 * through new → reviewing → shortlisted → accepted / rejected.
 */
import { ClipboardList, ExternalLink, Mail, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useApiQuery, useDebounce } from '../../lib/hooks';
import { formatDateTime, timeAgo } from '../../lib/format';
import { APPLICATION_STATUS } from '../../lib/constants';
import type { Application } from '../../lib/types';
import { Badge, Button, PageHeader, Select, Textarea } from '../../components/ui/primitives';
import { DataTable, ListToolbar } from '../../components/ui/DataTable';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../auth/AuthContext';

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <span className="w-32 shrink-0 text-zinc-500">{label}</span>
      <span className="min-w-0 flex-1 break-words text-zinc-200">{value || <span className="text-zinc-700">—</span>}</span>
    </div>
  );
}

export function ApplicationsPage() {
  const { hasPerm } = useAuth();
  const canWrite = hasPerm('applications:write');
  const { success, error: toastError } = useToast();

  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 350);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Application | null>(null);
  const [notes, setNotes] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);
  const [busy, setBusy] = useState(false);

  const query = useMemo(() => ({ q: debounced || undefined, status: status || undefined, page, perPage: 20 }), [debounced, status, page]);
  const { data, loading, error, refetch } = useApiQuery(() => api.list<Application>('/api/admin/esports/applications', query), [query]);

  const openDetail = async (app: Application) => {
    setSelected(app);
    setNotes(app.admin_notes ?? '');
    try {
      const full = await api.get<Application>(`/api/admin/esports/applications/${app.id}`);
      setSelected(full);
      setNotes(full.admin_notes ?? '');
    } catch {
      /* keep list version */
    }
  };

  const setStatusFor = async (app: Application, next: Application['status']) => {
    setBusy(true);
    try {
      await api.patch<Application>(`/api/admin/esports/applications/${app.id}/status`, { status: next });
      success(`Marked as ${next}`);
      if (selected?.id === app.id) setSelected({ ...selected, status: next });
      refetch();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const saveNotes = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await api.patch(`/api/admin/esports/applications/${selected.id}/notes`, { admin_notes: notes });
      success('Notes saved');
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.del(`/api/admin/esports/applications/${deleteTarget.id}`);
      success('Application deleted');
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
      <PageHeader title="Applications" description="Recruitment applications submitted from the public esports website." />

      <ListToolbar
        search={search}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search name, tag, email…"
        filters={
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-auto" aria-label="Filter by status">
            <option value="">Status: All</option>
            {Object.entries(APPLICATION_STATUS).map(([value, m]) => (
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
            key: 'gamer_tag',
            label: 'Applicant',
            render: (row: Application) => (
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-100">{row.gamer_tag}</p>
                <p className="truncate text-xs text-zinc-600">
                  {row.name} · {row.age ?? '?'} yrs
                </p>
              </div>
            ),
          },
          {
            key: 'game',
            label: 'Game / role',
            render: (row: Application) => (
              <div className="min-w-0">
                <p className="truncate text-zinc-300">{row.game || '—'}</p>
                <p className="truncate text-xs text-zinc-600">{row.role || '—'}</p>
              </div>
            ),
          },
          {
            key: 'opening',
            label: 'Opening',
            render: (row: Application) => <span className="text-xs text-zinc-500">{row.opening_position ?? 'Direct application'}</span>,
          },
          { key: 'status', label: 'Status', render: (row: Application) => <Badge tone={APPLICATION_STATUS[row.status]?.tone}>{APPLICATION_STATUS[row.status]?.label}</Badge> },
          { key: 'created_at', label: 'Submitted', render: (row: Application) => <span className="whitespace-nowrap text-xs text-zinc-500">{timeAgo(row.created_at)}</span> },
        ]}
        rows={data?.data ?? null}
        loading={loading}
        error={error?.message ?? null}
        onRetry={refetch}
        meta={data?.meta ?? null}
        onPageChange={setPage}
        emptyIcon={ClipboardList}
        emptyTitle="No applications"
        emptyDescription="Applications submitted through the public recruitment form will appear here."
        rowActions={(row: Application) => (
          <>
            <Button size="sm" variant="outline" onClick={() => void openDetail(row)}>
              Review
            </Button>
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
        title={selected ? `${selected.gamer_tag} — application` : ''}
        description={selected ? `Submitted ${formatDateTime(selected.created_at)}` : undefined}
        size="lg"
        footer={
          selected ? (
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-1.5">
                {canWrite &&
                  (Object.keys(APPLICATION_STATUS) as Application['status'][]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={busy}
                      onClick={() => setStatusFor(selected, s)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset transition disabled:opacity-50 ${
                        selected.status === s
                          ? 'bg-violet-500/20 text-violet-200 ring-violet-500/40'
                          : 'bg-white/5 text-zinc-400 ring-white/10 hover:bg-white/10 hover:text-zinc-200'
                      }`}
                    >
                      {APPLICATION_STATUS[s].label}
                    </button>
                  ))}
              </div>
              <a href={`mailto:${selected.email}?subject=${encodeURIComponent(`RJNX Esports — your application`)}`} className="inline-flex">
                <Button variant="primary">
                  <Mail size={14} /> Reply by email
                </Button>
              </a>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="rounded-lg bg-zinc-950/40 px-4 py-2 ring-1 ring-white/5">
              <DetailRow label="Status" value={<Badge tone={APPLICATION_STATUS[selected.status]?.tone}>{APPLICATION_STATUS[selected.status]?.label}</Badge>} />
              <DetailRow label="Name" value={selected.name} />
              <DetailRow label="Gamer tag" value={selected.gamer_tag} />
              <DetailRow label="Email" value={<a className="text-violet-400 hover:text-violet-300" href={`mailto:${selected.email}`}>{selected.email}</a>} />
              <DetailRow label="Age" value={selected.age ?? null} />
              <DetailRow label="Game" value={selected.game} />
              <DetailRow label="Role" value={selected.role} />
              <DetailRow label="Experience" value={selected.experience} />
              <DetailRow
                label="Profile link"
                value={
                  selected.profile_link ? (
                    <a href={selected.profile_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-violet-400 hover:text-violet-300">
                      {selected.profile_link} <ExternalLink size={11} />
                    </a>
                  ) : null
                }
              />
              <DetailRow label="Opening" value={selected.opening_position ? `${selected.opening_position}${selected.opening_game ? ` (${selected.opening_game})` : ''}` : 'Direct application'} />
            </div>

            <div>
              <p className="rj-label">Message</p>
              <div className="whitespace-pre-wrap rounded-lg bg-zinc-950/60 p-4 text-sm leading-6 text-zinc-300 ring-1 ring-white/5">
                {selected.message || '—'}
              </div>
            </div>

            {canWrite && (
              <div>
                <p className="rj-label">Internal notes</p>
                <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Private notes for the team…" />
                <Button size="sm" variant="outline" className="mt-2" onClick={saveNotes} loading={busy}>
                  Save notes
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={busy}
        title="Delete application"
        message={
          <>
            Delete the application from <span className="font-medium text-zinc-200">{deleteTarget?.gamer_tag}</span>? This cannot
            be undone.
          </>
        }
      />
    </div>
  );
}
