import { prisma } from '../db.js';
import { CustomerService } from './customer.service.js';
import { TransactionService } from './transaction.service.js';
import { DashboardSummary, WeeklyCollectionDay } from '../shared/types.js';

export class DashboardService {
  static async getSummary(userId: string): Promise<DashboardSummary> {
    // 1. Fetch all customers with their non-reversed transactions
    const customers = await prisma.customer.findMany({
      where: { userId },
      include: {
        transactions: {
          where: { reversedAt: null },
          select: {
            type: true,
            amountPaise: true,
            transactionDate: true,
            dueDate: true,
            reversedAt: true,
          },
        },
      },
    });

    let totalCreditPaise = 0;
    let customersWithBalanceCount = 0;
    let overdueCustomersCount = 0;

    for (const c of customers) {
      const metrics = CustomerService.computeMetrics(c.transactions);
      if (metrics.balancePaise > 0) {
        totalCreditPaise += metrics.balancePaise;
        customersWithBalanceCount++;
        if (metrics.isOverdue) {
          overdueCustomersCount++;
        }
      }
    }

    // 2. Fetch total payments collected all-time for this user
    const paymentAggregate = await prisma.transaction.aggregate({
      where: {
        userId,
        type: 'PAYMENT',
        reversedAt: null,
      },
      _sum: {
        amountPaise: true,
      },
    });
    const totalPaymentsCollectedPaise = paymentAggregate._sum.amountPaise || 0;

    // 3. Compute 7-day weekly collections breakdown
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const past7Days: WeeklyCollectionDay[] = [];
    let weeklyTotalPaise = 0;

    // Generate last 7 days ending today
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

      const dayPaymentAggregate = await prisma.transaction.aggregate({
        where: {
          userId,
          type: 'PAYMENT',
          reversedAt: null,
          transactionDate: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
        _sum: {
          amountPaise: true,
        },
      });

      const dayPaise = dayPaymentAggregate._sum.amountPaise || 0;
      weeklyTotalPaise += dayPaise;

      past7Days.push({
        day: dayNames[dayStart.getDay()],
        date: dayStart.toISOString().split('T')[0],
        amountPaise: dayPaise,
        percentage: 0, // will normalize below
      });
    }

    // Normalize bar percentages relative to peak day or target
    const peakDayPaise = Math.max(...past7Days.map((d) => d.amountPaise), 1);
    past7Days.forEach((d) => {
      d.percentage = Math.max(10, Math.round((d.amountPaise / peakDayPaise) * 100));
    });

    // 4. Fetch recent transactions (latest 10)
    const recentTransactions = await TransactionService.listTransactions(userId, {
      limit: 10,
      includeReversed: false,
    });

    return {
      totalCreditPaise,
      totalPaymentsCollectedPaise,
      totalCustomers: customers.length,
      customersWithBalanceCount,
      overdueCustomersCount,
      weeklyCollections: past7Days,
      weeklyTotalCollectedPaise: weeklyTotalPaise,
      recentTransactions: recentTransactions as any,
    };
  }
}
