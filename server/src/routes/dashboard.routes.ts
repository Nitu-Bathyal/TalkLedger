import { Router } from 'express';
import { DashboardService } from '../services/dashboard.service.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';

export const dashboardRouter = Router();

// Health check endpoint (public)
dashboardRouter.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
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
