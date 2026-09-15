/**
 * RJNX Esports → Tournaments: CRUD records.
 */
import { Trophy } from 'lucide-react';
import { CrudPage, type FieldDef } from '../../components/crud/CrudPage';
import { Badge } from '../../components/ui/primitives';
import { TOURNAMENT_STATUS } from '../../lib/constants';
import { formatDate } from '../../lib/format';
import type { Tournament } from '../../lib/types';

const fields: FieldDef[] = [
  { name: 'name', label: 'Tournament name', type: 'text', required: true },
  { name: 'game', label: 'Game', type: 'text' },
  { name: 'organizer', label: 'Organizer', type: 'text' },
  { name: 'status', label: 'Status', type: 'select', options: Object.entries(TOURNAMENT_STATUS).map(([value, m]) => ({ value, label: m.label })), defaultValue: 'upcoming' },
  { name: 'start_date', label: 'Start date', type: 'date', required: true },
  { name: 'end_date', label: 'End date', type: 'date' },
  { name: 'location', label: 'Location', type: 'text', placeholder: 'City or platform' },
  { name: 'is_online', label: 'Online event', type: 'switch', defaultValue: false },
  { name: 'prize_pool', label: 'Prize pool', type: 'text', placeholder: 'e.g. ₹10,000' },
  { name: 'result', label: 'Result', type: 'text', placeholder: 'e.g. Top 4 finish' },
  { name: 'description', label: 'Description', type: 'textarea', rows: 3 },
];

export function TournamentsPage() {
  return (
    <CrudPage
      title="Tournaments"
      description="Tournament records — link matches to them and track results."
      endpoint="/api/admin/esports/tournaments"
      resource="tournaments"
      createLabel="New tournament"
      searchPlaceholder="Search tournaments…"
      fields={fields}
      defaults={{ status: 'upcoming', is_online: false }}
      filters={[{ name: 'status', options: Object.entries(TOURNAMENT_STATUS).map(([value, m]) => ({ value, label: m.label })) }]}
      emptyIcon={Trophy}
      columns={[
        {
          key: 'name',
          label: 'Tournament',
          render: (row: Tournament) => (
            <div className="min-w-0">
              <p className="truncate font-medium text-zinc-100">{row.name}</p>
              <p className="truncate text-xs text-zinc-600">
                {row.game || '—'}
                {row.prize_pool ? ` · ${row.prize_pool}` : ''}
              </p>
            </div>
          ),
        },
        {
          key: 'dates',
          label: 'Dates',
          render: (row: Tournament) => (
            <span className="whitespace-nowrap text-xs text-zinc-400">
              {formatDate(row.start_date)}
              {row.end_date ? ` → ${formatDate(row.end_date)}` : ''}
            </span>
          ),
        },
        {
          key: 'format',
          label: 'Format',
          render: (row: Tournament) => (
            <Badge tone={row.is_online ? 'sky' : 'violet'}>{row.is_online ? 'Online' : 'Offline'}</Badge>
          ),
        },
        { key: 'status', label: 'Status', render: (row: Tournament) => <Badge tone={TOURNAMENT_STATUS[row.status]?.tone}>{TOURNAMENT_STATUS[row.status]?.label}</Badge> },
        { key: 'result', label: 'Result', render: (row: Tournament) => row.result || <span className="text-zinc-700">—</span> },
      ]}
    />
  );
}
