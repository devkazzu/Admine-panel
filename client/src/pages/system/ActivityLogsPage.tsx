/**
 * System → Activity Logs: read-only audit trail with filters.
 */
import { ScrollText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useApiQuery, useDebounce } from '../../lib/hooks';
import { formatDateTime } from '../../lib/format';
import { ACTION_LABELS, ACTION_TONES } from '../../lib/constants';
import type { ActivityLog } from '../../lib/types';
import { Badge, Input, PageHeader, Select } from '../../components/ui/primitives';
import { DataTable, ListToolbar } from '../../components/ui/DataTable';

function parseDetails(details: string): Record<string, unknown> | null {
  if (!details) return null;
  try {
    return JSON.parse(details);
  } catch {
    return null;
  }
}

export function ActivityLogsPage() {
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 350);
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const query = useMemo(
    () => ({ q: debounced || undefined, action: action || undefined, from: from || undefined, to: to || undefined, page, perPage: 25 }),
    [debounced, action, from, to, page],
  );
  const { data, loading, error, refetch } = useApiQuery(() => api.list<ActivityLog>('/api/admin/activity-logs', query), [query]);

  return (
    <div>
      <PageHeader title="Activity Logs" description="Audit trail of every important admin action — who did what, and when." />

      <ListToolbar
        search={search}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search user, resource…"
        filters={
          <>
            <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="w-auto" aria-label="Filter by action">
              <option value="">Action: All</option>
              {Object.entries(ACTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-auto" aria-label="From date" />
            <span className="hidden text-xs text-zinc-600 sm:block">→</span>
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-auto" aria-label="To date" />
          </>
        }
      />

      <DataTable
        columns={[
          {
            key: 'created_at',
            label: 'When',
            render: (row: ActivityLog) => <span className="whitespace-nowrap text-xs text-zinc-500">{formatDateTime(row.created_at)}</span>,
          },
          {
            key: 'user_name',
            label: 'User',
            render: (row: ActivityLog) => (
              <div className="min-w-0">
                <p className="truncate text-sm text-zinc-200">{row.user_name ?? 'System'}</p>
                <p className="truncate text-[11px] text-zinc-600">{row.user_email ?? '—'}</p>
              </div>
            ),
          },
          {
            key: 'action',
            label: 'Action',
            render: (row: ActivityLog) => <Badge tone={ACTION_TONES[row.action] ?? 'zinc'}>{ACTION_LABELS[row.action] ?? row.action}</Badge>,
          },
          {
            key: 'resource_type',
            label: 'Resource',
            render: (row: ActivityLog) => (
              <span className="text-sm text-zinc-400">
                {row.resource_type || '—'}
                {row.resource_id ? <span className="text-zinc-600"> #{row.resource_id}</span> : null}
              </span>
            ),
          },
          {
            key: 'details',
            label: 'Details',
            render: (row: ActivityLog) => {
              const details = parseDetails(row.details);
              if (!details) return <span className="text-zinc-700">—</span>;
              const text = Object.entries(details)
                .filter(([k]) => k !== 'ip')
                .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
                .join(' · ');
              return (
                <span className="block max-w-md truncate text-xs text-zinc-500" title={text}>
                  {text || '—'}
                </span>
              );
            },
          },
        ]}
        rows={data?.data ?? null}
        loading={loading}
        error={error?.message ?? null}
        onRetry={refetch}
        meta={data?.meta ?? null}
        onPageChange={setPage}
        emptyIcon={ScrollText}
        emptyTitle="No activity found"
        emptyDescription="Admin actions will be recorded here as they happen."
      />
    </div>
  );
}
