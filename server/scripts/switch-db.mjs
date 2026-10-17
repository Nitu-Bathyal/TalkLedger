import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prismaDir = path.resolve(__dirname, '../prisma');

const target = (process.argv[2] || '').toLowerCase();

if (target === 'sqlite') {
  const source = path.join(prismaDir, 'schema.sqlite.prisma');
  const dest = path.join(prismaDir, 'schema.prisma');
  fs.copyFileSync(source, dest);
  console.log('[TalkLedger DB] Configured prisma/schema.prisma for SQLite provider.');
} else if (target === 'postgres' || target === 'postgresql') {
  const source = path.join(prismaDir, 'schema.postgres.prisma');
  const dest = path.join(prismaDir, 'schema.prisma');
  fs.copyFileSync(source, dest);
  console.log('[TalkLedger DB] Configured prisma/schema.prisma for PostgreSQL provider.');
} else {
  console.error('[TalkLedger DB] Error: Invalid provider target. Usage: node scripts/switch-db.js [sqlite|postgres]');
  process.exit(1);
}
