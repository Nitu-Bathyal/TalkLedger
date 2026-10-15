import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { validateBody } from '../middleware/validate.js';
import { RegisterUserSchema, LoginUserSchema } from '../shared/schemas.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const authRouter = Router();

authRouter.post('/register', validateBody(RegisterUserSchema), async (req, res, next) => {
  try {
    const { email, password, businessName, phone, upiId } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError('An account with this email already exists', 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        businessName,
        phone,
        upiId,
      },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, businessName: user.businessName },
      config.jwtSecret,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        businessName: user.businessName,
        phone: user.phone,
        upiId: user.upiId,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', validateBody(LoginUserSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, businessName: user.businessName },
      config.jwtSecret,
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Logged in successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        businessName: user.businessName,
        phone: user.phone,
        upiId: user.upiId,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        businessName: true,
        phone: true,
        upiId: true,
        createdAt: true,
      },
    });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});
