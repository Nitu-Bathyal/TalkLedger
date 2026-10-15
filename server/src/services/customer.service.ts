import { prisma } from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import { CreateCustomerInput, UpdateCustomerInput } from '../shared/schemas.js';

export interface CustomerWithMetrics {
  id: string;
  userId: string;
  name: string;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  balancePaise: number;
  totalCreditPaise: number;
  totalPaymentPaise: number;
  transactionCount: number;
  lastActivityDate: string | null;
  isOverdue: boolean;
}

export class CustomerService {
  /**
   * Helper to compute customer balance metrics from raw ledger transactions
   */
  static computeMetrics(transactions: Array<{ type: string; amountPaise: number; transactionDate: Date; dueDate: Date | null; reversedAt: Date | null }>): {
    balancePaise: number;
    totalCreditPaise: number;
    totalPaymentPaise: number;
    transactionCount: number;
    lastActivityDate: string | null;
    isOverdue: boolean;
  } {
    let totalCredit = 0;
    let totalPayment = 0;
    let validTxnCount = 0;
    let latestDate: Date | null = null;
    let hasOverdueCredit = false;
    const now = new Date();

    for (const t of transactions) {
      if (t.reversedAt) continue; // Skip reversed transactions in balance calculations

      validTxnCount++;
      if (!latestDate || t.transactionDate > latestDate) {
        latestDate = t.transactionDate;
      }

      if (t.type === 'CREDIT') {
        totalCredit += t.amountPaise;
        if (t.dueDate && t.dueDate < now) {
          hasOverdueCredit = true;
        }
      } else if (t.type === 'PAYMENT') {
        totalPayment += t.amountPaise;
      }
    }

    const balancePaise = totalCredit - totalPayment;

    return {
      balancePaise,
      totalCreditPaise: totalCredit,
      totalPaymentPaise: totalPayment,
      transactionCount: validTxnCount,
      lastActivityDate: latestDate ? latestDate.toISOString() : null,
      isOverdue: balancePaise > 0 && hasOverdueCredit,
    };
  }

  /**
   * List customers with calculated balances, with optional search and filter
   */
  static async listCustomers(
    userId: string,
    options?: { search?: string; filter?: 'all' | 'pending' | 'settled' }
  ): Promise<CustomerWithMetrics[]> {
    const customers = await prisma.customer.findMany({
      where: {
        userId,
        ...(options?.search
          ? {
              OR: [
                { name: { contains: options.search } },
                { phone: { contains: options.search } },
              ],
            }
          : {}),
      },
      include: {
        transactions: {
          select: {
            type: true,
            amountPaise: true,
            transactionDate: true,
            dueDate: true,
            reversedAt: true,
          },
          orderBy: { transactionDate: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const results: CustomerWithMetrics[] = customers.map((c) => {
      const metrics = this.computeMetrics(c.transactions);
      return {
        id: c.id,
        userId: c.userId,
        name: c.name,
        phone: c.phone,
        notes: c.notes,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        ...metrics,
      };
    });

    if (options?.filter === 'pending') {
      return results.filter((c) => c.balancePaise > 0);
    }
    if (options?.filter === 'settled') {
      return results.filter((c) => c.balancePaise <= 0);
    }

    return results;
  }

  /**
   * Get single customer with ledger history and metrics
   */
  static async getCustomerById(userId: string, customerId: string): Promise<CustomerWithMetrics & { transactions: any[] }> {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, userId },
      include: {
        transactions: {
          orderBy: { transactionDate: 'desc' },
        },
      },
    });

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    const metrics = this.computeMetrics(customer.transactions);

    return {
      id: customer.id,
      userId: customer.userId,
      name: customer.name,
      phone: customer.phone,
      notes: customer.notes,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      ...metrics,
      transactions: customer.transactions.map((t) => ({
        ...t,
        transactionDate: t.transactionDate.toISOString(),
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        reversedAt: t.reversedAt ? t.reversedAt.toISOString() : null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    };
  }

  /**
   * Create a new customer with duplicate protection and optional opening balance
   */
  static async createCustomer(
    userId: string,
    input: CreateCustomerInput
  ): Promise<CustomerWithMetrics> {
    const existing = await prisma.customer.findFirst({
      where: {
        userId,
        name: { equals: input.name.trim() },
      },
    });

    if (existing) {
      throw new AppError(`A customer named "${input.name.trim()}" already exists in your ledger`, 409);
    }

    return await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          userId,
          name: input.name.trim(),
          phone: input.phone?.trim() || null,
          notes: input.notes?.trim() || null,
        },
      });

      // If opening balance is specified, create initial credit transaction
      if (input.openingBalancePaise && input.openingBalancePaise > 0) {
        await tx.transaction.create({
          data: {
            userId,
            customerId: customer.id,
            type: 'CREDIT',
            amountPaise: input.openingBalancePaise,
            description: 'Opening Balance',
            transactionDate: new Date(),
            source: 'MANUAL',
          },
        });
      }

      return {
        id: customer.id,
        userId: customer.userId,
        name: customer.name,
        phone: customer.phone,
        notes: customer.notes,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString(),
        balancePaise: input.openingBalancePaise || 0,
        totalCreditPaise: input.openingBalancePaise || 0,
        totalPaymentPaise: 0,
        transactionCount: input.openingBalancePaise ? 1 : 0,
        lastActivityDate: input.openingBalancePaise ? new Date().toISOString() : null,
        isOverdue: false,
      };
    });
  }

  /**
   * Update customer profile
   */
  static async updateCustomer(
    userId: string,
    customerId: string,
    input: UpdateCustomerInput
  ): Promise<CustomerWithMetrics> {
    const existing = await prisma.customer.findFirst({
      where: { id: customerId, userId },
    });

    if (!existing) {
      throw new AppError('Customer not found', 404);
    }

    if (input.name && input.name.trim() !== existing.name) {
      const duplicate = await prisma.customer.findFirst({
        where: {
          userId,
          name: { equals: input.name.trim() },
          id: { not: customerId },
        },
      });
      if (duplicate) {
        throw new AppError(`Another customer is already named "${input.name.trim()}"`, 409);
      }
    }

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      },
      include: {
        transactions: true,
      },
    });

    const metrics = this.computeMetrics(updated.transactions);

    return {
      id: updated.id,
      userId: updated.userId,
      name: updated.name,
      phone: updated.phone,
      notes: updated.notes,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      ...metrics,
    };
  }
}
