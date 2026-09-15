/**
 * RJNX Esports → Recruitment: openings with Open / Closed status + deadlines.
 */
import { CalendarClock, UserPlus } from 'lucide-react';
import { CrudPage, type FieldDef } from '../../components/crud/CrudPage';
import { Badge } from '../../components/ui/primitives';
import { OPENING_STATUS } from '../../lib/constants';
import { formatDate } from '../../lib/format';
import type { RecruitmentOpening } from '../../lib/types';

const fields: FieldDef[] = [
  { name: 'position', label: 'Position', type: 'text', required: true, placeholder: 'Valorant Player' },
  { name: 'game', label: 'Game', type: 'text' },
  { name: 'role', label: 'Role', type: 'text', placeholder: 'Duelist, IGL…' },
  { name: 'status', label: 'Status', type: 'select', options: [
    { value: 'open', label: 'Open' },
    { value: 'closed', label: 'Closed' },
  ], defaultValue: 'open' },
  { name: 'deadline', label: 'Application deadline', type: 'date', help: 'Openings past their deadline are hidden publicly.' },
  { name: 'description', label: 'Description', type: 'textarea', rows: 3 },
  { name: 'requirements', label: 'Requirements', type: 'textarea', rows: 4, help: 'One per line or free text.' },
];

export function RecruitmentPage() {
  return (
    <CrudPage
      title="Recruitment"
      description="Open positions. Openings appear on the public site and feed the application form."
      endpoint="/api/admin/esports/recruitment"
      resource="recruitment"
      createLabel="New opening"
      searchPlaceholder="Search openings…"
      fields={fields}
      defaults={{ status: 'open' }}
      filters={[{ name: 'status', options: Object.entries(OPENING_STATUS).map(([value, m]) => ({ value, label: m.label })) }]}
      emptyIcon={UserPlus}
      emptyTitle="No recruitment openings"
      emptyDescription="Create an opening to start accepting applications on the esports site."
      columns={[
        {
          key: 'position',
          label: 'Opening',
          render: (row: RecruitmentOpening) => (
            <div className="min-w-0">
              <p className="truncate font-medium text-zinc-100">{row.position}</p>
              <p className="truncate text-xs text-zinc-600">
                {row.game || '—'}
                {row.role ? ` · ${row.role}` : ''}
              </p>
            </div>
          ),
        },
        {
          key: 'deadline',
          label: 'Deadline',
          render: (row: RecruitmentOpening) =>
            row.deadline ? (
              <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-zinc-400">
                <CalendarClock size={12} /> {formatDate(row.deadline)}
              </span>
            ) : (
              <span className="text-xs text-zinc-700">No deadline</span>
            ),
        },
        { key: 'status', label: 'Status', render: (row: RecruitmentOpening) => <Badge tone={OPENING_STATUS[row.status]?.tone}>{OPENING_STATUS[row.status]?.label}</Badge> },
        {
          key: 'requirements',
          label: 'Requirements',
          render: (row: RecruitmentOpening) => (
            <p className="max-w-xs truncate text-xs text-zinc-500">{row.requirements || '—'}</p>
          ),
        },
      ]}
    />
  );
}
