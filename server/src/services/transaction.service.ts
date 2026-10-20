import { prisma } from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import { CreateTransactionInput, ReverseTransactionInput } from '../shared/schemas.js';
import { rupeesToPaise, formatINR } from '../utils/currency.js';
import { CustomerService } from './customer.service.js';

export class TransactionService {
  /**
   * Record a new financial entry (Credit or Payment)
   */
  static async createTransaction(userId: string, input: CreateTransactionInput) {
    const amountPaise = input.amountPaise !== undefined 
      ? input.amountPaise 
      : (input.amount !== undefined ? rupeesToPaise(input.amount) : 0);

    if (!amountPaise || amountPaise <= 0 || !Number.isInteger(amountPaise)) {
      throw new AppError('Transaction amount must be a positive number greater than zero', 400);
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Verify customer belongs to this user
      const customer = await tx.customer.findFirst({
        where: { id: input.customerId, userId },
        include: {
          transactions: true,
        },
      });

      if (!customer) {
        throw new AppError('Customer not found in your ledger', 404);
      }

      // 2. If it's a payment, check if it exceeds current outstanding balance
      if (input.type === 'PAYMENT') {
        const metrics = CustomerService.computeMetrics(customer.transactions);
        if (metrics.balancePaise <= 0 && !input.allowOverpayment) {
          throw new AppError(
            `Customer ${customer.name} has no outstanding balance (${formatINR(0)}). A payment cannot be recorded for a settled customer unless advance credit is confirmed.`,
            400
          );
        }

        if (amountPaise > metrics.balancePaise && !input.allowOverpayment) {
          throw new AppError(
            `Payment amount (${formatINR(amountPaise)}) exceeds the current outstanding balance of ${formatINR(metrics.balancePaise)}. Please enter an amount up to ${formatINR(metrics.balancePaise)} or confirm advance credit.`,
            400
          );
        }
      }

      // 3. Create the transaction
      const transactionDate = input.transactionDate ? new Date(input.transactionDate) : new Date();
      const dueDate = input.dueDate ? new Date(input.dueDate) : null;

      const created = await tx.transaction.create({
        data: {
          userId,
          customerId: customer.id,
          type: input.type,
          amountPaise,
          description: input.description?.trim() || (input.type === 'CREDIT' ? 'Credit item' : 'Payment received'),
          paymentMode: input.paymentMode || (input.type === 'PAYMENT' ? 'CASH' : null),
          transactionDate,
          dueDate,
          source: input.source || 'MANUAL',
        },
        include: {
          customer: {
            select: { id: true, name: true, phone: true },
          },
        },
      });

      return {
        id: created.id,
        userId: created.userId,
        customerId: created.customerId,
        type: created.type,
        amountPaise: created.amountPaise,
        description: created.description,
        paymentMode: created.paymentMode,
        transactionDate: created.transactionDate.toISOString(),
        dueDate: created.dueDate ? created.dueDate.toISOString() : null,
        source: created.source,
        reversedAt: created.reversedAt ? created.reversedAt.toISOString() : null,
        reversalReason: created.reversalReason,
        originalTransactionId: created.originalTransactionId,
        createdAt: created.createdAt.toISOString(),
        customer: created.customer,
      };
    });
  }

  /**
   * Reverse an existing transaction with audit trail
   */
  static async reverseTransaction(userId: string, transactionId: string, input: ReverseTransactionInput) {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findFirst({
        where: { id: transactionId, userId },
        include: { customer: true },
      });

      if (!existing) {
        throw new AppError('Transaction not found', 404);
      }

      if (existing.reversedAt) {
        throw new AppError('This transaction has already been reversed', 400);
      }

      const now = new Date();

      // Update original transaction to mark as reversed
      const reversed = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          reversedAt: now,
          reversalReason: input.reason.trim(),
        },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
        },
      });

      // Write audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'REVERSE_TRANSACTION',
          entityType: 'Transaction',
          entityId: transactionId,
          details: JSON.stringify({
            customerId: existing.customerId,
            customerName: existing.customer.name,
            amountPaise: existing.amountPaise,
            type: existing.type,
            reason: input.reason.trim(),
            reversedAt: now.toISOString(),
          }),
        },
      });

      return {
        id: reversed.id,
        userId: reversed.userId,
        customerId: reversed.customerId,
        type: reversed.type,
        amountPaise: reversed.amountPaise,
        description: reversed.description,
        paymentMode: reversed.paymentMode,
        transactionDate: reversed.transactionDate.toISOString(),
        dueDate: reversed.dueDate ? reversed.dueDate.toISOString() : null,
        source: reversed.source,
        reversedAt: reversed.reversedAt ? reversed.reversedAt.toISOString() : null,
        reversalReason: reversed.reversalReason,
        createdAt: reversed.createdAt.toISOString(),
        customer: reversed.customer,
      };
    });
  }

  /**
   * List transactions with filters
   */
  static async listTransactions(
    userId: string,
    options?: {
      customerId?: string;
      type?: 'CREDIT' | 'PAYMENT' | 'all';
      startDate?: string;
      endDate?: string;
      includeReversed?: boolean;
      limit?: number;
    }
  ) {
    const where: any = { userId };

    if (options?.customerId) {
      where.customerId = options.customerId;
    }

    if (options?.type && options.type !== 'all') {
      where.type = options.type;
    }

    if (!options?.includeReversed) {
      where.reversedAt = null;
    }

    if (options?.startDate || options?.endDate) {
      where.transactionDate = {};
      if (options.startDate) {
        where.transactionDate.gte = new Date(options.startDate);
      }
      if (options.endDate) {
        const end = new Date(options.endDate);
        end.setHours(23, 59, 59, 999);
        where.transactionDate.lte = end;
      }
    }

    const txns = await prisma.transaction.findMany({
      where,
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
      },
      orderBy: { transactionDate: 'desc' },
      take: options?.limit || 100,
    });

    return txns.map((t) => ({
      id: t.id,
      userId: t.userId,
      customerId: t.customerId,
      type: t.type,
      amountPaise: t.amountPaise,
      description: t.description,
      paymentMode: t.paymentMode,
      transactionDate: t.transactionDate.toISOString(),
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      source: t.source,
      reversedAt: t.reversedAt ? t.reversedAt.toISOString() : null,
      reversalReason: t.reversalReason,
      originalTransactionId: t.originalTransactionId,
      createdAt: t.createdAt.toISOString(),
      customer: t.customer,
    }));
  }

  /**
   * Get single transaction by ID
   */
  static async getTransactionById(userId: string, id: string) {
    const txn = await prisma.transaction.findFirst({
      where: { id, userId },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
      },
    });

    if (!txn) {
      throw new AppError('Transaction not found', 404);
    }

    return {
      id: txn.id,
      userId: txn.userId,
      customerId: txn.customerId,
      type: txn.type,
      amountPaise: txn.amountPaise,
      description: txn.description,
      paymentMode: txn.paymentMode,
      transactionDate: txn.transactionDate.toISOString(),
      dueDate: txn.dueDate ? txn.dueDate.toISOString() : null,
      source: txn.source,
      reversedAt: txn.reversedAt ? txn.reversedAt.toISOString() : null,
      reversalReason: txn.reversalReason,
      createdAt: txn.createdAt.toISOString(),
      customer: txn.customer,
    };
  }
}
