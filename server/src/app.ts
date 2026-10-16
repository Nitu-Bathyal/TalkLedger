import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { authRouter } from './routes/auth.routes.js';
import { customerRouter } from './routes/customer.routes.js';
import { transactionRouter } from './routes/transaction.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { voiceRouter } from './routes/voice.routes.js';
import { gemmaRouter } from './routes/gemma.routes.js';
import { tabpfnRouter } from './routes/tabpfn.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import path from 'path';
import fs from 'fs';
const clientDist = fs.existsSync(path.resolve(process.cwd(), '../client/dist'))
  ? path.resolve(process.cwd(), '../client/dist')
  : path.resolve(process.cwd(), 'client/dist');

export const app = express();

// Middlewares
app.use(cors({
  origin: '*', // Allow local frontend and Render deployments
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// API Routes
app.use('/api', dashboardRouter);
app.use('/api/auth', authRouter);
app.use('/api/customers', customerRouter);
app.use('/api/transactions', transactionRouter);
app.use('/api/voice', voiceRouter);
app.use('/api/gemma', gemmaRouter);
app.use('/api/tabpfn', tabpfnRouter);

// Render Single-Service Deployment: Serve production client build if present
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Centralized Error Handling
app.use(errorHandler);
