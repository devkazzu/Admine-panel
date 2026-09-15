/**
 * Overview dashboard. Every stat is computed live from the database; charts
 * render only when real data exists (no fabricated numbers, ever).
 */
import {
  Activity, CalendarClock, ClipboardList, Flag, FolderGit2, Gamepad2, Images,
  Mail, Medal, Newspaper, Trophy, UserPlus, Users, Youtube,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useApiQuery } from '../lib/hooks';
import { formatDateTime, timeAgo } from '../lib/format';
import { ACTION_LABELS, ACTION_TONES, APPLICATION_STATUS, MATCH_STATUS, MESSAGE_STATUS } from '../lib/constants';
import type { DashboardData } from '../lib/types';
import { Badge, CardsSkeleton, EmptyState, ErrorState, PageHeader } from '../components/ui/primitives';
import { BarList, DonutChart, SparklineArea } from '../components/ui/charts';

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  to,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  sub?: string;
  to?: string;
}) {
  const inner = (
    <div className="rj-card group relative overflow-hidden p-4 transition hover:border-violet-500/30 hover:shadow-glow">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
          <p className="mt-1.5 font-display text-2xl font-bold text-white">{value}</p>
          {sub && <p className="mt-0.5 truncate text-[11px] text-zinc-600">{sub}</p>}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/20 transition group-hover:bg-violet-500/20">
          <Icon size={16} />
        </div>
      </div>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="mb-3 mt-8 flex items-center gap-2.5 first:mt-0">
      <span className="h-4 w-1 rounded-full bg-gradient-to-b from-violet-400 to-fuchsia-500" />
      <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-zinc-400">{children}</h2>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useApiQuery(() => api.get<DashboardData>('/api/admin/dashboard'), []);

  if (loading && !data) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Loading live statistics…" />
        <CardsSkeleton count={8} />
      </div>
    );
  }
  if (error || !data) return <ErrorState message={error?.message ?? 'Failed to load dashboard'} onRetry={refetch} />;

  const { stats, charts, recent } = data;
  const matchTotal = charts.matchResults.win + charts.matchResults.loss + charts.matchResults.draw;
  const appTotal = charts.applicationsByStatus.reduce((s, a) => s + a.count, 0);
  const newsTotal = charts.newsByStatus.reduce((s, n) => s + n.count, 0);
  const messagesTotal = charts.messagesLast30Days.reduce((s, m) => s + m.count, 0);

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] ?? 'Admin'}`}
        description={`${data.user.role} · ${new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
      />

      {/* ── RJNX Website ── */}
      <SectionTitle>RJNX Website</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          icon={FolderGit2}
          label="Projects"
          value={stats.website.projects}
          sub={`${stats.website.projectsPublished} published`}
          to="/website/projects"
        />
        <StatCard icon={Youtube} label="Featured videos" value={stats.website.videos} to="/website/youtube" />
        <StatCard
          icon={Mail}
          label="Messages"
          value={stats.website.messages}
          sub={stats.website.messagesUnread > 0 ? `${stats.website.messagesUnread} unread` : 'all read'}
          to="/website/messages"
        />
        <StatCard
          icon={Images}
          label="Site sections"
          value={`${[stats.website.homeConfigured, stats.website.aboutConfigured, stats.website.socials > 0].filter(Boolean).length}/3`}
          sub={`home · about · ${stats.website.socials} social links`}
          to="/website/home"
        />
      </div>

      {/* ── RJNX Esports ── */}
      <SectionTitle>RJNX Esports</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          icon={Gamepad2}
          label="Teams"
          value={stats.esports.teams}
          sub={`${stats.esports.teamsActive} active · ${stats.esports.teamsRecruiting} recruiting`}
          to="/esports/teams"
        />
        <StatCard icon={Users} label="Players" value={stats.esports.players} to="/esports/players" />
        <StatCard
          icon={CalendarClock}
          label="Matches"
          value={stats.esports.matchesUpcoming + stats.esports.matchesLive}
          sub={stats.esports.matchesLive > 0 ? `${stats.esports.matchesLive} live now` : 'upcoming'}
          to="/esports/matches"
        />
        <StatCard
          icon={Flag}
          label="Completed matches"
          value={stats.esports.matchesCompleted}
          to="/esports/results"
        />
        <StatCard icon={Trophy} label="Tournaments" value={stats.esports.tournaments} to="/esports/tournaments" />
        <StatCard icon={Medal} label="Achievements" value={stats.esports.achievements} to="/esports/achievements" />
        <StatCard
          icon={Newspaper}
          label="News"
          value={stats.esports.news}
          sub={`${stats.esports.newsPublished} published`}
          to="/esports/news"
        />
        <StatCard
          icon={ClipboardList}
          label="Applications"
          value={stats.esports.applications}
          sub={stats.esports.applicationsNew > 0 ? `${stats.esports.applicationsNew} new` : 'no new'}
          to="/esports/applications"
        />
      </div>

      {/* ── Charts (only with real data) ── */}
      {(matchTotal > 0 || appTotal > 0 || messagesTotal > 0 || newsTotal > 0) && (
        <>
          <SectionTitle>Insights</SectionTitle>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {matchTotal > 0 && (
              <div className="rj-card p-5">
                <h3 className="mb-4 text-sm font-semibold text-zinc-300">Match results</h3>
                <DonutChart
                  centerLabel="Completed"
                  data={[
                    { label: 'Wins', value: charts.matchResults.win, tone: 'emerald' },
                    { label: 'Losses', value: charts.matchResults.loss, tone: 'rose' },
                    { label: 'Draws', value: charts.matchResults.draw, tone: 'amber' },
                  ]}
                />
              </div>
            )}
            {appTotal > 0 && (
              <div className="rj-card p-5">
                <h3 className="mb-4 text-sm font-semibold text-zinc-300">Applications by status</h3>
                <BarList
                  data={charts.applicationsByStatus.map((a) => ({
                    label: APPLICATION_STATUS[a.status]?.label ?? a.status,
                    value: a.count,
                    tone: APPLICATION_STATUS[a.status]?.tone ?? 'zinc',
                  }))}
                />
              </div>
            )}
            <div className="rj-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-zinc-300">Contact messages · last 30 days</h3>
              {messagesTotal > 0 ? (
                <SparklineArea points={charts.messagesLast30Days} />
              ) : (
                <p className="py-8 text-center text-xs text-zinc-600">No messages received yet.</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Recent activity feeds ── */}
      <SectionTitle>Recent</SectionTitle>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rj-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-3.5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
              <CalendarClock size={15} className="text-violet-400" /> Upcoming & live matches
            </h3>
            <Link to="/esports/matches" className="text-xs text-violet-400 hover:text-violet-300">
              View all
            </Link>
          </div>
          {recent.matches.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No upcoming matches" description="Create matches to see them here." />
          ) : (
            <ul className="divide-y divide-white/5">
              {recent.matches.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <Badge tone={MATCH_STATUS[m.status]?.tone ?? 'zinc'}>{MATCH_STATUS[m.status]?.label ?? m.status}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-200">
                      {m.team_name ?? 'RJNX'} <span className="text-zinc-600">vs</span> {m.opponent_name}
                    </p>
                    <p className="truncate text-xs text-zinc-600">
                      {m.game || '—'} · {formatDateTime(m.starts_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rj-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-3.5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
              <Mail size={15} className="text-sky-400" /> Latest messages
            </h3>
            <Link to="/website/messages" className="text-xs text-violet-400 hover:text-violet-300">
              View all
            </Link>
          </div>
          {recent.messages.length === 0 ? (
            <EmptyState icon={Mail} title="No messages yet" description="Contact form submissions will appear here." />
          ) : (
            <ul className="divide-y divide-white/5">
              {recent.messages.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <Badge tone={MESSAGE_STATUS[m.status]?.tone ?? 'zinc'}>{MESSAGE_STATUS[m.status]?.label ?? m.status}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-200">{m.subject || '(no subject)'}</p>
                    <p className="truncate text-xs text-zinc-600">
                      {m.name} · {timeAgo(m.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rj-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-3.5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
              <UserPlus size={15} className="text-fuchsia-400" /> Latest applications
            </h3>
            <Link to="/esports/applications" className="text-xs text-violet-400 hover:text-violet-300">
              View all
            </Link>
          </div>
          {recent.applications.length === 0 ? (
            <EmptyState icon={UserPlus} title="No applications yet" description="Recruitment applications will appear here." />
          ) : (
            <ul className="divide-y divide-white/5">
              {recent.applications.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <Badge tone={APPLICATION_STATUS[a.status]?.tone ?? 'zinc'}>{APPLICATION_STATUS[a.status]?.label ?? a.status}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-200">{a.gamer_tag}</p>
                    <p className="truncate text-xs text-zinc-600">
                      {a.game || '—'} · {a.role || '—'} · {timeAgo(a.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rj-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-3.5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
              <Activity size={15} className="text-emerald-400" /> Recent admin activity
            </h3>
            <Link to="/system/logs" className="text-xs text-violet-400 hover:text-violet-300">
              View all
            </Link>
          </div>
          {recent.activity.length === 0 ? (
            <EmptyState icon={Activity} title="No activity yet" description="Admin actions are recorded here." />
          ) : (
            <ul className="divide-y divide-white/5">
              {recent.activity.map((log) => (
                <li key={log.id} className="flex items-center gap-3 px-5 py-2.5">
                  <Badge tone={ACTION_TONES[log.action] ?? 'zinc'}>{ACTION_LABELS[log.action] ?? log.action}</Badge>
                  <p className="min-w-0 flex-1 truncate text-xs text-zinc-400">
                    <span className="text-zinc-300">{log.user_name ?? 'System'}</span>{' '}
                    {log.resource_type ? `· ${log.resource_type}` : ''}
                  </p>
                  <span className="shrink-0 text-[10px] text-zinc-600">{timeAgo(log.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
