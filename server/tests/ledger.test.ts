import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/db.js';
import { rupeesToPaise, paiseToRupees, formatINR } from '../src/utils/currency.js';
import { VoiceParserService } from '../src/services/voiceParser.service.js';

describe('TalkLedger Business Engine & Ledger Tests', () => {
  let testUserId: string;
  let authToken: string;

  beforeAll(async () => {
    // Create dedicated test user
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `test-${Date.now()}@talkledger.test`,
        password: 'password123',
        businessName: 'Gupta Kirana Store',
        phone: '+91 98999 11111',
      });

    expect(res.status).toBe(201);
    testUserId = res.body.user.id;
    authToken = res.body.token;
  });

  afterAll(async () => {
    // Clean up test data
    if (testUserId) {
      await prisma.transaction.deleteMany({ where: { userId: testUserId } });
      await prisma.customer.deleteMany({ where: { userId: testUserId } });
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
    await prisma.$disconnect();
  });

  describe('Paise Integer Currency Math', () => {
    it('accurately converts rupees to paise avoiding floating point loss', () => {
      expect(rupeesToPaise(340)).toBe(34000);
      expect(rupeesToPaise(12.99)).toBe(1299);
      expect(rupeesToPaise(0.50)).toBe(50);
      expect(paiseToRupees(34000)).toBe(340);
    });

    it('rejects invalid or negative amounts in conversion', () => {
      expect(() => rupeesToPaise(-100)).toThrow();
      expect(() => rupeesToPaise(NaN)).toThrow();
    });

    it('formats numbers with Indian currency notation (₹)', () => {
      expect(formatINR(2485000)).toBe('₹24,850');
      expect(formatINR(120050, { showPaise: true })).toBe('₹1,200.50');
    });
  });

  describe('Customer Management & Data Isolation', () => {
    let customerId: string;

    it('creates a customer successfully', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Vikram Singh',
          phone: '+91 98111 22222',
          notes: 'Daily milk customer',
        });

      expect(res.status).toBe(201);
      expect(res.body.customer.name).toBe('Vikram Singh');
      expect(res.body.customer.balancePaise).toBe(0);
      customerId = res.body.customer.id;
    });

    it('prevents accidental duplicate customer with identical name', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Vikram Singh',
          phone: '+91 98111 22222',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });

    it('retrieves customer details and initial zero balance', async () => {
      const res = await request(app)
        .get(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.customer.id).toBe(customerId);
      expect(res.body.customer.balancePaise).toBe(0);
      expect(res.body.customer.transactionCount).toBe(0);
    });

    it('updates customer notes and contact info', async () => {
      const res = await request(app)
        .patch(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          notes: 'Updated: Prefers weekend evening settlement',
        });

      expect(res.status).toBe(200);
      expect(res.body.customer.notes).toBe('Updated: Prefers weekend evening settlement');
    });
  });

  describe('Ledger Engine & Balance Rules', () => {
    let customerId: string;
    let creditTxnId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Deepak Verma', phone: '+91 98333 44444' });
      customerId = res.body.customer.id;
    });

    it('records a credit entry and increases customer balance', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          type: 'CREDIT',
          amount: 500, // ₹500 = 50,000 paise
          description: 'Flour and Mustard Oil',
        });

      expect(res.status).toBe(201);
      expect(res.body.transaction.amountPaise).toBe(50000);
      expect(res.body.transaction.type).toBe('CREDIT');
      creditTxnId = res.body.transaction.id;

      // Verify customer balance increased to 50000 paise
      const custRes = await request(app)
        .get(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(custRes.body.customer.balancePaise).toBe(50000);
      expect(custRes.body.customer.totalCreditPaise).toBe(50000);
      expect(custRes.body.customer.totalPaymentPaise).toBe(0);
    });

    it('rejects zero or negative transaction amounts', async () => {
      const zeroRes = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          type: 'CREDIT',
          amount: 0,
        });

      expect(zeroRes.status).toBe(400);

      const negRes = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          type: 'CREDIT',
          amount: -50,
        });

      expect(negRes.status).toBe(400);
    });

    it('rejects payments exceeding outstanding balance by default', async () => {
      // Balance is ₹500. Attempt to pay ₹700 without advance permission
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          type: 'PAYMENT',
          amount: 700,
          description: 'Excess payment attempt',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('exceeds the current outstanding balance');
    });

    it('records a valid payment and decreases outstanding balance', async () => {
      // Pay ₹200 towards ₹500 balance => New balance should be ₹300 (30,000 paise)
      const res = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          type: 'PAYMENT',
          amount: 200,
          paymentMode: 'CASH',
          description: 'Cash payment part 1',
        });

      expect(res.status).toBe(201);
      expect(res.body.transaction.amountPaise).toBe(20000);

      const custRes = await request(app)
        .get(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(custRes.body.customer.balancePaise).toBe(30000); // ₹300
      expect(custRes.body.customer.totalCreditPaise).toBe(50000);
      expect(custRes.body.customer.totalPaymentPaise).toBe(20000);
    });

    it('reverses a transaction with full audit trail and restores balance', async () => {
      // Current state: Credit ₹500, Payment ₹200 -> Balance ₹300
      // Reverse the ₹500 credit transaction with a reason
      const res = await request(app)
        .post(`/api/transactions/${creditTxnId}/reverse`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Entry made by mistake for wrong customer',
        });

      expect(res.status).toBe(200);
      expect(res.body.transaction.reversedAt).not.toBeNull();
      expect(res.body.transaction.reversalReason).toBe('Entry made by mistake for wrong customer');

      // Check customer balance now reflects reversal
      const custRes = await request(app)
        .get(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Reversing the credit leaves totalCredit=0, totalPayment=200 -> balance = -20000 (advance/credit)
      expect(custRes.body.customer.totalCreditPaise).toBe(0);
    });
  });

  describe('Voice AI & NLP Parsing Layer', () => {
    it('accurately parses credit purchase with customer, amount, and items', async () => {
      const result = await VoiceParserService.parseVoiceTranscript(
        testUserId,
        'Deepak Verma purchased groceries worth 340 rupees'
      );

      expect(result.customerName).toBe('Deepak Verma');
      expect(result.transactionType).toBe('CREDIT');
      expect(result.amount).toBe(340);
      expect(result.amountPaise).toBe(34000);
    });

    it('accurately parses payment received with UPI mode', async () => {
      const result = await VoiceParserService.parseVoiceTranscript(
        testUserId,
        'Record payment of 500 rupees from Deepak Verma via UPI'
      );

      expect(result.transactionType).toBe('PAYMENT');
      expect(result.amount).toBe(500);
      expect(result.paymentMode).toBe('UPI');
    });

    it('flags ambiguity when amount is missing and does NOT commit to database', async () => {
      const result = await VoiceParserService.parseVoiceTranscript(
        testUserId,
        'Deepak Verma took some supplies today'
      );

      expect(result.clarificationNeeded).toBe(true);
      expect(result.amount).toBeNull();
      expect(result.clarificationReason).toContain('amount');

      // Verify that NO unconfirmed transaction was saved to the database
      const txns = await prisma.transaction.findMany({
        where: { userId: testUserId, description: 'Deepak Verma took some supplies today' },
      });
      expect(txns.length).toBe(0);
    });

    it('parses due dates like "next Friday"', async () => {
      const result = await VoiceParserService.parseVoiceTranscript(
        testUserId,
        'Vikram Singh owes 500 rupees and will pay next Friday'
      );

      expect(result.transactionType).toBe('CREDIT');
      expect(result.amount).toBe(500);
      expect(result.dueDate).not.toBeNull();
      expect(result.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Dashboard Summary Calculations', () => {
    it('returns real calculated metrics from database records', async () => {
      const res = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalCreditPaise');
      expect(res.body).toHaveProperty('totalPaymentsCollectedPaise');
      expect(res.body).toHaveProperty('totalCustomers');
      expect(res.body.weeklyCollections).toBeInstanceOf(Array);
      expect(res.body.weeklyCollections.length).toBe(7);
      expect(res.body.recentTransactions).toBeInstanceOf(Array);
    });
  });

  describe('User Data Privacy & Isolation', () => {
    it('prevents user A from viewing user B customers', async () => {
      // Register a second user
      const otherRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `second-${Date.now()}@talkledger.test`,
          password: 'password123',
          businessName: 'Second Shop',
        });

      const secondToken = otherRes.body.token;

      // Second user requests customers
      const res = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${secondToken}`);

      expect(res.status).toBe(200);
      // Second user must have 0 customers; they cannot see Vikram Singh or Deepak Verma
      expect(res.body.customers.length).toBe(0);

      // Clean up second user
      await prisma.user.delete({ where: { id: otherRes.body.user.id } });
    });
  });
});
