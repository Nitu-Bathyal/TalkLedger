import { PrismaClient } from '@prisma/client';
import { config } from './config.js';

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
  process.env.DATABASE_URL = config.databaseUrl;
}

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'test' ? [] : ['warn', 'error'],
});
