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

  res.status(500).json({
    error: 'An unexpected internal error occurred. Please try again.',
  });
}
