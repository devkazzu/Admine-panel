/**
 * RJNX Esports → Matches & Results.
 * Quick actions: upcoming → live → completed (score entry, auto result),
 * plus cancel. Results view lists completed/cancelled matches.
 */
import { CalendarClock, Flag, Pencil, Play, Plus, Square, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useApiQuery, useDebounce } from '../../lib/hooks';
import { formatDateTime } from '../../lib/format';
import { MATCH_RESULT, MATCH_STATUS } from '../../lib/constants';
import type { Match, Team, Tournament } from '../../lib/types';
import { Badge, Button, FormField, Input, PageHeader, Select } from '../../components/ui/primitives';
import { DataTable, ListToolbar } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../auth/AuthContext';
import { FormFieldsGrid, rowToForm, serializeForm, type FieldDef } from '../../components/crud/CrudPage';

function useMatchFieldDefs(): FieldDef[] {
  const { data: teams } = useApiQuery(() => api.list<Team>('/api/admin/esports/teams', { perPage: 100 }), []);
  const { data: tournaments } = useApiQuery(() => api.list<Tournament>('/api/admin/esports/tournaments', { perPage: 100 }), []);
  return useMemo(
    () => [
      { name: 'team_id', label: 'RJNX team', type: 'select', numeric: true, options: (teams?.data ?? []).map((t) => ({ value: t.id, label: t.name })) },
      { name: 'opponent_name', label: 'Opponent', type: 'text', required: true },
      { name: 'game', label: 'Game', type: 'text' },
      { name: 'tournament_id', label: 'Tournament', type: 'select', numeric: true, options: (tournaments?.data ?? []).map((t) => ({ value: t.id, label: t.name })) },
      { name: 'starts_at', label: 'Date & time', type: 'datetime', required: true },
      { name: 'status', label: 'Status', type: 'select', options: Object.entries(MATCH_STATUS).map(([value, m]) => ({ value, label: m.label })), defaultValue: 'upcoming' },
      { name: 'stream_url', label: 'Stream URL', type: 'url', placeholder: 'https://youtube.com/live/…' },
      { name: 'opponent_logo', label: 'Opponent logo', type: 'image', circular: true },
      { name: 'our_score', label: 'Our score', type: 'number' },
      { name: 'opponent_score', label: 'Opponent score', type: 'number' },
      { name: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
    ],
    [teams, tournaments],
  );
}

/** Score-entry modal for completing a match. */
function CompleteMatchModal({
  match,
  onClose,
  onDone,
}: {
  match: Match | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [ourScore, setOurScore] = useState('');
  const [theirScore, setTheirScore] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!match) return;
    if (ourScore === '' || theirScore === '') {
      setError('Enter both scores to complete the match');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/admin/esports/matches/${match.id}/status`, {
        status: 'completed',
        our_score: Number(ourScore),
        opponent_score: Number(theirScore),
      });
      success('Match completed — result recorded');
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to complete match');
      toastError(err instanceof ApiError ? err.message : 'Failed to complete match');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!match}
      onClose={onClose}
      title="Complete match"
      description={match ? `${match.team_name ?? 'RJNX'} vs ${match.opponent_name}` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={saving}>
            <Square size={13} /> Complete match
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-zinc-500">The result (win/loss/draw) is derived automatically from the scores.</p>
        <div className="grid grid-cols-2 gap-4">
          <FormField label={match?.team_name ?? 'RJNX'} required>
            <Input type="number" min={0} value={ourScore} onChange={(e) => setOurScore(e.target.value)} autoFocus />
          </FormField>
          <FormField label={match?.opponent_name ?? 'Opponent'} required>
            <Input type="number" min={0} value={theirScore} onChange={(e) => setTheirScore(e.target.value)} />
          </FormField>
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
      </div>
    </Modal>
  );
}

/** Shared matches table with status quick-actions + create/edit modal. */
function MatchesSection({ mode }: { mode: 'matches' | 'results' }) {
  const { hasPerm } = useAuth();
  const canWrite = hasPerm('matches:write');
  const { success, error: toastError } = useToast();
  const fields = useMatchFieldDefs();

  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 350);
  const [status, setStatus] = useState(mode === 'results' ? 'completed' : '');
  const [page, setPage] = useState(1);
  const [completing, setCompleting] = useState<Match | null>(null);

  const [formModal, setFormModal] = useState<{ mode: 'create' | 'edit'; row: Match | null } | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const query = useMemo(
    () => ({ q: debounced || undefined, status: status || undefined, page, perPage: 20 }),
    [debounced, status, page],
  );
  const { data, loading, error, refetch } = useApiQuery(() => api.list<Match>('/api/admin/esports/matches', query), [query]);

  const openCreate = () => {
    setValues(rowToForm(fields, null));
    setFormErrors({});
    setFormModal({ mode: 'create', row: null });
  };
  const openEdit = (row: Match) => {
    setValues(rowToForm(fields, row));
    setFormErrors({});
    setFormModal({ mode: 'edit', row });
  };

  const submitForm = async () => {
    if (!formModal) return;
    setSaving(true);
    setFormErrors({});
    try {
      const payload = serializeForm(fields, values);
      if (formModal.mode === 'create') {
        await api.post('/api/admin/esports/matches', payload);
        success('Match created');
      } else {
        await api.patch(`/api/admin/esports/matches/${formModal.row!.id}`, payload);
        success('Match saved');
      }
      setFormModal(null);
      refetch();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setFormErrors(err.fieldErrors());
        toastError('Please fix the highlighted fields');
      } else {
        toastError(err instanceof ApiError ? err.message : 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const transition = async (match: Match, nextStatus: string) => {
    try {
      await api.patch(`/api/admin/esports/matches/${match.id}/status`, { status: nextStatus });
      success(nextStatus === 'live' ? 'Match is now live' : nextStatus === 'cancelled' ? 'Match cancelled' : 'Status updated');
      refetch();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Update failed');
    }
  };

  return (
    <div>
      <PageHeader
        title={mode === 'matches' ? 'Matches' : 'Results'}
        description={
          mode === 'matches'
            ? 'Schedule and manage matches — move them through upcoming → live → completed.'
            : 'Completed and cancelled matches with recorded scores.'
        }
        actions={
          canWrite && mode === 'matches' ? (
            <Button variant="primary" onClick={openCreate}>
              <Plus size={15} /> New match
            </Button>
          ) : undefined
        }
      />

      <ListToolbar
        search={search}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search opponent, game…"
        filters={
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-auto" aria-label="Filter by status">
            <option value="">Status: All</option>
            {Object.entries(MATCH_STATUS).map(([value, m]) => (
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
            key: 'match',
            label: 'Match',
            render: (row: Match) => (
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate font-medium text-zinc-100">
                  {row.team_name ?? 'RJNX'} <span className="text-zinc-600">vs</span> {row.opponent_name}
                  {row.status === 'live' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-300 ring-1 ring-inset ring-rose-500/40">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" /> Live
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-zinc-600">
                  {row.game || '—'}
                  {row.tournament_name ? ` · ${row.tournament_name}` : ''}
                </p>
              </div>
            ),
          },
          { key: 'starts_at', label: 'When', render: (row: Match) => <span className="whitespace-nowrap text-xs text-zinc-400">{formatDateTime(row.starts_at)}</span> },
          {
            key: 'score',
            label: 'Score',
            render: (row: Match) =>
              row.our_score != null && row.opponent_score != null ? (
                <span className={`font-display text-sm font-bold ${row.result === 'win' ? 'text-emerald-400' : row.result === 'loss' ? 'text-rose-400' : 'text-amber-400'}`}>
                  {row.our_score} : {row.opponent_score}
                </span>
              ) : (
                <span className="text-zinc-700">—</span>
              ),
          },
          {
            key: 'result',
            label: 'Result',
            render: (row: Match) =>
              row.status === 'completed' ? <Badge tone={MATCH_RESULT[row.result]?.tone}>{MATCH_RESULT[row.result]?.label}</Badge> : <span className="text-zinc-700">—</span>,
          },
          { key: 'status', label: 'Status', render: (row: Match) => <Badge tone={MATCH_STATUS[row.status]?.tone}>{MATCH_STATUS[row.status]?.label}</Badge> },
        ]}
        rows={data?.data ?? null}
        loading={loading}
        error={error?.message ?? null}
        onRetry={refetch}
        meta={data?.meta ?? null}
        onPageChange={setPage}
        emptyIcon={mode === 'results' ? Flag : CalendarClock}
        emptyTitle={mode === 'results' ? 'No results yet' : 'No matches scheduled'}
        emptyDescription={
          mode === 'results' ? 'Complete a match with scores to record a result.' : 'Create the first match to build the schedule.'
        }
        emptyAction={
          canWrite && mode === 'matches' ? (
            <Button variant="primary" size="sm" onClick={openCreate}>
              <Plus size={14} /> New match
            </Button>
          ) : undefined
        }
        rowActions={(row: Match) => (
          <>
            {canWrite && row.status === 'upcoming' && (
              <Button size="icon" variant="ghost" title="Start match (go live)" aria-label="Go live" className="hover:text-rose-400" onClick={() => transition(row, 'live')}>
                <Play size={14} />
              </Button>
            )}
            {canWrite && (row.status === 'live' || row.status === 'upcoming') && (
              <Button size="sm" variant="outline" onClick={() => setCompleting(row)}>
                <Square size={12} /> Complete
              </Button>
            )}
            {canWrite && row.status !== 'completed' && row.status !== 'cancelled' && (
              <Button size="icon" variant="ghost" title="Cancel match" aria-label="Cancel match" className="hover:text-amber-400" onClick={() => transition(row, 'cancelled')}>
                <XCircle size={14} />
              </Button>
            )}
            {canWrite && mode === 'matches' && (
              <Button size="icon" variant="ghost" title="Edit match" aria-label="Edit match" onClick={() => openEdit(row)}>
                <Pencil size={14} />
              </Button>
            )}
          </>
        )}
      />

      <CompleteMatchModal match={completing} onClose={() => setCompleting(null)} onDone={refetch} />

      <Modal
        open={!!formModal}
        onClose={() => setFormModal(null)}
        title={formModal?.mode === 'create' ? 'New match' : 'Edit match'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormModal(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitForm} loading={saving}>
              {formModal?.mode === 'create' ? 'Create match' : 'Save changes'}
            </Button>
          </>
        }
      >
        <FormFieldsGrid fields={fields} values={values} errors={formErrors} setValues={setValues} isEdit={formModal?.mode === 'edit'} />
      </Modal>
    </div>
  );
}

export function MatchesPage() {
  return <MatchesSection mode="matches" />;
}

export function ResultsPage() {
  return <MatchesSection mode="results" />;
}
