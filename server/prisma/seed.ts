import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Seeding sample small business ledger data...');

  // 1. Create or get default business owner
  const passwordHash = await bcrypt.hash('password123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'owner@talkledger.local' },
    update: {},
    create: {
      email: 'owner@talkledger.local',
      passwordHash,
      businessName: 'Sharma General Store',
      phone: '+91 98765 00000',
      upiId: 'sharmastore@upi',
    },
  });

  console.log(`[Seed] User configured: ${user.businessName} (${user.email})`);

  // Clean old customer data for this user to ensure clean seed state
  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  await prisma.customer.deleteMany({ where: { userId: user.id } });

  // 2. Customers
  const ramesh = await prisma.customer.create({
    data: {
      userId: user.id,
      name: 'Ramesh Kumar',
      phone: '+91 98765 43210',
      notes: 'Regular customer from Block B. Prefers cash settlements.',
    },
  });

  const aarav = await prisma.customer.create({
    data: {
      userId: user.id,
      name: 'Aarav Sharma',
      phone: '+91 98123 45678',
      notes: 'Local teacher. Settles bill every 15 days via UPI.',
    },
  });

  const anita = await prisma.customer.create({
    data: {
      userId: user.id,
      name: 'Anita Tailor',
      phone: '+91 99887 76655',
      notes: 'Tailoring shop owner near market square.',
    },
  });

  const gupta = await prisma.customer.create({
    data: {
      userId: user.id,
      name: 'Gupta Market',
      phone: '+91 97766 55443',
      notes: 'Wholesale tea stall. Always clears dues promptly.',
    },
  });

  const vikas = await prisma.customer.create({
    data: {
      userId: user.id,
      name: 'Vikas Sharma',
      phone: '+91 98000 00000',
    },
  });

  const now = new Date();
  const daysAgo = (days: number, hours = 10) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    d.setHours(hours, 0, 0, 0);
    return d;
  };

  // 3. Transactions (amount stored in Paise: ₹1 = 100 paise)
  // Ramesh Kumar: +1000, -1000, +500 => Balance: ₹500
  await prisma.transaction.createMany({
    data: [
      {
        userId: user.id,
        customerId: ramesh.id,
        type: 'CREDIT',
        amountPaise: 100000, // ₹1,000
        description: 'Monthly grocery credit',
        transactionDate: daysAgo(15, 9),
        source: 'MANUAL',
      },
      {
        userId: user.id,
        customerId: ramesh.id,
        type: 'PAYMENT',
        amountPaise: 100000, // ₹1,000
        description: 'Cash payment received',
        paymentMode: 'CASH',
        transactionDate: daysAgo(6, 18),
        source: 'MANUAL',
      },
      {
        userId: user.id,
        customerId: ramesh.id,
        type: 'CREDIT',
        amountPaise: 50000, // ₹500
        description: 'Mobile recharge & snacks',
        transactionDate: daysAgo(1, 14),
        dueDate: daysAgo(-7), // Next week
        source: 'VOICE',
      },
    ],
  });

  // Aarav Sharma: +1800, -900, +340 => Balance: ₹1,240
  await prisma.transaction.createMany({
    data: [
      {
        userId: user.id,
        customerId: aarav.id,
        type: 'CREDIT',
        amountPaise: 180000, // ₹1,800
        description: 'Festival supplies on credit',
        transactionDate: daysAgo(11, 11),
        source: 'MANUAL',
      },
      {
        userId: user.id,
        customerId: aarav.id,
        type: 'PAYMENT',
        amountPaise: 90000, // ₹900
        description: 'Cash payment received',
        paymentMode: 'CASH',
        transactionDate: daysAgo(6, 20),
        source: 'MANUAL',
      },
      {
        userId: user.id,
        customerId: aarav.id,
        type: 'CREDIT',
        amountPaise: 34000, // ₹340
        description: 'Groceries & Flour',
        transactionDate: daysAgo(0, 9),
        source: 'VOICE',
      },
    ],
  });

  // Anita Tailor: +850 => Balance: ₹850
  await prisma.transaction.create({
    data: {
      userId: user.id,
      customerId: anita.id,
      type: 'CREDIT',
      amountPaise: 85000, // ₹850
      description: 'Dress material credit',
      transactionDate: daysAgo(4, 11),
      dueDate: daysAgo(1), // Overdue!
      source: 'MANUAL',
    },
  });

  // Gupta Market: +1200, -1200 => Balance: ₹0
  await prisma.transaction.createMany({
    data: [
      {
        userId: user.id,
        customerId: gupta.id,
        type: 'CREDIT',
        amountPaise: 120000, // ₹1,200
        description: 'Bulk Sugar & Oil',
        transactionDate: daysAgo(14, 15),
        source: 'MANUAL',
      },
      {
        userId: user.id,
        customerId: gupta.id,
        type: 'PAYMENT',
        amountPaise: 120000, // ₹1,200
        description: 'UPI Settlement via PhonePe',
        paymentMode: 'UPI',
        transactionDate: daysAgo(2, 14),
        source: 'MANUAL',
      },
    ],
  });

  console.log('[Seed] Database seeded with 5 customers and 8 ledger transactions.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
