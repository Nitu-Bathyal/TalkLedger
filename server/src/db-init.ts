import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { prisma } from './db.js';

// In compiled dist/src/db-init.js, __dirname is .../server/dist/src, resolve ../.. to reach server root
const serverDir = path.resolve(__dirname, '../..');

let isInitializing = false;

export async function ensureDatabaseReady(): Promise<boolean> {
  if (isInitializing) return false;
  isInitializing = true;

  try {
    // 1. Probe database table
    await prisma.user.findFirst({ select: { id: true }, take: 1 });
    isInitializing = false;
    return true;
  } catch (err: any) {
    console.log(`[TalkLedger DB-Init] Database check failed (${err.code || err.name}: ${err.message}). Attempting auto-recovery...`);

    try {
      // 2. Resolve Prisma CLI
      let prismaBin: string | null = null;
      try {
        prismaBin = require.resolve('prisma');
      } catch {
        const rootPrisma = path.resolve(serverDir, '../node_modules/prisma/build/index.js');
        if (fs.existsSync(rootPrisma)) {
          prismaBin = rootPrisma;
        } else {
          prismaBin = 'npx prisma';
        }
      }
      const prismaCmd = prismaBin.endsWith('.js') ? `node "${prismaBin}"` : prismaBin;

      // Ensure DATABASE_URL fallback
      if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
        process.env.DATABASE_URL = 'file:./dev.db';
      }

      // Sync schema provider
      const syncScript = path.join(serverDir, 'scripts', 'sync-db-provider.mjs');
      if (fs.existsSync(syncScript)) {
        execSync(`node "${syncScript}"`, { cwd: serverDir, stdio: 'inherit', env: process.env });
      }

      const schemaPath = path.join(serverDir, 'prisma', 'schema.prisma');

      // Run db push to create tables
      console.log('[TalkLedger DB-Init] Running prisma db push...');
      execSync(`${prismaCmd} db push --schema="${schemaPath}" --skip-generate --accept-data-loss`, {
        cwd: serverDir,
        stdio: 'inherit',
        env: process.env,
        timeout: 60000,
      });
      console.log('[TalkLedger DB-Init] Prisma db push succeeded.');

      // Check if seed is needed
      const userCount = await prisma.user.count();
      if (userCount === 0) {
        console.log('[TalkLedger DB-Init] Seeding initial business data...');
        const seedJsPath = path.join(serverDir, 'dist', 'prisma', 'seed.js');
        if (fs.existsSync(seedJsPath)) {
          execSync(`node "${seedJsPath}"`, { cwd: serverDir, stdio: 'inherit', env: process.env });
        } else {
          const seedTsPath = path.join(serverDir, 'prisma', 'seed.ts');
          execSync(`npx tsx "${seedTsPath}"`, { cwd: serverDir, stdio: 'inherit', env: process.env });
        }
        console.log('[TalkLedger DB-Init] Seed completed.');
      }

      isInitializing = false;
      return true;
    } catch (recoveryErr: any) {
      console.error('[TalkLedger DB-Init] Recovery failed:', recoveryErr.message);
      isInitializing = false;
      return false;
    }
  }
}
