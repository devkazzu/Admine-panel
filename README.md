# RJNX ADMIN — Central Management Dashboard

The single, centralized control panel for **both** public websites:

| Website | Role |
|---|---|
| **RJNX** (personal/creator site) | Content managed here, served via the public API |
| **RJNX Esports** | Content managed here, served via the public API |

The two public sites remain **separate frontend experiences** — they read their
content live from this system's **Public Content API** (`/api/public/*`).
Anything an admin changes here (a team, a player's gamer tag, a published news
article, the hero title, social links…) appears on the public sites
automatically, because the sites render whatever these endpoints return.

---

## ✨ Features

- **Secure authentication** — server-side sessions (httpOnly cookies, tokens
  hashed in the DB), bcrypt password hashing, login rate limiting, CSRF
  protection, password reset (email or console transport), session persistence.
- **Role-based access control** — Super Admin / Editor / Moderator with
  server-enforced permissions on every endpoint and a permission-filtered UI.
- **RJNX Website management** — Home (hero, CTAs), About (bio, interests,
  skills), Projects (CRUD + publish), YouTube (channel + featured videos),
  Social Links, Contact Messages (unread/read/replied/archived).
- **RJNX Esports management** — Teams, Players (manual stats), Matches
  (upcoming → live → completed with auto-derived results), Results,
  Tournaments, Achievements, News (Markdown + SEO + preview + publish),
  Media albums, Recruitment openings, Applications
  (new → reviewing → shortlisted → accepted/rejected).
- **Media library** — drag & drop upload, automatic optimization
  (max 1920px, WebP q82, thumbnails), search, alt-text editing, copy URL and
  **reference-safe deletion** (blocked while content still uses an image).
- **System** — central site settings (General / SEO / Contact), admin user
  management, full activity audit log.
- **Dashboard** — live statistics from the database only. Charts render only
  when real data exists; no fabricated numbers.
- **UI** — dark premium SaaS-style interface, responsive (mobile drawer
  sidebar, stacking cards, scrollable tables), sidebar, topbar, global search
  (⌘K), notifications, breadcrumbs, data tables, filters, pagination, modals,
  confirmation dialogs, toasts, empty/loading/error states everywhere.

## 🧱 Tech stack

| Layer | Choice |
|---|---|
| Admin UI | React 19 · TypeScript · Vite · Tailwind CSS · Lucide icons |
| API | Node.js · Express · TypeScript (strict) |
| Database | SQLite (relational) via Node's built-in `node:sqlite` driver — zero native compilation |
| Auth | bcrypt + opaque session tokens (SHA-256 hashed) in httpOnly cookies |
| Validation | zod on every input (server-side, authoritative) |
| Images | sharp (resize + WebP + thumbnails) |

> Requires **Node ≥ 22.5** (for the built-in SQLite driver).

## 🚀 Getting started

```bash
# 1. install dependencies (root + server + client)
npm run setup

# 2. configure environment
cp .env.example .env       # then edit — set SESSION_SECRET and ADMIN_PASSWORD

# 3. database (migrations + bootstrap: roles, content singletons, first admin)
npm run db:seed            # optional: npm run db:seed:demo for labelled sample data

# 4. development (API on :4001, admin UI on :5173 with proxy)
npm run dev

# 5. production build + run (single server on :3000 serving UI + API + media)
npm run build
npm start
```

Open the admin UI (dev: `http://localhost:5173`, prod: `http://localhost:3000`)
and sign in with the bootstrap admin from your `.env`
(`ADMIN_EMAIL` / `ADMIN_USERNAME` / `ADMIN_PASSWORD`). If no password is
configured, a random one is generated and printed to the server log **once**.

### Default credentials

None are hardcoded. The first admin is created from `.env` values on first
boot/seed. Change the password after the first login (Profile → Change
password).

## 🔐 Environment variables

See [`.env.example`](./.env.example) for the full annotated list. Highlights:

