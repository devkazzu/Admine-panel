# RJNX ADMIN — API Reference

Base URL: the server origin (dev `http://localhost:4001`, or the production
deployment). All responses are JSON. Successful bodies are wrapped in
`{ "data": … }`; errors use:

```json
{ "error": { "message": "…", "code": "…", "details": [ … ] } }
```

Status codes: `200` OK · `201` created · `204` deleted · `400` bad request ·
`401` unauthenticated · `403` forbidden / CSRF / deactivated · `404` not found ·
`409` conflict (duplicate slug/email, referenced media, last-super-admin) ·
`413` file too large · `415` unsupported media · `422` validation failed
(`details` = `[{ "path": ["field"], "message": "…" }]`) · `429` rate limited.

---

## Conventions

- **Authentication** — session cookie (`rjnx_admin_session`, httpOnly). Sent
  automatically by the browser; login gives it to you.
- **CSRF** — every mutating admin request must send the header
  `X-Requested-With: fetch` (the admin UI always does).
- **Pagination** — list endpoints accept `?page=1&perPage=20` (max 100) and
  return `{ "data": [...], "meta": { "page", "perPage", "total", "totalPages" } }`.
- **Search** — `?q=` free-text search where supported.
- **Media URLs** — image fields store a path (`/uploads/…`); public endpoints
  return absolute URLs built from `BASE_URL`.

---

# Admin API (`/api/admin/*` — session required, permission checked)

