/**
 * RJNX Esports → Achievements: trophy cabinet.
 */
import { Medal } from 'lucide-react';
import { CrudPage, type FieldDef } from '../../components/crud/CrudPage';
import { formatDate } from '../../lib/format';

const fields: FieldDef[] = [
  { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Champions — Sample Cup S1' },
  { name: 'position', label: 'Position', type: 'text', placeholder: '1st, 2nd, Top 4…' },
  { name: 'game', label: 'Game', type: 'text' },
  { name: 'tournament', label: 'Tournament', type: 'text', help: 'Free text — the event this achievement was earned at.' },
  { name: 'date', label: 'Date', type: 'date', required: true },
  { name: 'image', label: 'Image', type: 'image' },
  { name: 'sort_order', label: 'Sort order', type: 'number', defaultValue: 0 },
  { name: 'description', label: 'Description', type: 'textarea', rows: 3 },
];

export function AchievementsPage() {
  return (
    <CrudPage
      title="Achievements"
      description="Trophies and placements shown in the public achievements section."
      endpoint="/api/admin/esports/achievements"
      resource="achievements"
      createLabel="New achievement"
      searchPlaceholder="Search achievements…"
      fields={fields}
      defaults={{ sort_order: 0 }}
      emptyIcon={Medal}
      columns={[
        {
          key: 'title',
          label: 'Achievement',
          render: (row) => (
            <div className="flex items-center gap-3">
              {row.image ? (
                <img src={row.image} alt="" className="h-9 w-12 shrink-0 rounded object-cover ring-1 ring-white/10" />
              ) : (
                <div className="flex h-9 w-12 shrink-0 items-center justify-center rounded bg-amber-500/10 ring-1 ring-amber-500/20">
                  <Medal size={14} className="text-amber-400" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-100">{row.title}</p>
                <p className="truncate text-xs text-zinc-600">{row.tournament || row.game || '—'}</p>
              </div>
            </div>
          ),
        },
        {
          key: 'position',
          label: 'Position',
          render: (row) =>
            row.position ? (
              <span className={`font-display text-sm font-bold ${row.position.startsWith('1') ? 'text-amber-400' : 'text-zinc-300'}`}>{row.position}</span>
            ) : (
              <span className="text-zinc-700">—</span>
            ),
        },
        { key: 'game', label: 'Game', render: (row) => row.game || <span className="text-zinc-700">—</span> },
        { key: 'date', label: 'Date', render: (row) => <span className="whitespace-nowrap text-xs text-zinc-400">{formatDate(row.date)}</span> },
      ]}
    />
  );
}
