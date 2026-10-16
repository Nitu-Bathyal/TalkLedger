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
    const trimmedName = input.name.trim();
    const cleanPhone = input.phone?.trim() ? input.phone.trim() : null;
    const cleanNotes = input.notes?.trim() ? input.notes.trim() : null;
    const normInputPhone = cleanPhone ? cleanPhone.replace(/[\s\-\(\)\.]/g, '') : null;

    // Check all existing customers for this user
    const existingCustomers = await prisma.customer.findMany({
      where: { userId },
    });

    const sameNameMatches = existingCustomers.filter(
      (c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (sameNameMatches.length > 0) {
      // Allow customers with the same name if distinguishable by phone number
      const duplicate = sameNameMatches.find((c) => {
        const existingNormPhone = c.phone ? c.phone.replace(/[\s\-\(\)\.]/g, '') : null;
        if (!normInputPhone && !existingNormPhone) return true; // both have no phone
        if (normInputPhone && existingNormPhone && normInputPhone === existingNormPhone) return true; // identical phone
        return false;
      });

      if (duplicate) {
        if (!normInputPhone) {
          throw new AppError(
            `A customer named "${trimmedName}" already exists without a phone number. Please provide a phone number to distinguish between customers with the same name.`,
            409
          );
        } else {
          throw new AppError(
            `A customer named "${trimmedName}" with phone number "${cleanPhone}" already exists in your ledger.`,
            409
          );
        }
      }
    }

    return await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          userId,
          name: trimmedName,
          phone: cleanPhone,
          notes: cleanNotes,
        },
      });

      // If opening balance is specified, create initial credit transaction
      const openingPaise = input.openingBalancePaise || 0;
      if (openingPaise > 0) {
        await tx.transaction.create({
          data: {
            userId,
            customerId: customer.id,
            type: 'CREDIT',
            amountPaise: openingPaise,
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
        balancePaise: openingPaise,
        totalCreditPaise: openingPaise,
        totalPaymentPaise: 0,
        transactionCount: openingPaise > 0 ? 1 : 0,
        lastActivityDate: openingPaise > 0 ? new Date().toISOString() : null,
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

    const trimmedName = input.name ? input.name.trim() : existing.name;
    const cleanPhone = input.phone !== undefined ? (input.phone?.trim() || null) : existing.phone;
    const cleanNotes = input.notes !== undefined ? (input.notes?.trim() || null) : existing.notes;
    const normPhone = cleanPhone ? cleanPhone.replace(/[\s\-\(\)\.]/g, '') : null;

    if (
      trimmedName.toLowerCase() !== existing.name.toLowerCase() ||
      normPhone !== (existing.phone ? existing.phone.replace(/[\s\-\(\)\.]/g, '') : null)
    ) {
      const otherCustomers = await prisma.customer.findMany({
        where: {
          userId,
          id: { not: customerId },
        },
      });

      const sameNameMatches = otherCustomers.filter(
        (c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );

      const duplicate = sameNameMatches.find((c) => {
        const otherNormPhone = c.phone ? c.phone.replace(/[\s\-\(\)\.]/g, '') : null;
        if (!normPhone && !otherNormPhone) return true;
        if (normPhone && otherNormPhone && normPhone === otherNormPhone) return true;
        return false;
      });

      if (duplicate) {
        throw new AppError(
          `Another customer named "${trimmedName}" with phone number "${cleanPhone || 'None'}" already exists.`,
          409
        );
      }
    }

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        name: trimmedName,
        phone: cleanPhone,
        notes: cleanNotes,
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
