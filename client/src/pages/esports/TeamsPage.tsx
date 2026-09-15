/**
 * RJNX Esports → Teams: CRUD with Active / Inactive / Recruiting statuses.
 */
import { Gamepad2 } from 'lucide-react';
import { CrudPage, type FieldDef } from '../../components/crud/CrudPage';
import { Badge } from '../../components/ui/primitives';
import { TEAM_STATUS } from '../../lib/constants';
import type { Team } from '../../lib/types';

const fields: FieldDef[] = [
  { name: 'name', label: 'Team name', type: 'text', required: true, placeholder: 'RJNX Valorant' },
  { name: 'slug', label: 'Slug', type: 'text', placeholder: 'auto-generated from name' },
  { name: 'game', label: 'Game', type: 'text', placeholder: 'Valorant, BGMI…' },
  { name: 'status', label: 'Status', type: 'select', options: Object.entries(TEAM_STATUS).map(([value, m]) => ({ value, label: m.label })), defaultValue: 'active' },
  { name: 'logo', label: 'Team logo', type: 'image', circular: true },
  { name: 'sort_order', label: 'Sort order', type: 'number', defaultValue: 0 },
  { name: 'description', label: 'Description', type: 'textarea', rows: 3 },
  { name: 'socials', label: 'Team social links', type: 'socials', help: 'Shown on the public team profile.' },
];

export function TeamsPage() {
  return (
    <CrudPage
      title="Teams"
      description="Esports teams. Active and recruiting teams (with their players) appear on the public esports site."
      endpoint="/api/admin/esports/teams"
      resource="teams"
      createLabel="New team"
      searchPlaceholder="Search teams…"
      fields={fields}
      defaults={{ status: 'active', socials: {}, sort_order: 0 }}
      filters={[
        { name: 'status', options: Object.entries(TEAM_STATUS).map(([value, m]) => ({ value, label: m.label })) },
      ]}
      emptyIcon={Gamepad2}
      columns={[
        {
          key: 'name',
          label: 'Team',
          render: (row: Team) => (
            <div className="flex items-center gap-3">
              {row.logo ? (
                <img src={row.logo} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/10" />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
                  <Gamepad2 size={14} className="text-zinc-600" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-100">{row.name}</p>
                <p className="truncate text-xs text-zinc-600">{row.game || '—'}</p>
              </div>
            </div>
          ),
        },
        { key: 'slug', label: 'Slug', render: (row: Team) => <span className="text-xs text-zinc-600">/{row.slug}</span> },
        { key: 'status', label: 'Status', render: (row: Team) => <Badge tone={TEAM_STATUS[row.status]?.tone}>{TEAM_STATUS[row.status]?.label}</Badge> },
        {
          key: 'socials',
          label: 'Socials',
          render: (row: Team) => {
            const n = Object.keys(row.socials ?? {}).length;
            return n > 0 ? <span className="text-xs text-zinc-400">{n} link{n > 1 ? 's' : ''}</span> : <span className="text-zinc-700">—</span>;
          },
        },
      ]}
    />
  );
}
