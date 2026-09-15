/**
 * API server entry point.
 * Boot order: migrations → bootstrap (roles, singletons, first admin) → listen.
 */
import { config } from './config';
import { migrate } from './db/migrate';
import { ensureBootstrap } from './db/seed';
import { createApp } from './app';

if (config.autoMigrate) migrate();
ensureBootstrap();

const app = createApp();

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log('');
  console.log('  ┌─────────────────────────────────────────────┐');
  console.log('  │  RJNX ADMIN — Central Management Dashboard  │');
  console.log('  └─────────────────────────────────────────────┘');
  console.log(`  API      http://localhost:${config.port}/api`);
  console.log(`  Health   http://localhost:${config.port}/health`);
  console.log(`  Public   ${config.baseUrl}/api/public/*`);
  if (config.isProduction) console.log(`  Admin UI ${config.baseUrl}`);
  else console.log(`  Admin UI http://localhost:5173 (npm run dev at repo root)`);
  console.log(`  Env      ${config.env}`);
  console.log('');
});

const shutdown = (signal: string) => {
  console.log(`\n${signal} received — shutting down…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