## Auth `/api/auth/*`

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/login` | `{ identifier, password }` | email **or** username; rate-limited 10/15min/IP |
| GET | `/me` | — | current user + permissions |
| POST | `/logout` | — | invalidates session |
| PUT | `/change-password` | `{ currentPassword, newPassword }` | newPassword ≥ 10 chars |
| POST | `/forgot-password` | `{ email }` | generic response; link emailed (SMTP) or printed (console transport) |
| POST | `/reset-password` | `{ token, newPassword }` | token valid 1h, single use |

## Dashboard / search / notifications

| Method | Path | Description |
|---|---|---|
| GET | `/admin/dashboard` | live stats, chart datasets, recent feeds |
| GET | `/admin/search?q=` | global search across resources (permission-filtered) |
| GET | `/admin/notifications` | unread message/application counts + latest items |

## RJNX Website

| Method | Path | Permission | Description |
|---|---|---|---|
| GET/PUT | `/admin/website/home` | `website_content` | hero title/subtitle/description/image, two CTA buttons |
| GET/PUT | `/admin/website/about` | `website_content` | biography, profile image, `interests[]`, `skills[{name,level}]` |
| GET/PUT | `/admin/website/youtube` | `website_content` | channel URL + description |
| CRUD | `/admin/website/youtube/videos` | `videos` | featured videos (`title`, `url`, `sort_order`) |
| CRUD | `/admin/website/socials` | `socials` | one link per platform: `platform`, `url`, `label`, `is_active`, `sort_order` |
| CRUD | `/admin/website/projects` | `projects` | `name`, `slug` (auto), `description`, `image`, `github_url`, `live_url`, `technologies[]`, `status` draft/published, `featured`, `sort_order` |
| GET | `/admin/website/messages?status=&q=` | `messages` | paginated contact messages |
| GET | `/admin/website/messages/:id` | `messages` | single message |
| PATCH | `/admin/website/messages/:id/status` | `messages:write` | `{ status: unread\|read\|replied\|archived }` |
| DELETE | `/admin/website/messages/:id` | `messages:write` | |

## RJNX Esports

Standard CRUD = `GET /` (list, paginated), `POST /`, `GET /:id`,
`PATCH /:id` (partial), `DELETE /:id`.

| Resource | Path (under `/api/admin`) | Permission | Key fields |
|---|---|---|---|
| Teams | `/esports/teams` | `teams` | `name`, `slug`, `game`, `logo`, `description`, `status` active/inactive/recruiting, `socials{}`, `sort_order` |
| Players | `/esports/players` | `players` | `gamer_tag`, `real_name`, `image`, `game`, `team_id`, `role`, `country`, `biography`, `socials{}`, `stats[{label,value}]`, `status` active/inactive |
| Matches | `/esports/matches` | `matches` | `team_id`, `opponent_name`, `opponent_logo`, `game`, `tournament_id`, `starts_at` (ISO), `stream_url`, `our_score`, `opponent_score`, `result`, `status` upcoming/live/completed/cancelled, `notes` |
| Tournaments | `/esports/tournaments` | `tournaments` | `name`, `game`, `organizer`, `start_date`, `end_date`, `location`, `is_online`, `prize_pool`, `description`, `status`, `result` |
| Achievements | `/esports/achievements` | `achievements` | `title`, `description`, `game`, `tournament`, `date`, `position`, `image` |
| News | `/esports/news` | `news` | `title`, `slug`, `cover_image`, `category`, `author`, `content` (Markdown), `published_at`, `seo_title`, `seo_description`, `status` draft/published/archived |
| Albums | `/esports/media-albums` | `media_albums` | `title`, `slug`, `description`, `event_date`, `status` draft/published |
| Recruitment | `/esports/recruitment` | `recruitment` | `position`, `game`, `role`, `description`, `requirements`, `status` open/closed, `deadline` |

Extras:

| Method | Path | Description |
|---|---|---|
| PATCH | `/esports/matches/:id/status` | quick transition `{ status, our_score?, opponent_score? }` — completing derives win/loss/draw automatically |
| PATCH | `/esports/news/:id/publish` · `/:id/unpublish` | one-click workflow (sets `published_at` on first publish) |
| GET | `/esports/media-albums/:id/full` | album with images |
| PUT | `/esports/media-albums/:id/images` | replace image set `{ images: [{ media_id, caption, sort_order }] }` |
| GET | `/esports/applications?status=&opening_id=&q=` | paginated applications |
| GET/PATCH | `/esports/applications/:id` · `/:id/status` · `/:id/notes` | status: new/reviewing/shortlisted/rejected/accepted |

## Media library `/api/admin/media`

| Method | Path | Description |
|---|---|---|
| GET | `/?q=&format=&page=` | paginated library |
| POST | `/` | **multipart** `file` field (JPEG/PNG/WebP/GIF/AVIF) → optimized WebP ≤1920px + 480px thumbnail |
| GET/PATCH | `/:id` | read / update `alt_text`, `original_name`, `folder` |
| GET | `/:id/references` | content currently using this image |
| DELETE | `/:id` | blocked with `409` + reference list while in use |

## Settings `/api/admin/settings`

- `GET /` → `{ general, seo, contact }` groups.
- `PUT /:group` (`general` | `seo` | `contact`) with the group's fields —
  validated per group, changes recorded in the activity log.

## Admin users `/api/admin/users` (Super Admin)

| Method | Path | Body / notes |
|---|---|---|
| GET | `/roles` | role catalogue with permissions |
| GET | `/?q=&role_key=` | paginated users (no password hashes) |
| POST | `/` | `{ email, username, name, role_key, password }` |
| PATCH | `/:id` | `{ name?, role_key?, is_active? }` (guards: no self role/status change, last super admin protected) |
| POST | `/:id/reset-password` | `{ newPassword }` — signs out all their sessions |
| DELETE | `/:id` | (guards: not yourself, not the last super admin) |

## Activity logs `/api/admin/activity-logs`

`GET /?q=&action=&resource_type=&user_id=&from=&to=&page=` (read-only) and
`GET /actions` (action catalogue). Actions include `login`, `logout`,
`login_failed`, `create`, `update`, `delete`, `publish`, `unpublish`,
`status_change`, `settings_update`, `password_change`, `password_reset`,
`media_upload`, `media_delete`, `account_*`, `role_changed`.

---

# Public API (`/api/public/*` — no auth, CORS per `PUBLIC_API_ORIGINS`)

Only **published / active** content is ever returned. Admin-only fields never
leak. `Cache-Control: public, max-age=30` on GETs.

## RJNX personal website

| Method | Path | Returns |
|---|---|---|
| GET | `/website/content` | `{ home, about, socials }` — one call for the whole site shell |
| GET | `/website/home` | hero fields + absolute `hero_image` |
| GET | `/website/about` | biography, `profile_image`, `interests[]`, `skills[]` |
| GET | `/website/projects` | published projects (featured first) with `technologies[]` |
| GET | `/website/youtube` | `{ channel, featured_videos }` — no invented statistics |
| GET | `/website/socials` | active links only (unconfigured platforms absent) |

## RJNX Esports website

| Method | Path | Returns |
|---|---|---|
| GET | `/esports/teams` | active/recruiting teams, each with active players (incl. manual `stats`, `socials`) |
| GET | `/esports/teams/:slug` | one team + players |
| GET | `/esports/players` | active players with team name/slug |
| GET | `/esports/matches?status=upcoming\|live\|completed\|cancelled` | default: upcoming + live, soonest first |
| GET | `/esports/results` | completed + cancelled, newest first, with scores + result |
| GET | `/esports/tournaments` | tournament records |
| GET | `/esports/achievements` | trophy cabinet (newest first) |
| GET | `/esports/news?category=&limit=` | published articles: `excerpt`, `seo_*`, absolute `cover_image` |
| GET | `/esports/news/:slug` | full Markdown `content` |
| GET | `/esports/media` | published albums with ordered image URLs |
| GET | `/esports/recruitment` | open, non-expired openings |
| GET | `/settings` | public subset (site name/description, SEO defaults, configured contact info) |

## Public submissions (from the public sites)

| Method | Path | Body | Protection |
|---|---|---|---|
| POST | `/contact` | `{ name, email, subject, message, website: "" }` | zod validation, honeypot (`website` must be empty), 10/h/IP |
| POST | `/applications` | `{ opening_id?, name, gamer_tag, email, age?, game, role, experience, profile_link, message, website: "" }` | same + opening must be open & unexpired |

Both create records visible in the admin panel immediately (messages as
**unread**, applications as **new** — feeding the notification bell).

---

## Examples

```bash
# login (save cookies)
curl -c jar -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' -H 'X-Requested-With: fetch' \
  -d '{"identifier":"admin","password":"your-password"}'

# create a team
curl -b jar -X POST http://localhost:3000/api/admin/esports/teams \
  -H 'Content-Type: application/json' -H 'X-Requested-With: fetch' \
  -d '{"name":"RJNX Valorant","game":"Valorant","status":"active"}'

# public site reads it instantly
curl http://localhost:3000/api/public/esports/teams
```
