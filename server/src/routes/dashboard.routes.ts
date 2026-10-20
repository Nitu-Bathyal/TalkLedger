import { Router } from 'express';
import { DashboardService } from '../services/dashboard.service.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { ensureDatabaseReady } from '../db-init.js';

export const dashboardRouter = Router();

// Health check endpoint (public)
dashboardRouter.get('/health', async (_req, res) => {
  let dbStatus = 'connected';
  let dbMessage = 'Database connection verified';

  try {
    await prisma.user.findFirst({ select: { id: true }, take: 1 });
  } catch (err: any) {
    // Attempt self-heal on-demand
    const healed = await ensureDatabaseReady();
    if (healed) {
      dbStatus = 'connected';
      dbMessage = 'Database connection verified (auto-initialized)';
    } else {
      dbStatus = 'disconnected';
      if (!process.env.DATABASE_URL) {
        dbMessage = 'DATABASE_URL is not configured';
      } else if (err.code === 'P2021' || err.code === 'P2022') {
        dbMessage = 'Database tables not initialized (auto-initialization in progress)';
      } else {
        dbMessage = `Database unavailable (${err.code || 'unknown'})`;
      }
    }
  }

  res.status(200).json({
    status: dbStatus === 'connected' ? 'healthy' : 'degraded',
    database: {
      status: dbStatus,
      message: dbMessage,
    },
    timestamp: new Date().toISOString(),
    service: 'talkledger-api',
  });
});

// Dashboard metrics endpoint (authenticated)
dashboardRouter.get('/dashboard', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    const summary = await DashboardService.getSummary(req.user!.id);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});
