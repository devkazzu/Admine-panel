/**
 * Database CLI — `tsx src/db/cli.ts <command>`
 *   migrate       apply pending migrations
 *   seed          bootstrap roles/singletons/admin (idempotent)
 *   seed --demo   bootstrap + clearly-labelled sample content
 */
import { config } from '../config';
import { migrate } from './migrate';
import { ensureBootstrap, seedDemo } from './seed';

const [command, ...flags] = process.argv.slice(2);

switch (command) {
  case 'migrate': {
    const ran = migrate();
    console.log(ran.length ? `Applied ${ran.length} migration(s): ${ran.join(', ')}` : 'Nothing to migrate.');
    process.exit(0);
    break;
  }
  case 'seed': {
    migrate();
    ensureBootstrap();
    if (flags.includes('--demo')) {
      await seedDemo();
    } else {
      console.log('✅ Bootstrap complete (roles, content singletons, admin user).');
      console.log('   Tip: `npm run db:seed:demo` inserts clearly-labelled sample content.');
    }
    process.exit(0);
    break;
  }
  default: {
    console.log(`rjnx-admin db cli — database: ${config.databasePath}`);
    console.log('Usage: tsx src/db/cli.ts <migrate|seed [--demo]>');
    process.exit(command ? 1 : 0);
  }
}
