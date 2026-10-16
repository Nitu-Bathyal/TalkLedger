import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { TabPfnForecasterService } from '../services/tabpfn.service.js';

export const tabpfnRouter = Router();

tabpfnRouter.use(authenticateToken);

// 1. Get TabPFN-3.5 investigation, licensing, and configuration status
tabpfnRouter.get('/status', (_req, res) => {
  const status = TabPfnForecasterService.getInvestigationStatus();
  res.json(status);
});

// 2. Get probabilistic collection forecast from anonymized historical data
tabpfnRouter.get('/forecast', async (req: AuthenticatedRequest, res, next) => {
  try {
    const forecast = await TabPfnForecasterService.generateForecast(req.user!.id);
    res.json(forecast);
  } catch (err) {
    next(err);
  }
});
