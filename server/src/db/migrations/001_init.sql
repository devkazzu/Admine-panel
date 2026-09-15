-- ─────────────────────────────────────────────────────────────────────────────
-- RJNX ADMIN — initial schema (SQLite)
-- Central content database for the RJNX personal website + RJNX Esports.
-- ─────────────────────────────────────────────────────────────────────────────

-- Roles & admin users ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key         TEXT NOT NULL UNIQUE,                -- super_admin | editor | moderator
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  permissions TEXT NOT NULL DEFAULT '[]',          -- JSON array, '*' = everything
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  username      TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,                     -- bcrypt, never plain text
  role_id       INTEGER NOT NULL REFERENCES roles(id),
  is_active     INTEGER NOT NULL DEFAULT 1,
  avatar_url    TEXT NOT NULL DEFAULT '',
  last_login_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role_id);

-- Server-side sessions (token stored hashed, cookie holds the random token) ─
CREATE TABLE IF NOT EXISTS sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  user_id    INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip         TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Central site settings (key/value) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by INTEGER REFERENCES admin_users(id) ON DELETE SET NULL
);

-- RJNX personal website: single-row content blocks ────────────────────────────
CREATE TABLE IF NOT EXISTS website_home (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT CHECK (id = 1),
  hero_title          TEXT NOT NULL DEFAULT '',
  hero_subtitle       TEXT NOT NULL DEFAULT '',
  description         TEXT NOT NULL DEFAULT '',
  hero_image          TEXT NOT NULL DEFAULT '',
  cta_primary_label   TEXT NOT NULL DEFAULT '',
  cta_primary_url     TEXT NOT NULL DEFAULT '',
  cta_secondary_label TEXT NOT NULL DEFAULT '',
  cta_secondary_url   TEXT NOT NULL DEFAULT '',
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by          INTEGER REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS website_about (
  id           INTEGER PRIMARY KEY AUTOINCREMENT CHECK (id = 1),
  biography    TEXT NOT NULL DEFAULT '',
  profile_image TEXT NOT NULL DEFAULT '',
  interests    TEXT NOT NULL DEFAULT '[]',          -- JSON array of strings
  skills       TEXT NOT NULL DEFAULT '[]',          -- JSON array of {name, level}
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by   INTEGER REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS youtube_channel (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT CHECK (id = 1),
  channel_url        TEXT NOT NULL DEFAULT '',
  channel_description TEXT NOT NULL DEFAULT '',
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by         INTEGER REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS featured_videos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  url        TEXT NOT NULL,                        -- YouTube video URL or 11-char ID
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Social links (site-level — teams/players carry their own socials JSON) ─────
CREATE TABLE IF NOT EXISTS social_links (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_type TEXT NOT NULL DEFAULT 'site' CHECK (owner_type IN ('site')),
  owner_id   INTEGER NOT NULL DEFAULT 0,
  platform   TEXT NOT NULL CHECK (platform IN
    ('youtube','github','instagram','discord','x','tiktok','twitch','facebook')),
  url        TEXT NOT NULL,
  label      TEXT NOT NULL DEFAULT '',
  is_active  INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_social_links_owner_platform
  ON social_links(owner_type, owner_id, platform);

-- Projects (personal website) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  description  TEXT NOT NULL DEFAULT '',
  image        TEXT NOT NULL DEFAULT '',
  github_url   TEXT NOT NULL DEFAULT '',
  live_url     TEXT NOT NULL DEFAULT '',
  technologies TEXT NOT NULL DEFAULT '[]',          -- JSON array of strings
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  featured     INTEGER NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Esports: teams & players ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  game        TEXT NOT NULL DEFAULT '',
  logo        TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','recruiting')),
  socials     TEXT NOT NULL DEFAULT '{}',           -- JSON {platform: url}
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_teams_status ON teams(status);

CREATE TABLE IF NOT EXISTS players (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  gamer_tag  TEXT NOT NULL,
  real_name  TEXT NOT NULL DEFAULT '',
  image      TEXT NOT NULL DEFAULT '',
  game       TEXT NOT NULL DEFAULT '',
  team_id    INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  role       TEXT NOT NULL DEFAULT '',
  country    TEXT NOT NULL DEFAULT '',
  biography  TEXT NOT NULL DEFAULT '',
  socials    TEXT NOT NULL DEFAULT '{}',            -- JSON {platform: url}
  stats      TEXT NOT NULL DEFAULT '[]',            -- JSON [{label, value}] — manual
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_players_status ON players(status);

-- Tournaments & matches ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tournaments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  game        TEXT NOT NULL DEFAULT '',
  organizer   TEXT NOT NULL DEFAULT '',
  start_date  TEXT NOT NULL DEFAULT '',
  end_date    TEXT,
  location    TEXT NOT NULL DEFAULT '',
  is_online   INTEGER NOT NULL DEFAULT 0,
  prize_pool  TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming','ongoing','completed','cancelled')),
  result      TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);

CREATE TABLE IF NOT EXISTS matches (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id         INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  opponent_name   TEXT NOT NULL,
  opponent_logo   TEXT NOT NULL DEFAULT '',
  game            TEXT NOT NULL DEFAULT '',
  tournament_id   INTEGER REFERENCES tournaments(id) ON DELETE SET NULL,
  starts_at       TEXT NOT NULL,
  stream_url      TEXT NOT NULL DEFAULT '',
  our_score       INTEGER,
  opponent_score  INTEGER,
  result          TEXT NOT NULL DEFAULT 'pending' CHECK (result IN ('win','loss','draw','pending')),
  status          TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming','live','completed','cancelled')),
  notes           TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_starts_at ON matches(starts_at);
CREATE INDEX IF NOT EXISTS idx_matches_team ON matches(team_id);
CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament_id);

CREATE TABLE IF NOT EXISTS achievements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  game        TEXT NOT NULL DEFAULT '',
  tournament  TEXT NOT NULL DEFAULT '',
  date        TEXT NOT NULL DEFAULT '',
  position    TEXT NOT NULL DEFAULT '',
  image       TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- News / articles ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS news (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  cover_image     TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL DEFAULT '',
  author          TEXT NOT NULL DEFAULT '',
  content         TEXT NOT NULL DEFAULT '',          -- Markdown
  published_at    TEXT,
  seo_title       TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_by      INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_news_status ON news(status);
CREATE INDEX IF NOT EXISTS idx_news_published_at ON news(published_at);

-- Media library ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  filename       TEXT NOT NULL UNIQUE,
  original_name  TEXT NOT NULL,
  path           TEXT NOT NULL UNIQUE,              -- /uploads/media/...
  thumb_path     TEXT NOT NULL DEFAULT '',          -- optimized small preview
  mime           TEXT NOT NULL,
  format         TEXT NOT NULL DEFAULT '',
  size           INTEGER NOT NULL DEFAULT 0,        -- bytes (optimized file)
  width          INTEGER,
  height         INTEGER,
  alt_text       TEXT NOT NULL DEFAULT '',
  folder         TEXT NOT NULL DEFAULT '',
  uploaded_by    INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_media_created ON media(created_at);

-- Esports media gallery (albums reference media library items — no duplication)
CREATE TABLE IF NOT EXISTS media_albums (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  event_date  TEXT,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS media_album_images (
  album_id   INTEGER NOT NULL REFERENCES media_albums(id) ON DELETE CASCADE,
  media_id   INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  caption    TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (album_id, media_id)
);
CREATE INDEX IF NOT EXISTS idx_album_images_media ON media_album_images(media_id);

-- Recruitment ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recruitment_openings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  position     TEXT NOT NULL,
  game         TEXT NOT NULL DEFAULT '',
  role         TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  requirements TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  deadline     TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_recruitment_status ON recruitment_openings(status);

CREATE TABLE IF NOT EXISTS applications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  opening_id   INTEGER REFERENCES recruitment_openings(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  gamer_tag    TEXT NOT NULL,
  email        TEXT NOT NULL,
  age          INTEGER,
  game         TEXT NOT NULL DEFAULT '',
  role         TEXT NOT NULL DEFAULT '',
  experience   TEXT NOT NULL DEFAULT '',
  profile_link TEXT NOT NULL DEFAULT '',
  message      TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','reviewing','shortlisted','rejected','accepted')),
  admin_notes  TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),   -- submitted date
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_opening ON applications(opening_id);

-- Contact messages (from the personal website contact form) ───────────────────
CREATE TABLE IF NOT EXISTS contact_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  subject    TEXT NOT NULL DEFAULT '',
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread','read','replied','archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_status ON contact_messages(status);

-- Activity log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,                       -- login|logout|create|update|delete|publish|...
  resource_type TEXT NOT NULL DEFAULT '',
  resource_id   TEXT NOT NULL DEFAULT '',
  details       TEXT NOT NULL DEFAULT '',            -- JSON
  ip            TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_logs(action);
