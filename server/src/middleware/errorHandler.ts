import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Console log in non-test mode for observability
  if (process.env.NODE_ENV !== 'test') {
    console.error('[Error]', err.name || 'Error', err.message);
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Prisma known errors
  if (err.code === 'P2002') {
    res.status(409).json({ error: 'A record with this unique identifier already exists.' });
    return;
  }
  if (err.code === 'P2025') {
    res.status(404).json({ error: 'Requested record was not found.' });
    return;
  }

  // Prisma database connection and initialization errors
  if (
    err.name === 'PrismaClientInitializationError' ||
    (typeof err.message === 'string' && err.message.includes('DATABASE_URL'))
  ) {
    res.status(503).json({
      error: 'Database configuration missing: DATABASE_URL is not configured.',
      code: 'DATABASE_UNCONFIGURED',
    });
    return;
  }

  if (['P1000', 'P1001', 'P1002', 'P1003', 'P1017'].includes(err.code)) {
    res.status(503).json({
      error: 'Database service unavailable. Unable to connect to the database server.',
      code: 'DATABASE_UNAVAILABLE',
    });
    return;
  }

  if (err.code === 'P2021' || err.code === 'P2022') {
    res.status(503).json({
      error: 'Database tables are not initialized. Please run database migrations.',
      code: 'DATABASE_SCHEMA_MISSING',
    });
    return;
  }

  res.status(500).json({
    error: 'An unexpected internal error occurred. Please try again.',
  });
}
