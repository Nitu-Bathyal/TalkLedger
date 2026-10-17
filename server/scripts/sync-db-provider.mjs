import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.resolve(__dirname, '..');

// Load environment from .env if present
dotenv.config({ path: path.join(serverDir, '.env') });

const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');
const expectedProvider = isPostgres ? 'postgresql' : 'sqlite';
const sourceFile = isPostgres ? 'schema.postgres.prisma' : 'schema.sqlite.prisma';

const prismaDir = path.join(serverDir, 'prisma');
const currentSchema = path.join(prismaDir, 'schema.prisma');
const targetSchema = path.join(prismaDir, sourceFile);

const currentContent = fs.existsSync(currentSchema) ? fs.readFileSync(currentSchema, 'utf8') : '';
const currentMatch = currentContent.match(/provider\s*=\s*"(\w+)"/);
const currentProvider = currentMatch ? currentMatch[1] : null;

if (currentProvider !== expectedProvider) {
  console.log(`[TalkLedger DB] Auto-syncing schema.prisma provider to '${expectedProvider}' (detected DATABASE_URL).`);
  fs.copyFileSync(targetSchema, currentSchema);
}