| Variable | Purpose |
|---|---|
| `PORT`, `NODE_ENV`, `BASE_URL` | Server binding + public URL (used for absolute media URLs + reset links) |
| `SESSION_SECRET` | Signs session cookies — set a long random string in production |
| `COOKIE_SECURE` | Force `Secure` cookies (auto in production) |
| `DATABASE_PATH` | SQLite file location (default `server/data/rjnx.db`) |
| `ADMIN_EMAIL` / `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Bootstrap super admin |
| `PUBLIC_API_ORIGINS` | CORS allow-list for the public content API (`*` or comma-separated origins) |
| `MAIL_TRANSPORT`, `SMTP_*`, `MAIL_FROM` | `console` (default — reset links printed to the log) or `smtp` for real email |
| `MAX_UPLOAD_MB` | Upload size cap (images are optimized regardless) |

**Never commit `.env`.** It is git-ignored; `.env.example` contains keys only.

## 👥 Roles & permissions

| Area | Super Admin | Editor | Moderator |
|---|:--:|:--:|:--:|
| Dashboard | ✅ | ✅ | ✅ |
| Website content (home/about/projects/YouTube/socials) | ✅ | ✅ | read |
| Contact messages | ✅ | ✅ | ✅ |
| Esports content (teams/players/matches/tournaments/achievements/news/albums) | ✅ | ✅ | players + matches write, rest read |
| Media library | ✅ | ✅ | upload + read |
| Recruitment + applications | ✅ | ✅ | ✅ |
| Site settings | ✅ | ✅ | read |
| Admin users | ✅ | ❌ | ❌ |
| Activity logs | ✅ | ✅ | ❌ |

Permissions live in the `roles` table and are enforced **server-side** on every
route (`requirePermission`); the UI only hides what the API would reject.
Guards: the last active Super Admin cannot be deleted, demoted or deactivated;
you cannot delete or demote yourself.

## 🗄️ Database

SQLite with explicit, versioned migrations (`server/src/db/migrations/*.sql`),
applied by `npm run db:migrate` or automatically on boot (`AUTO_MIGRATE`).

**Tables:** `roles`, `admin_users`, `sessions`, `password_reset_tokens`,
`settings`, `website_home`, `website_about`, `youtube_channel`,
`featured_videos`, `social_links`, `projects`, `teams`, `players`,
`tournaments`, `matches`, `achievements`, `news`, `media`, `media_albums`,
`media_album_images`, `recruitment_openings`, `applications`,
`contact_messages`, `activity_logs`.

Relationships: players → teams (SET NULL on delete), matches → teams +
tournaments, album images → media (no file duplication), applications →
openings, sessions/logs/reset tokens → admin users, admin users → roles.

## 🔌 Public website integration

The two public sites fetch live content — no build step, no coupling:

```
GET /api/public/website/content      → home + about + active socials
GET /api/public/website/projects     → published projects
GET /api/public/website/youtube      → channel + featured videos
GET /api/public/esports/teams        → active/recruiting teams with players
GET /api/public/esports/matches?status=upcoming|live|completed|cancelled
GET /api/public/esports/results      → completed matches with scores
GET /api/public/esports/tournaments  GET /api/public/esports/achievements
GET /api/public/esports/news         → published articles (listing)
GET /api/public/esports/news/:slug   → full article
GET /api/public/esports/media        → published albums with images
GET /api/public/esports/recruitment  → open openings
GET /api/public/settings             → public settings subset
POST /api/public/contact             → contact form submissions
POST /api/public/applications        → recruitment applications
```

Full request/response reference: [docs/API.md](./docs/API.md).
Configure `PUBLIC_API_ORIGINS` to the public sites' domains. Admin endpoints
are same-origin only and always require an authenticated session.

## 🛡️ Security notes

- Passwords: bcrypt (12 rounds) — never plain text, never reversible.
- Sessions: opaque 256-bit tokens; only their SHA-256 hash is stored; httpOnly
  + SameSite=Lax cookies (+ Secure in production); sliding 7-day expiry.
- CSRF: custom-header + origin checks on all mutating admin routes; public
  POSTs are CORS + rate-limited + honeypotted.
- SQL: 100% prepared statements with bound parameters (incl. `node:sqlite`).
- Input: zod validation server-side on body/query/params for every route.
- Headers: helmet (CSP, HSTS, nosniff, frame protection).
- Rate limits: login (10/15min/IP), forgot-password (5/15min/IP), public
  submissions (10/h/IP).
- Media deletion is blocked while content references the file.
- Audit: every login/logout/CRUD/publish/settings action is recorded in
  `activity_logs` with user, resource and IP.

## ✅ Testing

```bash
npm test         # end-to-end smoke suite (68 checks) on a throwaway database
npm run typecheck
npm run build    # production build (typecheck + vite build)
```

The smoke suite boots the real app and exercises: authentication (success,
failure, CSRF, deactivation), session persistence, RBAC denials for
editor/moderator, every major CRUD flow (projects, teams, players, matches,
tournaments, news publish/unpublish, recruitment, applications, messages,
settings, media upload with reference-blocking), validation errors (422 with
field details), public API visibility rules, password change/reset flows and
logout invalidation.

## 🧪 Demo data

`npm run db:seed:demo` inserts clearly-labelled **Sample** content (teams,
players, matches, articles, gallery, applications…) so the panel can be
explored. It is ordinary content — edit or delete it freely, or start clean by
deleting `server/data/rjnx.db` and re-running `npm run db:seed`.
No real contact information or statistics are invented anywhere.

## 📁 Project structure

```
├── package.json            # orchestration scripts (dev/build/start/test/seed)
├── .env.example            # environment template (keys only — no secrets)
├── docs/API.md             # full API reference
├── server/                 # Express + TypeScript API
│   ├── src/
│   │   ├── config.ts       # env loading & validation
│   │   ├── app.ts          # middleware + route mounting + static serving
│   │   ├── core/           # errors, utils, pagination, types
│   │   ├── db/             # connection, migrations, seed, CLI
│   │   ├── middleware/     # auth/session, RBAC, CSRF, rate limit, validation, errors
│   │   ├── routes/         # auth, dashboard, search, notifications,
│   │   │                   # website/*, esports/*, media, settings, users, logs, public
│   │   └── services/       # activity log, mailer, media references
│   ├── test/smoke.ts       # end-to-end smoke suite
│   ├── data/               # SQLite database (git-ignored)
│   └── uploads/            # optimized media files (git-ignored)
└── client/                 # React + Vite + Tailwind admin UI
    └── src/
        ├── auth/           # AuthContext + guards
        ├── lib/            # API client, types, hooks, constants, formatting
        ├── components/     # ui kit, layout shell, generic CrudPage
        └── pages/          # website/ esports/ system/ profile/ + auth pages
```
