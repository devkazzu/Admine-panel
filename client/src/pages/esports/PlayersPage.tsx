/**
 * RJNX Esports → Players: CRUD with team assignment, socials and manually
 * configured statistics.
 */
import { Users } from 'lucide-react';
import { useMemo } from 'react';
import { CrudPage, type FieldDef } from '../../components/crud/CrudPage';
import { Badge } from '../../components/ui/primitives';
import { PLAYER_STATUS, TEAM_STATUS } from '../../lib/constants';
import { useApiQuery } from '../../lib/hooks';
import { api } from '../../lib/api';
import type { Player, Team } from '../../lib/types';

export function useTeamOptions() {
  const { data } = useApiQuery(() => api.list<Team>('/api/admin/esports/teams', { perPage: 100 }), []);
  return useMemo(
    () => (data?.data ?? []).map((t) => ({ value: t.id, label: `${t.name}${t.game ? ` (${t.game})` : ''}` })),
    [data],
  );
}

export function PlayersPage() {
  const teamOptions = useTeamOptions();

  const fields: FieldDef[] = [
    { name: 'gamer_tag', label: 'Gamer tag', type: 'text', required: true, placeholder: 'RJNXShadow' },
    { name: 'real_name', label: 'Real name', type: 'text' },
    { name: 'game', label: 'Game', type: 'text', placeholder: 'Valorant, BGMI…' },
    { name: 'team_id', label: 'Team', type: 'select', numeric: true, options: teamOptions, help: 'Optional — free agents have no team.' },
    { name: 'role', label: 'Role', type: 'text', placeholder: 'Duelist, IGL, Support…' },
    { name: 'country', label: 'Country / region', type: 'text', placeholder: 'India' },
    { name: 'status', label: 'Status', type: 'select', options: Object.entries(PLAYER_STATUS).map(([value, m]) => ({ value, label: m.label })), defaultValue: 'active' },
    { name: 'image', label: 'Profile image', type: 'image', circular: true },
    { name: 'sort_order', label: 'Sort order', type: 'number', defaultValue: 0 },
    { name: 'biography', label: 'Biography', type: 'textarea', rows: 3 },
    { name: 'stats', label: 'Statistics', type: 'stats', help: 'Manually configured key/value pairs (e.g. K/D, HS%).' },
    { name: 'socials', label: 'Social links', type: 'socials' },
  ];

  return (
    <CrudPage
      title="Players"
      description="Roster across all teams. Active players appear on the public esports site with their stats."
      endpoint="/api/admin/esports/players"
      resource="players"
      createLabel="New player"
      searchPlaceholder="Search gamer tag, name, game…"
      fields={fields}
      defaults={{ status: 'active', stats: [], socials: {}, sort_order: 0, team_id: '' }}
      filters={[
        { name: 'status', options: Object.entries(PLAYER_STATUS).map(([value, m]) => ({ value, label: m.label })) },
      ]}
      emptyIcon={Users}
      columns={[
        {
          key: 'gamer_tag',
          label: 'Player',
          render: (row: Player) => (
            <div className="flex items-center gap-3">
              {row.image ? (
                <img src={row.image} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/10" />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 text-xs font-bold text-violet-300 ring-1 ring-white/10">
                  {row.gamer_tag.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-100">{row.gamer_tag}</p>
                <p className="truncate text-xs text-zinc-600">{row.real_name || '—'}</p>
              </div>
            </div>
          ),
        },
        { key: 'game', label: 'Game', render: (row: Player) => row.game || <span className="text-zinc-700">—</span> },
        { key: 'team_name', label: 'Team', render: (row: Player) => (row.team_name ? <span className="text-zinc-300">{row.team_name}</span> : <span className="text-zinc-700">Free agent</span>) },
        { key: 'role', label: 'Role', render: (row: Player) => row.role || <span className="text-zinc-700">—</span> },
        {
          key: 'stats',
          label: 'Stats',
          render: (row: Player) =>
            (row.stats ?? []).length > 0 ? (
              <span className="text-xs text-zinc-400">{row.stats.map((s) => `${s.label}: ${s.value}`).slice(0, 2).join(' · ')}{row.stats.length > 2 ? ' …' : ''}</span>
            ) : (
              <span className="text-zinc-700">—</span>
            ),
        },
        { key: 'status', label: 'Status', render: (row: Player) => <Badge tone={PLAYER_STATUS[row.status]?.tone}>{PLAYER_STATUS[row.status]?.label}</Badge> },
      ]}
    />
  );
}
