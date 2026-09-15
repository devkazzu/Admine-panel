/**
 * End-to-end smoke test — boots the real app on a throwaway database and
 * exercises authentication, RBAC, every major CRUD flow, validation, the
 * media pipeline and the public API over real HTTP.
 *
 * Run:  npm --prefix server run test     (from repo root: npm test)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, '..');
const dbPath = path.join(serverRoot, 'data', 'test-smoke.db');

// ── Throwaway environment (must be set BEFORE importing the app) ─────────────
for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
  try { fs.rmSync(f); } catch { /* fine */ }
}
process.env.NODE_ENV = 'development';
process.env.DATABASE_PATH = dbPath;
process.env.PORT = '4111';
process.env.BASE_URL = 'http://127.0.0.1:4111';
process.env.SESSION_SECRET = 'smoke-test-secret-not-for-production-use';
process.env.AUTO_MIGRATE = 'true';
process.env.ADMIN_EMAIL = 'smoke-admin@rjnx.local';
process.env.ADMIN_USERNAME = 'smokeadmin';
process.env.ADMIN_PASSWORD = 'SmokeTest-12345';
process.env.PUBLIC_API_ORIGINS = '*';
process.env.MAIL_TRANSPORT = 'console';

const { migrate } = await import('../src/db/migrate');
const { ensureBootstrap } = await import('../src/db/seed');
const { createApp } = await import('../src/app');

migrate(false);
ensureBootstrap();

const app = createApp();
const server = app.listen(4111, '127.0.0.1');
await new Promise((r) => server.once('listening', r));

const BASE = 'http://127.0.0.1:4111';

// ── Tiny HTTP client with a cookie jar ───────────────────────────────────────
class Api {
  private cookies = new Map<string, string>();
  constructor(private withCsrf = true) {}

  private cookieHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async req(method: string, url: string, body?: unknown, raw?: FormData) {
    const headers: Record<string, string> = {};
    if (this.withCsrf) headers['X-Requested-With'] = 'fetch';
    const ck = this.cookieHeader();
    if (ck) headers.Cookie = ck;
    let payload: any = raw;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(`${BASE}${url}`, { method, headers, body: payload });
    for (const sc of res.headers.getSetCookie?.() ?? []) {
      const [pair] = sc.split(';');
      const eq = pair.indexOf('=');
      this.cookies.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
    let json: any = null;
    const text = await res.text();
    if (text) {
      try { json = JSON.parse(text); } catch { json = { raw: text }; }
    }
    return { status: res.status, json };
  }

  get(url: string) { return this.req('GET', url); }
  post(url: string, body?: unknown) { return this.req('POST', url, body); }
  put(url: string, body?: unknown) { return this.req('PUT', url, body); }
  patch(url: string, body?: unknown) { return this.req('PATCH', url, body); }
  del(url: string) { return this.req('DELETE', url); }
}

// ── Assertions ───────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.error(`  ❌ ${name}`, extra !== undefined ? JSON.stringify(extra)?.slice(0, 400) : '');
  }
}

