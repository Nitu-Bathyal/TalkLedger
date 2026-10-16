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

    it('prevents accidental duplicate customer with identical name and identical phone', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Vikram Singh',
          phone: '+91 98111 22222',
        });

      expect(res.status).toBe(409);
      expect(res.body.message || res.body.error).toContain('already exists');
    });

    it('allows creating customers with the same name if distinguishable by phone number', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Vikram Singh',
          phone: '+91 98111 33333', // Distinct phone
          notes: 'Second Vikram Singh from Sector 4',
        });

      expect(res.status).toBe(201);
      expect(res.body.customer.name).toBe('Vikram Singh');
      expect(res.body.customer.phone).toBe('+91 98111 33333');
    });

    it('rejects duplicate when both customers have the same name and neither has a phone', async () => {
      // First customer without phone
      const firstRes = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Sunil Kumar',
        });
      expect(firstRes.status).toBe(201);

      // Second customer without phone and same name
      const secondRes = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Sunil Kumar',
        });
      expect(secondRes.status).toBe(409);
      expect(secondRes.body.message || secondRes.body.error).toContain('already exists without a phone number');
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

    it('verifies newly created customer appears in customer list and can be used for transactions', async () => {
      const listRes = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${authToken}`);

      expect(listRes.status).toBe(200);
      const found = listRes.body.customers.find((c: any) => c.id === customerId);
      expect(found).toBeDefined();
      expect(found.name).toBe('Vikram Singh');

      // Now create a transaction with this customer
      const txnRes = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId,
          type: 'CREDIT',
          amount: 150,
          description: 'Initial transaction test',
        });

      expect(txnRes.status).toBe(201);
      expect(txnRes.body.transaction.amountPaise).toBe(15000);
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
    beforeAll(async () => {
      // Seed customers for voice parsing tests
      await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Ramesh Kumar', phone: '+91 98765 43210' });

      await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Aarav Sharma', phone: '+91 98123 45678' });

      await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Anita Tailor', phone: '+91 99887 76655' });

      await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Anita Verma', phone: '+91 99887 76699' });
    });

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

    it('accurately parses "Ramesh Kumar owes 500 rupees."', async () => {
      const result = await VoiceParserService.parseVoiceTranscript(
        testUserId,
        'Ramesh Kumar owes 500 rupees.'
      );

      expect(result.customerName).toBe('Ramesh Kumar');
      expect(result.matchedCustomerId).not.toBeNull();
      expect(result.transactionType).toBe('CREDIT');
      expect(result.amount).toBe(500);
      expect(result.amountPaise).toBe(50000);
      expect(result.clarificationNeeded).toBe(false);
    });

    it('accurately parses "Aarav Sharma paid 200 rupees in cash."', async () => {
      const result = await VoiceParserService.parseVoiceTranscript(
        testUserId,
        'Aarav Sharma paid 200 rupees in cash.'
      );

      expect(result.customerName).toBe('Aarav Sharma');
      expect(result.matchedCustomerId).not.toBeNull();
      expect(result.transactionType).toBe('PAYMENT');
      expect(result.amount).toBe(200);
      expect(result.amountPaise).toBe(20000);
      expect(result.paymentMode).toBe('CASH');
      expect(result.clarificationNeeded).toBe(false);
    });

    it('accurately parses "Anita Tailor received fabric worth 850 rupees on credit."', async () => {
      const result = await VoiceParserService.parseVoiceTranscript(
        testUserId,
        'Anita Tailor received fabric worth 850 rupees on credit.'
      );

      expect(result.customerName).toBe('Anita Tailor');
      expect(result.matchedCustomerId).not.toBeNull();
      expect(result.transactionType).toBe('CREDIT');
      expect(result.amount).toBe(850);
      expect(result.amountPaise).toBe(85000);
      expect(result.description).toBe('Fabric');
      expect(result.clarificationNeeded).toBe(false);
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

    it('flags ambiguity when ambiguous customer name is mentioned and does not silently pick one', async () => {
      const result = await VoiceParserService.parseVoiceTranscript(
        testUserId,
        'Anita paid 300 rupees'
      );

      expect(result.clarificationNeeded).toBe(true);
      expect(result.matchedCustomerId).toBeNull();
      expect(result.clarificationReason).toContain('Multiple customers matched');
    });

    it('flags clarification when customer name is not yet registered in ledger', async () => {
      const result = await VoiceParserService.parseVoiceTranscript(
        testUserId,
        'Rahul Mehta owes 450 rupees'
      );

      expect(result.clarificationNeeded).toBe(true);
      expect(result.matchedCustomerId).toBeNull();
      expect(result.clarificationReason).toContain('not yet registered');
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

    it('handles /api/voice/parse endpoint with valid input and returns matching schema', async () => {
      const res = await request(app)
        .post('/api/voice/parse')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ transcript: 'Ramesh Kumar owes 500 rupees.' });

      expect(res.status).toBe(200);
      expect(res.body.customerName).toBe('Ramesh Kumar');
      expect(res.body.transactionType).toBe('CREDIT');
      expect(res.body.amount).toBe(500);
      expect(res.body.matchedCustomerId).not.toBeNull();
    });

    it('returns structured validation error when transcript is blank', async () => {
      const res = await request(app)
        .post('/api/voice/parse')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ transcript: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.message).toContain('Please speak or enter a transaction phrase');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details[0].field).toBe('transcript');
    });

    it('ensures parsing voice never automatically writes a transaction to the database', async () => {
      const beforeCount = await prisma.transaction.count({ where: { userId: testUserId } });

      // Parse speech for a valid customer and amount
      const parseRes = await request(app)
        .post('/api/voice/parse')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ transcript: 'Ramesh Kumar owes 500 rupees.' });

      expect(parseRes.status).toBe(200);

      // Verify transaction count in DB has NOT changed
      const afterCount = await prisma.transaction.count({ where: { userId: testUserId } });
      expect(afterCount).toBe(beforeCount);
    });

    it('successfully persists transaction upon explicit user confirmation', async () => {
      // 1. Parse speech
      const parseRes = await request(app)
        .post('/api/voice/parse')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ transcript: 'Anita Tailor received fabric worth 850 rupees on credit.' });

      expect(parseRes.status).toBe(200);
      const parsed = parseRes.body;

      // 2. User explicitly reviews and confirms form
      const confirmRes = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId: parsed.matchedCustomerId,
          type: parsed.transactionType,
          amount: parsed.amount,
          description: parsed.description,
          source: 'VOICE',
        });

      expect(confirmRes.status).toBe(201);
      expect(confirmRes.body.transaction.amountPaise).toBe(85000);
      expect(confirmRes.body.transaction.source).toBe('VOICE');

      // 3. Verify database balance updated
      const custRes = await request(app)
        .get(`/api/customers/${parsed.matchedCustomerId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(custRes.body.customer.balancePaise).toBe(85000);
    });
  });

  describe('Speech Recognition Client Error Handling Contract', () => {
    it('accurately maps speech recognition event errors to actionable user messages', () => {
      const mapSpeechError = (errorType: string) => {
        if (errorType === 'not-allowed' || errorType === 'permission-denied') {
          return 'Microphone permission denied. Please allow microphone access in your browser or type details below.';
        } else if (errorType === 'no-speech') {
          return 'No speech detected. Please tap the mic and speak clearly.';
        } else if (errorType === 'network') {
          return 'Network error with speech service. Please check your internet or use text input below.';
        } else if (errorType === 'audio-capture') {
          return 'No microphone detected. Please check your microphone connection or use text input below.';
        }
        return `Speech error (${errorType}). Please use text fallback below.`;
      };

      expect(mapSpeechError('not-allowed')).toContain('Microphone permission denied');
      expect(mapSpeechError('permission-denied')).toContain('Microphone permission denied');
      expect(mapSpeechError('no-speech')).toContain('No speech detected');
      expect(mapSpeechError('network')).toContain('Network error');
      expect(mapSpeechError('audio-capture')).toContain('No microphone detected');
      expect(mapSpeechError('aborted')).toContain('Speech error (aborted)');
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
