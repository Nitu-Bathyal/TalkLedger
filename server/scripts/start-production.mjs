import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.resolve(__dirname, '..');

// Load environment from .env if present
dotenv.config({ path: path.join(serverDir, '.env') });

console.log('[TalkLedger Startup] Initializing TalkLedger production environment...');

// 1. Ensure DATABASE_URL is defined; default to SQLite dev.db if unconfigured
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
  console.log('[TalkLedger Startup] DATABASE_URL not set in environment. Defaulting to local SQLite (file:./dev.db).');
  process.env.DATABASE_URL = 'file:./dev.db';
}

const dbUrl = process.env.DATABASE_URL;
const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');
console.log(`[TalkLedger Startup] Detected database provider: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);

// 2. Sync schema.prisma to match DATABASE_URL provider
try {
  console.log('[TalkLedger Startup] Syncing database schema provider...');
  execSync('node scripts/sync-db-provider.mjs', { cwd: serverDir, stdio: 'inherit' });
} catch (err) {
  console.warn('[TalkLedger Startup] Warning: Provider sync encountered an issue:', err.message);
}

// 3. Generate Prisma Client to match current schema
try {
  console.log('[TalkLedger Startup] Generating Prisma Client...');
  execSync('npx prisma generate', { cwd: serverDir, stdio: 'inherit' });
} catch (err) {
  console.warn('[TalkLedger Startup] Warning: Prisma generate encountered an issue:', err.message);
}

// 4. Synchronize database schema tables
try {
  console.log('[TalkLedger Startup] Synchronizing database tables with prisma db push...');
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: serverDir,
    stdio: 'inherit',
    timeout: 45000,
  });
  console.log('[TalkLedger Startup] Database tables synchronized successfully.');
} catch (err) {
  console.warn('[TalkLedger Startup] Database push notice: table synchronization failed or timed out. Server will continue startup.');
}

// 5. Seed sample store data if database is empty
try {
  const seedJsPath = path.join(serverDir, 'dist', 'prisma', 'seed.js');
  if (fs.existsSync(seedJsPath)) {
    const { PrismaClient } = await import('@prisma/client');
    const tempPrisma = new PrismaClient();
    const userCount = await tempPrisma.user.count();
    if (userCount === 0) {
      console.log('[TalkLedger Startup] Empty database detected. Seeding sample store data...');
      execSync(`node "${seedJsPath}"`, { cwd: serverDir, stdio: 'inherit' });
      console.log('[TalkLedger Startup] Sample store data seeded successfully.');
    } else {
      console.log(`[TalkLedger Startup] Database already populated with ${userCount} store user account(s).`);
    }
    await tempPrisma.$disconnect();
  }
} catch (seedErr) {
  console.warn('[TalkLedger Startup] Seed check notice:', seedErr.message);
}

// 6. Launch Express production server
console.log('[TalkLedger Startup] Launching TalkLedger Express server...');
await import('../dist/src/index.js');
