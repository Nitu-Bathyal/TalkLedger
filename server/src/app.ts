import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { authRouter } from './routes/auth.routes.js';
import { customerRouter } from './routes/customer.routes.js';
import { transactionRouter } from './routes/transaction.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { voiceRouter } from './routes/voice.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

export const app = express();

// Middlewares
app.use(cors({
  origin: '*', // Allow local frontend during development
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

// Centralized Error Handling
app.use(errorHandler);
