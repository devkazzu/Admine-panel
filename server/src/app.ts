/**
 * Express app assembly.
 *
 * Production layout: this server serves the built admin UI (client/dist),
 * the /uploads media and the JSON API on a single port.
 * Development: the Vite dev server proxies /api + /uploads here.
 */
import fs from 'node:fs';
import path from 'node:path';
import express, { Router } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { loadSession } from './middleware/auth';
import { csrfGuard } from './middleware/csrf';
import { apiNotFound, errorHandlerWithMulter } from './middleware/errorHandler';
import { authRouter } from './routes/auth.routes';
import { dashboardRouter } from './routes/dashboard.routes';
import { searchRouter } from './routes/search.routes';
import { notificationsRouter } from './routes/notifications.routes';
import { websiteRouter } from './routes/website.routes';
import { projectsRouter } from './routes/projects.routes';
import { socialsRouter } from './routes/socials.routes';
import { messagesRouter } from './routes/messages.routes';
import { teamsRouter } from './routes/teams.routes';
import { playersRouter } from './routes/players.routes';
import { matchesRouter } from './routes/matches.routes';
import { tournamentsRouter } from './routes/tournaments.routes';
import { achievementsRouter } from './routes/achievements.routes';
import { newsRouter } from './routes/news.routes';
import { albumsRouter } from './routes/albums.routes';
import { recruitmentRouter } from './routes/recruitment.routes';
import { applicationsRouter } from './routes/applications.routes';
import { mediaRouter } from './routes/media.routes';
import { settingsRouter } from './routes/settings.routes';
import { usersRouter } from './routes/users.routes';
import { logsRouter } from './routes/logs.routes';
import { publicRouter, publicCors } from './routes/public.routes';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(
    helmet({
      // The admin SPA + Google Fonts. Dev (Vite HMR) needs inline scripts.
      contentSecurityPolicy: config.isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
              imgSrc: ["'self'", 'data:', 'blob:'],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
      // Uploaded images are embedded by the public websites (cross-origin).
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Tiny request log (dev only)
  if (!config.isProduction) {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
          console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - start}ms)`);
        }
      });
      next();
    });
  }

  app.get('/health', (req, res) => res.json({ status: 'ok', service: 'rjnx-admin-api' }));

  // Uploaded media (served with long cache — filenames are unique UUIDs)
  app.use('/uploads', express.static(config.uploadsDir, { maxAge: '30d', fallthrough: true }));

  // ── API ───────────────────────────────────────────────────────────────────
  app.use('/api', loadSession, csrfGuard);

  app.use('/api/auth', authRouter);

  const admin = Router();
  admin.use('/dashboard', dashboardRouter);
  admin.use('/search', searchRouter);
  admin.use('/notifications', notificationsRouter);
  admin.use('/website', websiteRouter);
  admin.use('/website/projects', projectsRouter);
  admin.use('/website/socials', socialsRouter);
  admin.use('/website/messages', messagesRouter);
  admin.use('/esports/teams', teamsRouter);
  admin.use('/esports/players', playersRouter);
  admin.use('/esports/matches', matchesRouter);
  admin.use('/esports/tournaments', tournamentsRouter);
  admin.use('/esports/achievements', achievementsRouter);
  admin.use('/esports/news', newsRouter);
  admin.use('/esports/media-albums', albumsRouter);
  admin.use('/esports/recruitment', recruitmentRouter);
  admin.use('/esports/applications', applicationsRouter);
  admin.use('/media', mediaRouter);
  admin.use('/settings', settingsRouter);
  admin.use('/users', usersRouter);
  admin.use('/activity-logs', logsRouter);
  app.use('/api/admin', admin);

  app.use('/api/public', publicCors, publicRouter);

  app.use('/api', apiNotFound);

  // ── Built admin UI (production) ───────────────────────────────────────────
  if (fs.existsSync(path.join(config.clientDist, 'index.html'))) {
    app.use(
      express.static(config.clientDist, {
        index: false,
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          if (filePath.startsWith(path.join(config.clientDist, 'assets'))) {
            res.set('Cache-Control', 'public, max-age=31536000, immutable'); // hashed filenames
          }
        },
      }),
    );
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
      res.sendFile(path.join(config.clientDist, 'index.html'));
    });
  }

  app.use(errorHandlerWithMulter);
  return app;
}
