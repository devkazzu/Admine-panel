# syntax=docker/dockerfile:1
#
# RJNX ADMIN — single-container production image
# (API + admin UI + SQLite + media uploads on one Node process)
#
# Build:  docker build -t rjnx-admin .
# Run:    docker run -p 3000:3000 \
#           -v rjnx-data:/app/server/data \
#           -v rjnx-uploads:/app/server/uploads \
#           -e SESSION_SECRET=$(openssl rand -hex 48) \
#           -e BASE_URL=https://your-domain.com \
#           -e ADMIN_PASSWORD=change-me \
#           rjnx-admin
#
# Requires Docker 23+ (COPY --link) and Node 22 base image (node:sqlite).

# ── Stage 1: build the admin UI ──────────────────────────────────────────────
FROM node:22-slim AS uibuild
WORKDIR /app

COPY client/package.json client/package-lock.json ./client/
RUN npm --prefix client ci

COPY client ./client
# Output: /app/client/dist
RUN npm --prefix client run build

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    AUTO_MIGRATE=true

# Server dependencies (tsx runs the API, so dev deps are included)
COPY server/package.json server/package-lock.json ./server/
RUN npm --prefix server ci --include=dev

COPY server ./server
COPY package.json ./

# Prebuilt admin UI from stage 1
COPY --from=uibuild /app/client/dist ./client/dist

# Durable data lives on mounted volumes (never inside the image)
VOLUME ["/app/server/data", "/app/server/uploads"]

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# First boot: auto-migrates and creates the admin user from ADMIN_* env vars
CMD ["npm", "start"]
