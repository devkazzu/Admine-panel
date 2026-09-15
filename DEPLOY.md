# 🚀 Making RJNX ADMIN Live (Permanent Deployment)

The admin panel is **one Node process** serving everything: the API, the admin
UI (prebuilt static files) and the uploaded media. It needs exactly two pieces
of durable storage:

| What | Where (default) | Why |
|---|---|---|
| SQLite database | `server/data/rjnx.db` | accounts, sessions, all content |
| Uploaded images | `server/uploads/` | optimized media files |

Everything else is stateless and rebuilt from the repo. On serverless/ephemeral
platforms, **mount a volume** at those two paths (or point `DATABASE_PATH` /
`UPLOADS_DIR` env vars at wherever the volume is mounted) — otherwise data is
lost on every deploy.

Required runtime env vars (see `.env.example` for the full annotated list):

```
NODE_ENV=production
BASE_URL=https://your-deployment-url      # used for absolute media URLs + reset links
SESSION_SECRET=<long random hex>          # openssl rand -hex 48
TRUST_PROXY=true                          # behind the platform's reverse proxy
COOKIE_SECURE=true                        # served over HTTPS
ADMIN_EMAIL / ADMIN_USERNAME / ADMIN_PASSWORD   # first-boot admin (optional but recommended)
```

---

## Option A — Render (recommended, ~5 minutes)

The repo ships a Blueprint ([`render.yaml`](./render.yaml)) that configures
the service, health check, persistent disks and env vars for you.

1. Push this repo to GitHub (already done if you're reading this there).
2. On [render.com](https://render.com) → **New → Blueprint** → pick this repo.
3. When prompted, fill in:
   - `BASE_URL` — `https://rjnx-admin.onrender.com` (or your custom domain)
   - `ADMIN_PASSWORD` — your first-login password
   - `PUBLIC_API_ORIGINS` — your public sites' domains (or leave for later)
4. Apply. First deploy runs `npm run setup && npm run build`, boots on
   `/health`, auto-migrates SQLite and creates the admin user.
5. Log in at `https://<your-service>.onrender.com`, change the password,
   done. Deploys after that are automatic on every push.

> Cost note: persistent disks need Render's **Starter** plan (~$7/mo + ~$2/mo
> for two 1 GB disks). The free plan works for a demo but wipes data on
> restart and sleeps after inactivity.

## Option B — Railway

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub
   repo** → pick this repo.
2. Settings → set **Root Directory** to `/` (repo root) and:
   - Build command: `npm run setup && npm run build`
   - Start command: `npm start`
3. Create a **Volume** mounted at `/app/server/data` (and optionally a second
   one at `/app/server/uploads`).
4. Add the env vars above (Railway injects `PORT` automatically; set
   `BASE_URL` to your Railway public domain).
5. Deploy → open the generated domain → log in.

## Option C — Any host with Docker (VPS, Hetzner, DigitalOcean, Fly.io…)

The repo ships a production [`Dockerfile`](./Dockerfile):

```bash
docker build -t rjnx-admin .

docker run -d --name rjnx-admin -p 80:3000 \
  -v rjnx-data:/app/server/data \
  -v rjnx-uploads:/app/server/uploads \
  -e NODE_ENV=production \
  -e BASE_URL=https://your-domain.com \
  -e SESSION_SECRET=$(openssl rand -hex 48) \
  -e TRUST_PROXY=true -e COOKIE_SECURE=true \
  -e ADMIN_EMAIL=admin@rjnx.local \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=choose-a-strong-password \
  rjnx-admin
```

Put your reverse proxy (Caddy/Nginx/Traefik) in front for HTTPS. Caddy
example:

```
admin.your-domain.com {
  reverse_proxy 127.0.0.1:3000
}
```

### Fly.io quick start

```bash
fly launch --no-deploy            # it reads the Dockerfile
fly volumes create rjnx_data --size 1
fly volumes create rjnx_uploads --size 1
# fly.toml: [mounts] two volumes → "/app/server/data" and "/app/server/uploads"
fly secrets set SESSION_SECRET=$(openssl rand -hex 48) \
  BASE_URL=https://<app>.fly.dev TRUST_PROXY=true COOKIE_SECURE=true \
  ADMIN_PASSWORD=choose-a-strong-password
fly deploy
```

## Option D — Plain Node on a VPS (no Docker)

```bash
git clone https://github.com/devkazzu/Admine-panel.git && cd Admine-panel
npm run setup && npm run build
cp .env.example .env && nano .env    # set SESSION_SECRET, BASE_URL, ADMIN_PASSWORD
npm run db:seed                      # migrations + first admin
npm start                            # :3000 — run under systemd/pm2 + reverse proxy
```

---

## After it's live

1. **Log in and change the admin password** (Profile → Change password).
2. Create real admin accounts for your team (System → Admin Users).
3. Point the two public websites at the API:
   - personal site → `https://<your-url>/api/public/website/content` etc.
   - esports site → `https://<your-url>/api/public/esports/*`
   - set `PUBLIC_API_ORIGINS` to those sites' domains (CORS).
   - every endpoint and response shape is documented in [docs/API.md](./API.md).
4. Optionally configure SMTP (`MAIL_TRANSPORT=smtp` + `SMTP_*`) so password
   reset emails are actually delivered.

## Updating

```bash
git pull && npm run setup && npm run build   # or just let the platform redeploys
```

Migrations apply automatically on boot (`AUTO_MIGRATE=true`). Media and the
database live on volumes, so deploys never touch them.
