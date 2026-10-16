import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../db.js';

export interface AuthUser {
  id: string;
  email: string;
  businessName: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

let cachedDefaultUserId: string | null = null;

async function getOrCreateDefaultUser(): Promise<AuthUser> {
  if (cachedDefaultUserId) {
    const existing = await prisma.user.findUnique({ where: { id: cachedDefaultUserId } });
    if (existing) {
      return { id: existing.id, email: existing.email, businessName: existing.businessName };
    }
  }

  let user = await prisma.user.findUnique({
    where: { email: 'owner@talkledger.local' },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'owner@talkledger.local',
        passwordHash: '$2a$10$wT8KzQ/0Z2wH7b0Vn0Ew0eJ/YwL7V8qgO1.C/Qz6kY7A5h.Zt8B6m', // 'password123'
        businessName: 'Sharma General Store',
        phone: '+91 98765 00000',
        upiId: 'sharmastore@upi',
      },
    });
  }

  cachedDefaultUserId = user.id;
  return { id: user.id, email: user.email, businessName: user.businessName };
}

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  const rawToken = authHeader && authHeader.split(' ')[1];

  // Treat 'null', 'undefined', or blank tokens as no token passed (resilient dev mode)
  const token = rawToken && rawToken !== 'null' && rawToken !== 'undefined' && rawToken.trim() !== ''
    ? rawToken.trim()
    : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as AuthUser;
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, email: true, businessName: true },
      });

      if (!user) {
        console.warn(`[Auth] Account not found for token on ${req.method} ${req.originalUrl}`);
        res.status(401).json({ error: 'User account not found or deactivated' });
        return;
      }

      req.user = user;
      next();
      return;
    } catch {
      console.warn(`[Auth] Invalid/expired token on ${req.method} ${req.originalUrl}`);
      res.status(403).json({ error: 'Invalid or expired authentication token' });
      return;
    }
  }

  // Developer/Single-owner fallback: if no token is passed, bind to default owner
  try {
    req.user = await getOrCreateDefaultUser();
    next();
  } catch (error) {
    next(error);
  }
}
