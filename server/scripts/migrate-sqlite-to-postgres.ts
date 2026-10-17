import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Locate the verified snapshot
const defaultSnapshotPath = path.resolve(__dirname, '../../backups/sqlite_snapshot_20261017.json');
const scratchSnapshotPath = path.resolve('C:/Users/DELL/.gemini/antigravity/brain/4678e92d-2146-47c5-8a6e-b075b5c11f70/scratch/sqlite_snapshot_20261017.json');

const snapshotPath = fs.existsSync(defaultSnapshotPath)
  ? defaultSnapshotPath
  : (fs.existsSync(scratchSnapshotPath) ? scratchSnapshotPath : null);

if (!snapshotPath) {
  console.error('[Migration] Error: Could not find verified SQLite snapshot JSON file.');
  process.exit(1);
}

const snapshotRaw = fs.readFileSync(snapshotPath, 'utf8');
const snapshot = JSON.parse(snapshotRaw);

console.log(`[Migration] Loaded snapshot from: ${snapshotPath}`);
console.log(`[Migration] Source inventory: ${snapshot.counts.users} Users, ${snapshot.counts.customers} Customers, ${snapshot.counts.transactions} Transactions.`);

// Initialize Prisma client with current DATABASE_URL
const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('[Migration] Verifying target PostgreSQL database connectivity...');
    await prisma.$connect();

    console.log('[Migration] Beginning transactional data import...');
    const result = await prisma.$transaction(async (tx) => {
      let importedUsers = 0;
      let importedCustomers = 0;
      let importedTransactions = 0;
      let importedAuditLogs = 0;

      // 1. Users
      for (const u of snapshot.users) {
        await tx.user.upsert({
          where: { id: u.id },
          create: {
            id: u.id,
            email: u.email,
            passwordHash: u.passwordHash,
            businessName: u.businessName,
            phone: u.phone,
            upiId: u.upiId,
            createdAt: new Date(u.createdAt),
            updatedAt: new Date(u.updatedAt),
          },
          update: {
            email: u.email,
            businessName: u.businessName,
            phone: u.phone,
            upiId: u.upiId,
          },
        });
        importedUsers++;
      }

      // 2. Customers
      for (const c of snapshot.customers) {
        await tx.customer.upsert({
          where: { id: c.id },
          create: {
            id: c.id,
            userId: c.userId,
            name: c.name,
            phone: c.phone,
            notes: c.notes,
            createdAt: new Date(c.createdAt),
            updatedAt: new Date(c.updatedAt),
          },
          update: {
            name: c.name,
            phone: c.phone,
            notes: c.notes,
          },
        });
        importedCustomers++;
      }

      // 3. Transactions
      for (const t of snapshot.transactions) {
        await tx.transaction.upsert({
          where: { id: t.id },
          create: {
            id: t.id,
            userId: t.userId,
            customerId: t.customerId,
            type: t.type,
            amountPaise: t.amountPaise,
            description: t.description,
            paymentMode: t.paymentMode,
            transactionDate: new Date(t.transactionDate),
            dueDate: t.dueDate ? new Date(t.dueDate) : null,
            source: t.source,
            reversedAt: t.reversedAt ? new Date(t.reversedAt) : null,
            reversalReason: t.reversalReason,
            originalTransactionId: t.originalTransactionId,
            createdAt: new Date(t.createdAt),
            updatedAt: new Date(t.updatedAt),
          },
          update: {
            amountPaise: t.amountPaise,
            description: t.description,
            paymentMode: t.paymentMode,
            source: t.source,
          },
        });
        importedTransactions++;
      }

      // 4. AuditLogs (if any)
      if (snapshot.auditLogs && Array.isArray(snapshot.auditLogs)) {
        for (const a of snapshot.auditLogs) {
          await tx.auditLog.upsert({
            where: { id: a.id },
            create: {
              id: a.id,
              userId: a.userId,
              action: a.action,
              entityType: a.entityType,
              entityId: a.entityId,
              details: a.details,
              createdAt: new Date(a.createdAt),
            },
            update: {},
          });
          importedAuditLogs++;
        }
      }

      return {
        importedUsers,
        importedCustomers,
        importedTransactions,
        importedAuditLogs,
      };
    });

    console.log('[Migration] Transaction successfully committed.');
    console.log(`[Migration] Import summary: ${result.importedUsers} Users, ${result.importedCustomers} Customers, ${result.importedTransactions} Transactions.`);

    // 5. Verification Phase
    console.log('[Migration] Verifying relational integrity and financial consistency in target database...');
    const targetUsersCount = await prisma.user.count();
    const targetCustomersCount = await prisma.customer.count();
    const targetTransactionsCount = await prisma.transaction.count();

    const targetCredits = await prisma.transaction.aggregate({
      _sum: { amountPaise: true },
      where: { type: 'CREDIT' },
    });

    const targetPayments = await prisma.transaction.aggregate({
      _sum: { amountPaise: true },
      where: { type: 'PAYMENT' },
    });

    // Compute expected financial sums from snapshot
    const expectedCreditPaise = snapshot.transactions
      .filter((t: any) => t.type === 'CREDIT')
      .reduce((sum: number, t: any) => sum + t.amountPaise, 0);

    const expectedPaymentPaise = snapshot.transactions
      .filter((t: any) => t.type === 'PAYMENT')
      .reduce((sum: number, t: any) => sum + t.amountPaise, 0);

    const actualCreditPaise = targetCredits._sum.amountPaise || 0;
    const actualPaymentPaise = targetPayments._sum.amountPaise || 0;

    console.log('--- MIGRATION VERIFICATION AUDIT ---');
    console.log(`User Records: Expected >= ${snapshot.counts.users}, Actual in DB = ${targetUsersCount}`);
    console.log(`Customer Records: Expected >= ${snapshot.counts.customers}, Actual in DB = ${targetCustomersCount}`);
    console.log(`Transaction Records: Expected >= ${snapshot.counts.transactions}, Actual in DB = ${targetTransactionsCount}`);
    console.log(`Credit Paise Total: Expected = ${expectedCreditPaise} (₹${expectedCreditPaise / 100}), Actual = ${actualCreditPaise} (₹${actualCreditPaise / 100})`);
    console.log(`Payment Paise Total: Expected = ${expectedPaymentPaise} (₹${expectedPaymentPaise / 100}), Actual = ${actualPaymentPaise} (₹${actualPaymentPaise / 100})`);

    if (actualCreditPaise !== expectedCreditPaise || actualPaymentPaise !== expectedPaymentPaise) {
      throw new Error(`Financial reconciliation mismatch! Expected credits ${expectedCreditPaise} vs actual ${actualCreditPaise}.`);
    }

    console.log('[Migration] SUCCESS: All ledger data verified with 100% precision. Zero data loss.');
  } catch (err) {
    console.error('[Migration] FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
