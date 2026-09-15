/**
 * Database seeding.
 *
 *  ensureBootstrap() — idempotent, runs on every boot:
 *    · role definitions (kept in sync with code)
 *    · single-row content blocks (website home/about, YouTube channel)
 *    · the first Super Admin if no admin exists (env-configured or a randomly
 *      generated password printed once to the console)
 *
 *  seedDemo() — opt-in (`npm run db:seed:demo`): inserts SAMPLE content so the
 *  panel can be explored. Everything is clearly labelled "Sample" and can be
 *  deleted like any normal record. No real contact info is invented.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { db, get, run, tx } from './index';
import { nowIso, slugify } from '../core/utils';
import { logActivity } from '../services/activity';

// ── Role definitions (single source of truth) ────────────────────────────────
export const ROLE_DEFINITIONS: { key: string; name: string; description: string; permissions: string[] }[] = [
  {
    key: 'super_admin',
    name: 'Super Admin',
    description: 'Full access to every section, including admin users and system settings.',
    permissions: ['*'],
  },
  {
    key: 'editor',
    name: 'Editor',
    description: 'Manages all content (website + esports + news + media + settings) but cannot manage admin accounts.',
    permissions: [
      'dashboard:read',
      'website_content:read', 'website_content:write',
      'projects:read', 'projects:write',
      'videos:read', 'videos:write',
      'socials:read', 'socials:write',
      'messages:read', 'messages:write',
      'teams:read', 'teams:write',
      'players:read', 'players:write',
      'matches:read', 'matches:write',
      'tournaments:read', 'tournaments:write',
      'achievements:read', 'achievements:write',
      'news:read', 'news:write',
      'media:read', 'media:write',
      'media_albums:read', 'media_albums:write',
      'recruitment:read', 'recruitment:write',
      'applications:read', 'applications:write',
      'settings:read', 'settings:write',
      'activity_logs:read',
    ],
  },
  {
    key: 'moderator',
    name: 'Moderator',
    description: 'Manages applications, contact messages, players and matches; read-only on the rest.',
    permissions: [
      'dashboard:read',
      'website_content:read', 'projects:read', 'videos:read', 'socials:read',
      'messages:read', 'messages:write',
      'teams:read',
      'players:read', 'players:write',
      'matches:read', 'matches:write',
      'tournaments:read', 'achievements:read', 'news:read',
      'media:read', 'media:write', 'media_albums:read',
      'recruitment:read',
      'applications:read', 'applications:write',
      'settings:read',
    ],
  },
];

export function ensureBootstrap(): void {
  // Roles (upsert keeps permissions in sync with code)
  for (const role of ROLE_DEFINITIONS) {
    run(
      `INSERT INTO roles (key, name, description, permissions) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET name = excluded.name, description = excluded.description, permissions = excluded.permissions`,
      [role.key, role.name, role.description, JSON.stringify(role.permissions)],
    );
  }

  // Single-row content blocks
  run('INSERT OR IGNORE INTO website_home (id) VALUES (1)');
  run('INSERT OR IGNORE INTO website_about (id) VALUES (1)');
  run('INSERT OR IGNORE INTO youtube_channel (id) VALUES (1)');

  // First admin user
  const userCount = (get<{ c: number }>('SELECT COUNT(*) c FROM admin_users') ?? { c: 0 }).c;
  if (userCount === 0) {
    const a = config.bootstrapAdmin;
    const password = a.password && a.password.length >= 10 ? a.password : crypto.randomBytes(12).toString('base64url');
    const role = get<{ id: number }>(`SELECT id FROM roles WHERE key = 'super_admin'`);
    run(
      `INSERT INTO admin_users (email, username, name, password_hash, role_id, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      [a.email, a.username, a.name, bcrypt.hashSync(password, 12), role!.id, nowIso(), nowIso()],
    );
    console.log('');
    console.log('  ───────────── FIRST ADMIN CREATED ─────────────');
    console.log(`  Email:    ${a.email}`);
    console.log(`  Username: ${a.username}`);
    console.log(`  Password: ${password}`);
    if (!a.password) console.log('  (randomly generated — set ADMIN_PASSWORD in .env to control it)');
    console.log('  ⚠️  Change this password after first login.');
    console.log('  ────────────────────────────────────────────────');
  }
}

// ── Demo content ─────────────────────────────────────────────────────────────

/** Generate a labelled placeholder image with sharp and register it in the media library. */
async function makeDemoImage(label: string, width: number, height: number): Promise<{ id: number; path: string }> {
  const sharp = (await import('sharp')).default;
  const hue = Math.floor(Math.random() * 360);
  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="hsl(${hue}, 70%, 22%)"/>
          <stop offset="100%" stop-color="hsl(${(hue + 60) % 360}, 75%, 12%)"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <circle cx="${width * 0.85}" cy="${height * 0.15}" r="${Math.min(width, height) * 0.18}" fill="hsl(${hue}, 80%, 45%)" opacity="0.35"/>
      <text x="50%" y="52%" font-family="Arial, sans-serif" font-size="${Math.round(Math.min(width, height) / 14)}" fill="rgba(255,255,255,0.85)" text-anchor="middle" font-weight="bold">${label}</text>
    </svg>`,
  );
  const id = crypto.randomUUID();
  const relDir = path.posix.join('media', 'demo');
  const absDir = path.join(config.uploadsDir, relDir);
  fs.mkdirSync(absDir, { recursive: true });
  const full = await sharp(svg).webp({ quality: 82 }).toBuffer();
  const thumb = await sharp(svg).resize({ width: 480 }).webp({ quality: 75 }).toBuffer();
  fs.writeFileSync(path.join(absDir, `${id}.webp`), full);
  fs.writeFileSync(path.join(absDir, `t_${id}.webp`), thumb);
  const rel = `/uploads/${relDir}/${id}.webp`;
  const adminId = get<{ id: number }>(`SELECT id FROM admin_users LIMIT 1`)!.id;
  const info = run(
    `INSERT INTO media (filename, original_name, path, thumb_path, mime, format, size, width, height, alt_text, folder, uploaded_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'image/webp', 'webp', ?, ?, ?, ?, 'demo', ?, ?, ?)`,
    [id, `sample-${slugify(label)}.webp`, rel, `/uploads/${relDir}/t_${id}.webp`, full.length, width, height, `Sample image: ${label}`, adminId, nowIso(), nowIso()],
  );
  return { id: Number(info.lastInsertRowid), path: rel };
}

export async function seedDemo(): Promise<void> {
  const existing = (get<{ c: number }>('SELECT COUNT(*) c FROM teams') ?? { c: 0 }).c;
  if (existing > 0) {
    console.log('ℹ️  Demo content skipped — the database already has content.');
    return;
  }
  const adminId = get<{ id: number }>(`SELECT id FROM admin_users LIMIT 1`)!.id;
  console.log('🌱 Seeding SAMPLE content (clearly labelled — delete freely)…');

  // Sample admin teammates for RBAC exploration
  const editorRole = get<{ id: number }>(`SELECT id FROM roles WHERE key = 'editor'`)!;
  const moderatorRole = get<{ id: number }>(`SELECT id FROM roles WHERE key = 'moderator'`)!;
  const sampleUsers: [string, string, string, any][] = [
    ['sample-editor@rjnx.local', 'sample_editor', 'Sample Editor', editorRole],
    ['sample-moderator@rjnx.local', 'sample_moderator', 'Sample Moderator', moderatorRole],
  ];
  for (const [email, username, name, role] of sampleUsers) {
    if (!get('SELECT id FROM admin_users WHERE email = ?', [email])) {
      const pw = crypto.randomBytes(9).toString('base64url');
      run(
        `INSERT INTO admin_users (email, username, name, password_hash, role_id, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        [email, username, name, bcrypt.hashSync(pw, 12), role.id, nowIso(), nowIso()],
      );
      console.log(`   👤 ${email} / ${pw} (${name})`);
    }
  }

  // Media
  const hero = await makeDemoImage('Sample Hero', 1600, 900);
  const aboutImg = await makeDemoImage('Sample Profile', 800, 800);
  const logo1 = await makeDemoImage('RJNX Valorant', 512, 512);
  const logo2 = await makeDemoImage('RJNX BGMI', 512, 512);
  const p1 = await makeDemoImage('Player One', 400, 400);
  const p2 = await makeDemoImage('Player Two', 400, 400);
  const p3 = await makeDemoImage('Player Three', 400, 400);
  const proj1 = await makeDemoImage('Sample Project', 1200, 750);
  const newsImg = await makeDemoImage('Sample News', 1280, 720);
  const achImg = await makeDemoImage('Sample Trophy', 800, 600);
  const gallery = await makeDemoImage('Sample Gallery', 1280, 853);

  const T = (offsetDays: number) => new Date(Date.now() + offsetDays * 86400000).toISOString();

  tx(() => {
    // Website content
    run(
      `UPDATE website_home SET hero_title = ?, hero_subtitle = ?, description = ?, hero_image = ?,
        cta_primary_label = 'Watch on YouTube', cta_primary_url = 'https://www.youtube.com/@rjnxgaming',
        cta_secondary_label = 'View Projects', cta_secondary_url = '#projects', updated_at = ?, updated_by = ? WHERE id = 1`,
      ['RJNX', 'Gaming • Creativity • Technology', 'Sample hero description — replace this text from the admin panel. This block is managed under RJNX Website → Home.', hero.path, nowIso(), adminId],
    );
    run(
      `UPDATE website_about SET biography = ?, profile_image = ?, interests = ?, skills = ?, updated_at = ?, updated_by = ? WHERE id = 1`,
      [
        'Sample biography — this is demo content managed under RJNX Website → About. Replace it with the real story.',
        aboutImg.path,
        JSON.stringify(['Gaming', 'Technology', 'Content Creation', 'Esports']),
        JSON.stringify([
          { name: 'Sample Skill A', level: 85 },
          { name: 'Sample Skill B', level: 70 },
          { name: 'Sample Skill C', level: 55 },
        ]),
        nowIso(),
        adminId,
      ],
    );
    run(
      `UPDATE youtube_channel SET channel_url = ?, channel_description = 'Sample channel description — managed under RJNX Website → YouTube.', updated_at = ?, updated_by = ? WHERE id = 1`,
      ['https://www.youtube.com/@rjnxgaming', nowIso(), adminId],
    );

    // Social links (the two public links already used by the RJNX website)
    for (const [platform, url] of [
      ['youtube', 'https://www.youtube.com/@rjnxgaming'],
      ['github', 'https://github.com/devkazzu'],
    ] as [string, string][]) {
      run(
        `INSERT INTO social_links (owner_type, owner_id, platform, url, label, is_active, sort_order) VALUES ('site', 0, ?, ?, '', 1, 0)`,
        [platform, url],
      );
    }

    // Projects
    const projects = [
      ['Sample Project One', 'A sample project entry managed from the admin panel.', proj1.path, ['React', 'TypeScript'], 'published', 1],
      ['Sample Project Two', 'Another sample project — edit or delete me.', '', ['Node.js'], 'draft', 0],
      ['Sample Project Three', 'A third sample project for the grid layout.', '', ['Python'], 'published', 0],
    ] as const;
    for (const [name, description, image, tech, status, featured] of projects) {
      run(
        `INSERT INTO projects (name, slug, description, image, github_url, live_url, technologies, status, featured, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, '', '', ?, ?, ?, 0, ?, ?)`,
        [name, slugify(name), description, image, JSON.stringify(tech), status, featured ? 1 : 0, nowIso(), nowIso()],
      );
    }

    // Teams + players
    const teamInfo = run(
      `INSERT INTO teams (name, slug, game, logo, description, status, socials, sort_order, created_at, updated_at)
       VALUES ('RJNX Valorant', 'rjnx-valorant', 'Valorant', ?, 'Sample team — created as demo content.', 'active', '{}', 0, ?, ?)`,
      [logo1.path, nowIso(), nowIso()],
    );
    const team1 = Number(teamInfo.lastInsertRowid);
    const team2Info = run(
      `INSERT INTO teams (name, slug, game, logo, description, status, socials, sort_order, created_at, updated_at)
       VALUES ('RJNX BGMI', 'rjnx-bgmi', 'BGMI', ?, 'Sample team (recruiting).', 'recruiting', '{}', 1, ?, ?)`,
      [logo2.path, nowIso(), nowIso()],
    );
    const team2 = Number(team2Info.lastInsertRowid);

    const players = [
      ['SampleTag1', 'Sample Player One', p1.path, 'Valorant', team1, 'Duelist', 'India', [{ label: 'K/D', value: '1.24' }, { label: 'HS %', value: '27%' }]],
      ['SampleTag2', 'Sample Player Two', p2.path, 'Valorant', team1, 'Controller', 'India', [{ label: 'K/D', value: '1.05' }]],
      ['SampleTag3', 'Sample Player Three', p3.path, 'Valorant', team1, 'Initiator', 'India', []],
      ['SampleTag4', 'Sample Player Four', '', 'BGMI', team2, 'IGL', 'India', []],
      ['SampleTag5', 'Sample Player Five', '', 'BGMI', null, 'Assault', 'India', []],
    ] as const;
    for (const [tag, real, image, game, teamId, role, country, stats] of players) {
      run(
        `INSERT INTO players (gamer_tag, real_name, image, game, team_id, role, country, biography, socials, stats, status, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Sample player biography.', '{}', ?, 'active', 0, ?, ?)`,
        [tag, real, image, game, teamId, role, country, JSON.stringify(stats), nowIso(), nowIso()],
      );
    }

    // Tournaments + matches
    const t1 = run(
      `INSERT INTO tournaments (name, game, organizer, start_date, end_date, location, is_online, prize_pool, description, status, result, created_at, updated_at)
       VALUES ('Sample Cup Season 1', 'Valorant', 'Sample Organizer', date('now', '-30 day'), date('now', '-28 day'), 'Online', 1, '₹10,000', 'A completed sample tournament.', 'completed', 'Top 4 finish', ?, ?)`,
      [nowIso(), nowIso()],
    );
    const t2 = run(
      `INSERT INTO tournaments (name, game, organizer, start_date, end_date, location, is_online, prize_pool, description, status, result, created_at, updated_at)
       VALUES ('Sample Open Qualifier', 'BGMI', 'Sample Organizer', date('now', '+20 day'), date('now', '+22 day'), 'Online', 1, '', 'An upcoming sample tournament.', 'upcoming', '', ?, ?)`,
      [nowIso(), nowIso()],
    );

    run(
      `INSERT INTO matches (team_id, opponent_name, opponent_logo, game, tournament_id, starts_at, stream_url, our_score, opponent_score, result, status, created_at, updated_at)
       VALUES (?, 'Sample Opponent A', '', 'Valorant', ?, ?, '', 13, 7, 'win', 'completed', ?, ?)`,
      [team1, Number(t1.lastInsertRowid), T(-29), nowIso(), nowIso()],
    );
    run(
      `INSERT INTO matches (team_id, opponent_name, opponent_logo, game, tournament_id, starts_at, stream_url, our_score, opponent_score, result, status, created_at, updated_at)
       VALUES (?, 'Sample Opponent B', '', 'Valorant', ?, ?, '', 9, 13, 'loss', 'completed', ?, ?)`,
      [team1, Number(t1.lastInsertRowid), T(-28), nowIso(), nowIso()],
    );
    run(
      `INSERT INTO matches (team_id, opponent_name, opponent_logo, game, tournament_id, starts_at, stream_url, our_score, opponent_score, result, status, notes, created_at, updated_at)
       VALUES (?, 'Sample Opponent C', '', 'BGMI', ?, ?, 'https://www.youtube.com/@rjnxgaming', NULL, NULL, 'pending', 'live', 'Sample live match.', ?, ?)`,
      [team2, Number(t2.lastInsertRowid), T(0), nowIso(), nowIso()],
    );
    run(
      `INSERT INTO matches (team_id, opponent_name, opponent_logo, game, tournament_id, starts_at, stream_url, our_score, opponent_score, result, status, created_at, updated_at)
       VALUES (?, 'Sample Opponent D', '', 'BGMI', ?, ?, '', NULL, NULL, 'pending', 'upcoming', ?, ?)`,
      [team2, Number(t2.lastInsertRowid), T(5), nowIso(), nowIso()],
    );

    // Achievements
    run(
      `INSERT INTO achievements (title, description, game, tournament, date, position, image, sort_order, created_at, updated_at)
       VALUES ('Sample Champions', 'Sample achievement entry.', 'Valorant', 'Sample Cup Season 1', date('now', '-28 day'), '1st', ?, 0, ?, ?)`,
      [achImg.path, nowIso(), nowIso()],
    );
    run(
      `INSERT INTO achievements (title, description, game, tournament, date, position, image, sort_order, created_at, updated_at)
       VALUES ('Sample Finalists', 'Another sample achievement.', 'BGMI', 'Sample Showdown', date('now', '-60 day'), '2nd', '', 1, ?, ?)`,
      [nowIso(), nowIso()],
    );

    // News
    run(
      `INSERT INTO news (title, slug, cover_image, category, author, content, published_at, seo_title, seo_description, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, 'Announcements', 'RJNX Admin', ?, ?, 'Sample article one', 'A sample published article.', 'published', ?, ?, ?)`,
      [
        'Sample Article: Welcome to the News System',
        'sample-article-welcome',
        newsImg.path,
        '## This is a sample article\n\nThis content is **Markdown** managed from the admin panel. Publish, unpublish, edit and delete articles from **RJNX Esports → News**.\n\n- Draft → Published → Archived workflow\n- SEO fields included\n- Preview before publishing',
        T(-3),
        adminId,
        nowIso(),
        nowIso(),
      ],
    );
    run(
      `INSERT INTO news (title, slug, cover_image, category, author, content, published_at, seo_title, seo_description, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, 'Matches', 'RJNX Admin', ?, ?, '', '', 'published', ?, ?, ?)`,
      [
        'Sample Article: Match Report',
        'sample-article-match-report',
        '',
        'A second sample published article about a match.',
        T(-1),
        adminId,
        nowIso(),
        nowIso(),
      ],
    );
    run(
      `INSERT INTO news (title, slug, cover_image, category, author, content, published_at, seo_title, seo_description, status, created_by, created_at, updated_at)
       VALUES (?, ?, '', 'Drafts', 'RJNX Admin', 'A sample draft — not visible on the public site.', NULL, '', '', 'draft', ?, ?, ?)`,
      ['Sample Article: Draft', 'sample-article-draft', adminId, nowIso(), nowIso()],
    );

    // Media album
    const album = run(
      `INSERT INTO media_albums (title, slug, description, event_date, status, created_at, updated_at)
       VALUES ('Sample Gallery: Launch', 'sample-gallery-launch', 'A sample published album.', date('now', '-5 day'), 'published', ?, ?)`,
      [nowIso(), nowIso()],
    );
    for (const [i, img] of [gallery, newsImg, achImg, proj1].entries()) {
      run(`INSERT INTO media_album_images (album_id, media_id, caption, sort_order) VALUES (?, ?, ?, ?)`, [
        Number(album.lastInsertRowid),
        img.id,
        `Sample photo ${i + 1}`,
        i,
      ]);
    }

    // Recruitment + applications
    const opening1 = run(
      `INSERT INTO recruitment_openings (position, game, role, description, requirements, status, deadline, created_at, updated_at)
       VALUES ('Valorant Player', 'Valorant', 'Duelist', 'Sample open position — apply on the public site.', 'Sample requirement list.', 'open', date('now', '+30 day'), ?, ?)`,
      [nowIso(), nowIso()],
    );
    run(
      `INSERT INTO recruitment_openings (position, game, role, description, requirements, status, deadline, created_at, updated_at)
       VALUES ('Content Editor', '', '', 'A sample closed position.', '', 'closed', NULL, ?, ?)`,
      [nowIso(), nowIso()],
    );
    run(
      `INSERT INTO applications (opening_id, name, gamer_tag, email, age, game, role, experience, profile_link, message, status, created_at, updated_at)
       VALUES (?, 'Sample Applicant', 'SampleApplicant', 'sample.applicant@example.com', 19, 'Valorant', 'Duelist', '2 years competitive', '', 'Sample application message.', 'new', ?, ?)`,
      [Number(opening1.lastInsertRowid), nowIso(), nowIso()],
    );
    run(
      `INSERT INTO applications (opening_id, name, gamer_tag, email, age, game, role, experience, profile_link, message, status, created_at, updated_at)
       VALUES (NULL, 'Another Sample', 'AnotherSample', 'another.sample@example.com', 22, 'BGMI', 'IGL', '3 years', '', '', 'reviewing', ?, ?)`,
      [nowIso(), nowIso()],
    );

    // Contact messages
    run(`INSERT INTO contact_messages (name, email, subject, message, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'unread', ?, ?)`,
      ['Sample Sender', 'sample.sender@example.com', 'Hello!', 'A sample unread message from the contact form.', nowIso(), nowIso()]);
    run(`INSERT INTO contact_messages (name, email, subject, message, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'read', ?, ?)`,
      ['Sample Sender 2', 'sample2@example.com', 'Collab?', 'A sample read message.', T(-1), T(-1)]);
    run(`INSERT INTO contact_messages (name, email, subject, message, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'replied', ?, ?)`,
      ['Sample Sender 3', 'sample3@example.com', 'Question', 'A sample replied message.', T(-2), T(-2)]);
  });

  // Activity trail for the seeded content
  for (const resource of ['website_home', 'projects', 'teams', 'players', 'matches', 'tournaments', 'achievements', 'news', 'media_albums', 'recruitment']) {
    logActivity({ userId: adminId, action: 'create', resourceType: resource, resourceId: 'demo', details: { note: 'demo seed' } });
  }

  console.log('✅ Demo content seeded.');
}