async function main() {
  console.log('\n── health ──');
  {
    const res = await new Api().get('/health');
    check('GET /health → 200', res.status === 200, res);
  }

  console.log('\n── authentication ──');
  const anon = new Api();
  {
    const res = await anon.get('/api/admin/website/projects');
    check('unauthenticated admin request → 401', res.status === 401, res);
  }
  {
    const res = await anon.post('/api/auth/login', { identifier: 'smoke-admin@rjnx.local', password: 'wrong-password' });
    check('wrong password → 401 generic', res.status === 401 && res.json?.error?.code === 'unauthorized', res);
  }
  {
    // No CSRF header → rejected
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'smoke-admin@rjnx.local', password: 'SmokeTest-12345' }),
    });
    check('missing CSRF header → 403', res.status === 403, res.status);
  }
  const superAdmin = new Api();
  {
    const res = await superAdmin.post('/api/auth/login', { identifier: 'smokeadmin', password: 'SmokeTest-12345' });
    check('login with username → 200', res.status === 200 && res.json?.data?.user?.roleKey === 'super_admin', res);
    const me = await superAdmin.get('/api/auth/me');
    check('GET /api/auth/me → 200 with permissions', me.status === 200 && Array.isArray(me.json?.data?.user?.permissions), me);
  }

  console.log('\n── admin users & RBAC ──');
  let editorId = 0;
  let moderatorId = 0;
  {
    const res = await superAdmin.post('/api/admin/users', {
      email: 'smoke-editor@rjnx.local',
      username: 'smokeeditor',
      name: 'Smoke Editor',
      role_key: 'editor',
      password: 'EditorPass-123',
    });
    editorId = res.json?.data?.id ?? 0;
    check('super admin creates editor → 201', res.status === 201, res);
    const dup = await superAdmin.post('/api/admin/users', {
      email: 'smoke-editor@rjnx.local', username: 'smokeeditor2', name: 'X', role_key: 'editor', password: 'EditorPass-123',
    });
    check('duplicate email → 409', dup.status === 409, dup);

    const res2 = await superAdmin.post('/api/admin/users', {
      email: 'smoke-moderator@rjnx.local',
      username: 'smokemod',
      name: 'Smoke Moderator',
      role_key: 'moderator',
      password: 'ModeratorPass-1',
    });
    moderatorId = res2.json?.data?.id ?? 0;
    check('super admin creates moderator → 201', res2.status === 201, res2);

    const selfDelete = await superAdmin.del(`/api/admin/users/${(await superAdmin.get('/api/auth/me')).json.data.user.id}`);
    check('cannot delete own account → 409', selfDelete.status === 409, selfDelete);
  }
  const editor = new Api();
  const moderator = new Api();
  {
    await editor.post('/api/auth/login', { identifier: 'smoke-editor@rjnx.local', password: 'EditorPass-123' });
    await moderator.post('/api/auth/login', { identifier: 'smoke-moderator@rjnx.local', password: 'ModeratorPass-1' });
    const res = await editor.get('/api/admin/users');
    check('editor cannot list admin users → 403', res.status === 403, res);
    const res2 = await moderator.post('/api/admin/website/projects', { name: 'Nope' });
    check('moderator cannot create projects → 403', res2.status === 403, res2);
    const res3 = await moderator.get('/api/admin/website/projects');
    check('moderator can read projects → 200', res3.status === 200, res3);
  }

  console.log('\n── website content (singletons) ──');
  {
    const res = await editor.put('/api/admin/website/home', {
      hero_title: 'RJNX',
      hero_subtitle: 'Gaming • Creativity • Technology',
      description: 'Smoke hero',
      hero_image: '',
      cta_primary_label: 'YouTube',
      cta_primary_url: 'https://www.youtube.com/@rjnxgaming',
      cta_secondary_label: '',
      cta_secondary_url: '',
    });
    check('update home content → 200', res.status === 200 && res.json?.data?.hero_title === 'RJNX', res);

    const bad = await editor.put('/api/admin/website/home', {
      hero_title: 'x', hero_subtitle: '', description: '', hero_image: '',
      cta_primary_label: '', cta_primary_url: 'not-a-url', cta_secondary_label: '', cta_secondary_url: '',
    });
    check('invalid CTA url → 422 with details', bad.status === 422 && Array.isArray(bad.json?.error?.details), bad);

    const pub = await new Api().get('/api/public/website/content');
    check('public content exposes home + socials', pub.status === 200 && pub.json?.data?.home?.hero_title === 'RJNX' && Array.isArray(pub.json.data.socials), pub);
  }

  console.log('\n── projects CRUD + publish workflow ──');
  let projectId = 0;
  {
    const res = await editor.post('/api/admin/website/projects', {
      name: 'Smoke Project', description: 'A project', technologies: ['React', 'Vite'], status: 'draft',
    });
    projectId = res.json?.data?.id ?? 0;
    check('create project → 201 with auto slug', res.status === 201 && res.json?.data?.slug === 'smoke-project', res);

    const noName = await editor.post('/api/admin/website/projects', { description: 'missing name' });
    check('create without name → 422', noName.status === 422, noName);

    const upd = await editor.patch(`/api/admin/website/projects/${projectId}`, { description: 'Updated', status: 'published' });
    check('update + publish → 200', upd.status === 200 && upd.json?.data?.status === 'published', upd);

    const pub = await new Api().get('/api/public/website/projects');
    check('public projects shows published only', pub.json?.data?.length === 1 && pub.json.data[0].name === 'Smoke Project', pub);

    const got = await editor.get(`/api/admin/website/projects/${projectId}`);
    check('read one project → 200', got.status === 200, got);

    const del = await editor.del(`/api/admin/website/projects/${projectId}`);
    check('delete project → 204', del.status === 204, del);
    const pub2 = await new Api().get('/api/public/website/projects');
    check('public projects empty after delete', pub2.json?.data?.length === 0, pub2);
  }

  console.log('\n── esports: teams / players / matches / tournaments ──');
  let teamId = 0;
  {
    const res = await editor.post('/api/admin/esports/teams', {
      name: 'RJNX Valorant', game: 'Valorant', description: 'Smoke team', status: 'active',
      socials: { youtube: 'https://www.youtube.com/@rjnxgaming' },
    });
    teamId = res.json?.data?.id ?? 0;
    check('create team → 201', res.status === 201 && res.json?.data?.slug === 'rjnx-valorant', res);

    const pres = await editor.post('/api/admin/esports/players', {
      gamer_tag: 'SmokePlayer', real_name: 'Smoke Player', game: 'Valorant', team_id: teamId, role: 'Duelist',
      stats: [{ label: 'K/D', value: '1.2' }],
    });
    check('create player with team + stats → 201', pres.status === 201 && pres.json?.data?.stats?.length === 1, pres);
    const badTeam = await editor.post('/api/admin/esports/players', { gamer_tag: 'X', team_id: 99999 });
    check('player with unknown team → 422', badTeam.status === 422, badTeam);

    const tres = await editor.post('/api/admin/esports/tournaments', {
      name: 'Smoke Cup', game: 'Valorant', start_date: '2026-01-10', location: 'Online', is_online: true,
    });
    const tournamentId = tres.json?.data?.id ?? 0;
    check('create tournament → 201', tres.status === 201, tres);

    const mres = await editor.post('/api/admin/esports/matches', {
      team_id: teamId, opponent_name: 'Smoke Opponent', game: 'Valorant', tournament_id: tournamentId,
      starts_at: new Date(Date.now() + 86400000).toISOString(), status: 'upcoming',
    });
    const matchId = mres.json?.data?.id ?? 0;
    check('create upcoming match → 201', mres.status === 201, mres);

    const live = await editor.patch(`/api/admin/esports/matches/${matchId}/status`, { status: 'live' });
    check('match → live', live.status === 200 && live.json?.data?.status === 'live', live);

    const done = await editor.patch(`/api/admin/esports/matches/${matchId}/status`, { status: 'completed', our_score: 13, opponent_score: 7 });
    check('complete match auto-derives WIN', done.status === 200 && done.json?.data?.result === 'win', done);

    const noScore = await editor.post('/api/admin/esports/matches', {
      team_id: teamId, opponent_name: 'X', starts_at: new Date().toISOString(), status: 'completed',
    });
    check('completed match without scores → 422', noScore.status === 422, noScore);

    const pubTeams = await new Api().get('/api/public/esports/teams');
    check('public teams include players', pubTeams.json?.data?.[0]?.players?.length === 1, pubTeams);
    const pubMatches = await new Api().get('/api/public/esports/results');
    check('public results show completed match', pubMatches.json?.data?.some((m: any) => m.result === 'win'), pubMatches);
  }

  console.log('\n── news workflow ──');
  {
    const res = await editor.post('/api/admin/esports/news', { title: 'Smoke Article', content: 'Hello **world**', category: 'News' });
    const id = res.json?.data?.id ?? 0;
    check('create draft article → 201 with slug + author', res.status === 201 && res.json?.data?.slug === 'smoke-article' && res.json?.data?.author === 'Smoke Editor', res);

    let pub = await new Api().get('/api/public/esports/news');
    check('draft not visible publicly', pub.json?.data?.length === 0, pub);

    const p = await editor.patch(`/api/admin/esports/news/${id}/publish`);
    check('publish → 200 + published_at set', p.status === 200 && !!p.json?.data?.published_at, p);
    pub = await new Api().get('/api/public/esports/news');
    check('published article visible publicly', pub.json?.data?.length === 1 && pub.json.data[0].excerpt.includes('Hello'), pub);

    const slug = await new Api().get('/api/public/esports/news/smoke-article');
    check('public article by slug → 200', slug.status === 200 && slug.json?.data?.title === 'Smoke Article', slug);

    const u = await editor.patch(`/api/admin/esports/news/${id}/unpublish`);
    check('unpublish → 200', u.status === 200 && u.json?.data?.status === 'draft', u);
    const gone = await new Api().get('/api/public/esports/news/smoke-article');
    check('unpublished article → 404 publicly', gone.status === 404, gone);
  }

  console.log('\n── recruitment + applications + messages ──');
  {
    const res = await editor.post('/api/admin/esports/recruitment', {
      position: 'Smoke Player', game: 'Valorant', role: 'Duelist', description: 'd', requirements: 'r', status: 'open', deadline: '2099-01-01',
    });
    const openingId = res.json?.data?.id ?? 0;
    check('create opening → 201', res.status === 201, res);

    const pub = await new Api().get('/api/public/esports/recruitment');
    check('public recruitment lists open opening', pub.json?.data?.length === 1, pub);

    const app = await new Api().post('/api/public/applications', {
      opening_id: openingId, name: 'Smoke Applicant', gamer_tag: 'SmokeApp', email: 'smoke@example.com',
      age: 20, game: 'Valorant', role: 'Duelist', experience: '1y', message: 'pick me',
    });
    check('public application submit → 201', app.status === 201, app);

    const list = await moderator.get('/api/admin/esports/applications?status=new');
    check('moderator lists new applications', list.status === 200 && list.json?.data?.length === 1, list);
    const appId = list.json?.data?.[0]?.id ?? 0;
    const st = await moderator.patch(`/api/admin/esports/applications/${appId}/status`, { status: 'shortlisted' });
    check('moderator updates application status', st.status === 200 && st.json?.data?.status === 'shortlisted', st);

    const msg = await new Api().post('/api/public/contact', {
      name: 'Smoke Sender', email: 'sender@example.com', subject: 'Hi', message: 'Hello from the public site',
    });
    check('public contact submit → 201', msg.status === 201, msg);
    const bad = await new Api().post('/api/public/contact', { name: 'X', email: 'not-an-email', message: 'x' });
    check('contact with invalid email → 422', bad.status === 422, bad);

    const mlist = await moderator.get('/api/admin/website/messages?status=unread');
    check('messages list shows unread', mlist.json?.data?.length === 1, mlist);
    const mid = mlist.json?.data?.[0]?.id ?? 0;
    const mst = await moderator.patch(`/api/admin/website/messages/${mid}/status`, { status: 'read' });
    check('message status update', mst.status === 200 && mst.json?.data?.status === 'read', mst);
  }

  console.log('\n── media library ──');
  {
    const sharp = (await import('sharp')).default;
    const png = await sharp({ create: { width: 300, height: 200, channels: 4, background: '#7c3aed' } }).png().toBuffer();
    const fd = new FormData();
    fd.append('file', new Blob([png], { type: 'image/png' }), 'smoke.png');
    const res = await superAdmin.req('POST', '/api/admin/media', undefined, fd);
    const mediaId = res.json?.data?.id ?? 0;
    check('upload image → 201 optimized webp', res.status === 201 && res.json?.data?.mime === 'image/webp' && res.json?.data?.url?.includes('/uploads/'), res);

    const meta = await superAdmin.patch(`/api/admin/media/${mediaId}`, { alt_text: 'Smoke alt' });
    check('update media meta → 200', meta.status === 200 && meta.json?.data?.alt_text === 'Smoke alt', meta);

    // Reference the media in a project, then deletion must be blocked
    const proj = await editor.post('/api/admin/website/projects', { name: 'With Image', image: res.json.data.path, status: 'draft' });
    const blocked = await superAdmin.del(`/api/admin/media/${mediaId}`);
    check('delete referenced media → 409 with references', blocked.status === 409 && Array.isArray(blocked.json?.error?.details), blocked);
    await editor.del(`/api/admin/website/projects/${proj.json.data.id}`);
    const ok = await superAdmin.del(`/api/admin/media/${mediaId}`);
    check('delete unreferenced media → 204', ok.status === 204, ok);
  }

  console.log('\n── settings / dashboard / search / logs / notifications ──');
  {
    const res = await editor.put('/api/admin/settings/general', {
      site_name: 'RJNX', site_description: 'Central hub', site_logo: '', site_favicon: '',
    });
    check('update settings → 200', res.status === 200 && res.json?.data?.general?.site_name === 'RJNX', res);
    const pub = await new Api().get('/api/public/settings');
    check('public settings exposes site_name', pub.json?.data?.site_name === 'RJNX', pub);

    const dash = await moderator.get('/api/admin/dashboard');
    check('dashboard stats computed', dash.status === 200 && dash.json?.data?.stats?.esports?.teams === 1 && dash.json?.data?.charts?.matchResults?.win === 1, dash.json?.data?.stats);

    const search = await superAdmin.get('/api/admin/search?q=valorant');
    check('global search finds team', search.json?.data?.groups?.some((g: any) => g.label === 'Teams'), search.json);

    const notif = await superAdmin.get('/api/admin/notifications');
    check('notifications counts', notif.status === 200 && notif.json?.data?.counts?.applications >= 0, notif);

    const logs = await superAdmin.get('/api/admin/activity-logs?action=login');
    check('activity log records logins', logs.status === 200 && (logs.json?.data?.length ?? 0) >= 1, logs);
    const logsAll = await superAdmin.get('/api/admin/activity-logs?perPage=100');
    const actions = new Set((logsAll.json?.data ?? []).map((l: any) => l.action));
    check('activity log has create/publish/status_change', actions.has('create') && actions.has('publish') && actions.has('status_change'), [...actions]);
  }

  console.log('\n── password flows ──');
  {
    const wrong = await editor.put('/api/auth/change-password', { currentPassword: 'nope', newPassword: 'NewPassword-123' });
    check('change password wrong current → 400', wrong.status === 400, wrong);
    const ok = await editor.put('/api/auth/change-password', { currentPassword: 'EditorPass-123', newPassword: 'NewPassword-123' });
    check('change password → 200', ok.status === 200, ok);
    const relogin = await new Api().post('/api/auth/login', { identifier: 'smoke-editor@rjnx.local', password: 'EditorPass-123' });
    check('old password rejected after change', relogin.status === 401, relogin);

    const forgot = await new Api().post('/api/auth/forgot-password', { email: 'smoke-editor@rjnx.local' });
    check('forgot-password → generic 200', forgot.status === 200, forgot);
    // extract the token from the DB (console transport prints it; we verify flow directly)
    const { get } = await import('../src/db');
    const row = get<any>(`SELECT t.token_hash, u.email FROM password_reset_tokens t JOIN admin_users u ON u.id = t.user_id WHERE u.email = 'smoke-editor@rjnx.local' ORDER BY t.id DESC LIMIT 1`);
    check('reset token stored hashed', !!row && row.token_hash.length === 64, row);
    const badReset = await new Api().post('/api/auth/reset-password', { token: 'f'.repeat(64), newPassword: 'ResetPass-123' });
    check('invalid reset token → 400', badReset.status === 400, badReset);
  }

  console.log('\n── logout ──');
  {
    const res = await moderator.post('/api/auth/logout');
    check('logout → 200', res.status === 200, res);
    const me = await moderator.get('/api/auth/me');
    check('session invalidated after logout', me.status === 401, me);
  }

  server.close();
  for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    try { fs.rmSync(f); } catch { /* fine */ }
  }

  console.log('\n══════════════════════════════════════');
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('  Failed checks:');
    for (const f of failures) console.log(`   - ${f}`);
    process.exit(1);
  }
  console.log('  ALL CHECKS PASSED ✅');
  process.exit(0);
}

main().catch(async (err) => {
  console.error('💥 smoke test crashed:', err);
  server.close();
  for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    try { fs.rmSync(f); } catch { /* fine */ }
  }
  process.exit(1);
});
