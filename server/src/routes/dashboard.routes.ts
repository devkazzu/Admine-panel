/**
 * Dashboard overview — every number is computed live from the database.
 * No fabricated statistics: empty sections simply report zero / empty arrays.
 */
import { Router } from 'express';
import { all, get, parseJson } from '../db';
import { requireAuth } from '../middleware/auth';

export const dashboardRouter = Router();

const count = (sql: string, params: any[] = []): number =>
  (get<{ c: number }>(sql, params) ?? { c: 0 }).c;

dashboardRouter.get('/', requireAuth, (req, res) => {
  // ── RJNX Website stats ────────────────────────────────────────────────────
  const home = get<any>('SELECT * FROM website_home WHERE id = 1');
  const about = get<any>('SELECT * FROM website_about WHERE id = 1');

  const website = {
    projects: count('SELECT COUNT(*) c FROM projects'),
    projectsPublished: count(`SELECT COUNT(*) c FROM projects WHERE status = 'published'`),
    videos: count('SELECT COUNT(*) c FROM featured_videos'),
    messages: count('SELECT COUNT(*) c FROM contact_messages'),
    messagesUnread: count(`SELECT COUNT(*) c FROM contact_messages WHERE status = 'unread'`),
    homeConfigured: Boolean(home?.hero_title),
    aboutConfigured: Boolean(about?.biography),
    socials: count(`SELECT COUNT(*) c FROM social_links WHERE owner_type = 'site' AND is_active = 1`),
  };

  // ── RJNX Esports stats ────────────────────────────────────────────────────
  const esports = {
    teams: count('SELECT COUNT(*) c FROM teams'),
    teamsActive: count(`SELECT COUNT(*) c FROM teams WHERE status = 'active'`),
    teamsRecruiting: count(`SELECT COUNT(*) c FROM teams WHERE status = 'recruiting'`),
    players: count('SELECT COUNT(*) c FROM players'),
    matchesUpcoming: count(`SELECT COUNT(*) c FROM matches WHERE status = 'upcoming'`),
    matchesLive: count(`SELECT COUNT(*) c FROM matches WHERE status = 'live'`),
    matchesCompleted: count(`SELECT COUNT(*) c FROM matches WHERE status = 'completed'`),
    tournaments: count('SELECT COUNT(*) c FROM tournaments'),
    achievements: count('SELECT COUNT(*) c FROM achievements'),
    news: count('SELECT COUNT(*) c FROM news'),
    newsPublished: count(`SELECT COUNT(*) c FROM news WHERE status = 'published'`),
    media: count('SELECT COUNT(*) c FROM media'),
    albums: count(`SELECT COUNT(*) c FROM media_albums WHERE status = 'published'`),
    openingsOpen: count(`SELECT COUNT(*) c FROM recruitment_openings WHERE status = 'open'`),
    applications: count('SELECT COUNT(*) c FROM applications'),
    applicationsNew: count(`SELECT COUNT(*) c FROM applications WHERE status = 'new'`),
  };

  // ── Chart data (rendered client-side only when non-empty) ─────────────────
  const matchResults = {
    win: count(`SELECT COUNT(*) c FROM matches WHERE status = 'completed' AND result = 'win'`),
    loss: count(`SELECT COUNT(*) c FROM matches WHERE status = 'completed' AND result = 'loss'`),
    draw: count(`SELECT COUNT(*) c FROM matches WHERE status = 'completed' AND result = 'draw'`),
  };

  const applicationsByStatus = all<{ status: string; count: number }>(
    `SELECT status, COUNT(*) AS count FROM applications GROUP BY status`,
  );

  const messagesLast30Days = all<{ date: string; count: number }>(
    `SELECT date(created_at) AS date, COUNT(*) AS count FROM contact_messages
     WHERE created_at >= datetime('now', '-30 days') GROUP BY date(created_at) ORDER BY date`,
  );

  const newsByStatus = all<{ status: string; count: number }>(
    `SELECT status, COUNT(*) AS count FROM news GROUP BY status`,
  );

  // ── Recent activity feeds ─────────────────────────────────────────────────
  const recentActivity = all<any>(
    `SELECT l.id, l.action, l.resource_type, l.resource_id, l.created_at, u.name AS user_name
     FROM activity_logs l LEFT JOIN admin_users u ON u.id = l.user_id
     ORDER BY l.id DESC LIMIT 8`,
  );

  const upcomingMatches = all<any>(
    `SELECT m.id, m.opponent_name, m.game, m.starts_at, m.status, m.stream_url, t.name AS team_name, t.logo AS team_logo
     FROM matches m LEFT JOIN teams t ON t.id = m.team_id
     WHERE m.status IN ('upcoming','live')
     ORDER BY CASE WHEN m.status = 'live' THEN 0 ELSE 1 END, m.starts_at ASC LIMIT 6`,
  );

  const recentMessages = all<any>(
    `SELECT id, name, email, subject, status, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 5`,
  );

  const recentApplications = all<any>(
    `SELECT id, name, gamer_tag, game, role, status, created_at FROM applications ORDER BY created_at DESC LIMIT 5`,
  );

  res.json({
    data: {
      user: { name: req.user!.name, role: req.user!.roleName },
      stats: { website, esports },
      charts: { matchResults, applicationsByStatus, messagesLast30Days, newsByStatus },
      recent: { activity: recentActivity, matches: upcomingMatches, messages: recentMessages, applications: recentApplications },
    },
  });
});
