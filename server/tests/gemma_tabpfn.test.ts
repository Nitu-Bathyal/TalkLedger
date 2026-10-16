import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/db.js';
import { GemmaProviderService } from '../src/services/gemmaProvider.service.js';
import { TabPfnForecasterService } from '../src/services/tabpfn.service.js';

describe('Gemma 2 Conversational AI & TabPFN Predictive Ledger Tests', () => {
  let testUserId: string;
  let authToken: string;
  let testCustomerId: string;

  let otherUserId: string;
  let otherAuthToken: string;

  beforeAll(async () => {
    // 1. Create main test merchant
    const userRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `gemma-test-${Date.now()}@talkledger.test`,
        password: 'password123',
        businessName: 'Gemma & TabPFN Test Store',
        phone: '+91 98888 77777',
      });

    expect(userRes.status).toBe(201);
    testUserId = userRes.body.user.id;
    authToken = userRes.body.token;

    // Create a customer with credit and transactions
    const custRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Suresh Patel',
        phone: '+91 98765 11122',
        notes: 'Wholesale grains',
      });
    expect(custRes.status).toBe(201);
    testCustomerId = custRes.body.customer.id;

    // Add a credit transaction (Suresh owes ₹1,500 = 150000 paise)
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customerId: testCustomerId,
        type: 'CREDIT',
        amount: 1500,
        description: 'Bags of Basmati Rice',
      });

    // 2. Create another user for data isolation testing
    const otherRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `other-merchant-${Date.now()}@talkledger.test`,
        password: 'password123',
        businessName: 'Unrelated Bakery',
      });
    expect(otherRes.status).toBe(201);
    otherUserId = otherRes.body.user.id;
    otherAuthToken = otherRes.body.token;
  });

  afterAll(async () => {
    // Clean up test data
    if (testUserId) {
      await prisma.transaction.deleteMany({ where: { userId: testUserId } });
      await prisma.customer.deleteMany({ where: { userId: testUserId } });
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
    if (otherUserId) {
      await prisma.transaction.deleteMany({ where: { userId: otherUserId } });
      await prisma.customer.deleteMany({ where: { userId: otherUserId } });
      await prisma.user.deleteMany({ where: { id: otherUserId } });
    }
    await prisma.$disconnect();
  });

  // -------------------------------------------------------------------------
  // PHASE 1: GEMMA 2 CONVERSATIONAL AI & FINANCIAL SAFETY
  // -------------------------------------------------------------------------
  describe('Phase 1: Gemma Provider Service & Tools', () => {
    it('returns honest model status and tool capability definitions', async () => {
      const statusRes = await request(app)
        .get('/api/gemma/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body).toHaveProperty('configured');
      expect(statusRes.body).toHaveProperty('provider');
      expect(statusRes.body).toHaveProperty('model');
      expect(statusRes.body.model).toContain('gemma');
      expect(Array.isArray(statusRes.body.tools)).toBe(true);
      expect(statusRes.body.tools).toContain('get_ledger_summary');
      expect(statusRes.body.tools).toContain('get_top_debtors');
      expect(statusRes.body.tools).toContain('get_today_collections');
      expect(statusRes.body.tools).toContain('get_customer_balance');
      expect(statusRes.body.tools).toContain('prepare_transaction_preview');
      expect(statusRes.body.tools).toContain('prepare_customer_preview');
    });

    it('requires valid authentication for Gemma endpoints', async () => {
      const res = await request(app)
        .get('/api/gemma/status')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(403);

      const chatRes = await request(app)
        .post('/api/gemma/chat')
        .set('Authorization', 'Bearer invalid-token')
        .send({ prompt: 'How much do customers owe me?' });
      expect(chatRes.status).toBe(403);
    });

    it('executes authorized database tools isolated to current authenticated user', async () => {
      // Direct tool execution via Gemma provider
      const summaryResult = await GemmaProviderService.executeAuthorizedTool(testUserId, 'get_ledger_summary', {});
      expect(summaryResult.result).toHaveProperty('totalCustomers', 1);
      expect(summaryResult.result).toHaveProperty('totalCreditRupees', 1500);

      const debtorsResult = await GemmaProviderService.executeAuthorizedTool(testUserId, 'get_top_debtors', { limit: 5 });
      expect(Array.isArray(debtorsResult.result)).toBe(true);
      expect(debtorsResult.result.length).toBe(1);
      expect(debtorsResult.result[0].name).toBe('Suresh Patel');
      expect(debtorsResult.result[0].balanceRupees).toBe(1500);

      const custBalance = await GemmaProviderService.executeAuthorizedTool(testUserId, 'get_customer_balance', {
        customerName: 'Suresh Patel',
      });
      expect(custBalance.result).toHaveProperty('found', true);
      expect(custBalance.result.balanceRupees).toBe(1500);

      // Verify other user cannot see Suresh Patel
      const otherSummary = await GemmaProviderService.executeAuthorizedTool(otherUserId, 'get_ledger_summary', {});
      expect(otherSummary.result).toHaveProperty('totalCustomers', 0);
      expect(otherSummary.result).toHaveProperty('totalCreditRupees', 0);
    });

    it('handles natural-language conversational queries about real ledger figures', async () => {
      const res = await request(app)
        .post('/api/gemma/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ prompt: 'Who owes me the most money?' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
      expect(typeof res.body.message).toBe('string');
      expect(res.body.message.length).toBeGreaterThan(0);
      // Reply must reflect Suresh Patel or the ₹1,500 balance
      expect(res.body.message).toMatch(/Suresh|1,?500/i);
    });

    it('conversational transaction requests return PREVIEW only and DO NOT modify database', async () => {
      // Count transactions before
      const countBefore = await prisma.transaction.count({ where: { userId: testUserId } });

      const res = await request(app)
        .post('/api/gemma/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ prompt: 'Suresh Patel owes 500 rupees for rice' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('preview');

      const preview = res.body.preview;
      expect(preview).not.toBeNull();
      expect(preview.actionType).toBe('TRANSACTION');
      expect(preview.requiresConfirmation).toBe(true);
      expect(preview.data.amount).toBe(500);
      expect(preview.data.type).toBe('CREDIT');

      // Database MUST NOT have changed yet! (Financial Safety requirement)
      const countAfter = await prisma.transaction.count({ where: { userId: testUserId } });
      expect(countAfter).toBe(countBefore);
    });

    it('commits transaction ONLY upon explicit confirmation endpoint call', async () => {
      // 1. Prepare preview tool execution
      const previewTool = await GemmaProviderService.executeAuthorizedTool(testUserId, 'prepare_transaction_preview', {
        customerName: 'Suresh Patel',
        amountRupees: 300,
        type: 'PAYMENT',
        description: 'UPI payment received',
      });

      expect(previewTool.generatedPreview).toBeDefined();
      const preview = previewTool.generatedPreview!;
      expect(preview.requiresConfirmation).toBe(true);
      expect(preview.actionType).toBe('TRANSACTION');

      // 2. Explicit user confirmation
      const confirmRes = await request(app)
        .post('/api/gemma/confirm-action')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          actionType: preview.actionType,
          data: preview.data,
        });

      expect(confirmRes.status).toBe(201);
      expect(confirmRes.body.success).toBe(true);
      expect(confirmRes.body.transaction).toBeDefined();
      expect(confirmRes.body.transaction.amountPaise).toBe(30000); // 300 rupees

      // Verify balance in DB decreased from 1500 to 1200
      const custRes = await request(app)
        .get(`/api/customers/${testCustomerId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(custRes.status).toBe(200);
      expect(custRes.body.customer.balancePaise).toBe(120000); // 1200 rupees
    });

    it('rejects confirmation with invalid action payload', async () => {
      const invalidRes = await request(app)
        .post('/api/gemma/confirm-action')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          actionType: 'TRANSACTION',
          data: {
            customerId: '', // Missing customer
            amount: 100,
          },
        });

      expect(invalidRes.status).toBe(400);
      expect(invalidRes.body.error).toContain('Customer ID is required');
    });

    it('conversational customer creation generates preview and requires confirmation', async () => {
      const previewTool = await GemmaProviderService.executeAuthorizedTool(testUserId, 'prepare_customer_preview', {
        name: 'Meena Devi',
        phone: '+91 97777 88888',
        notes: 'Handloom textiles',
      });

      expect(previewTool.generatedPreview).toBeDefined();
      const preview = previewTool.generatedPreview!;
      expect(preview.actionType).toBe('CUSTOMER');
      expect(preview.requiresConfirmation).toBe(true);

      // Customer should not exist yet
      const notFoundCust = await prisma.customer.findFirst({
        where: { userId: testUserId, name: 'Meena Devi' },
      });
      expect(notFoundCust).toBeNull();

      // Confirm creation
      const confirmRes = await request(app)
        .post('/api/gemma/confirm-action')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          actionType: preview.actionType,
          data: preview.data,
        });

      expect(confirmRes.status).toBe(201);
      expect(confirmRes.body.success).toBe(true);

      // Verify customer exists now
      const foundCust = await prisma.customer.findFirst({
        where: { userId: testUserId, name: 'Meena Devi' },
      });
      expect(foundCust).not.toBeNull();
      expect(foundCust?.phone).toBe('+91 97777 88888');
    });
  });

  // -------------------------------------------------------------------------
  // PHASE 2: TABPFN PREDICTIVE COLLECTION FORECASTING
  // -------------------------------------------------------------------------
  describe('Phase 2: TabPFN-3.5 Tabular Predictive Engine & Safeguards', () => {
    it('returns official TabPFN licensing status, model info, and investigation metadata', async () => {
      const statusRes = await request(app)
        .get('/api/tabpfn/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body).toHaveProperty('model');
      expect(statusRes.body.model).toContain('TabPFN-3.5');
      expect(statusRes.body).toHaveProperty('developer', 'Prior Labs');
      expect(statusRes.body).toHaveProperty('license');
      expect(statusRes.body.license).toContain('Non-commercial');
      expect(statusRes.body).toHaveProperty('sdkAvailability');
      expect(statusRes.body.sdkAvailability).toContain('tabpfn-client');
      expect(statusRes.body).toHaveProperty('architectureNote');
    });

    it('generates anonymized tabular forecast with probabilistic uncertainty bounds', async () => {
      const forecastRes = await request(app)
        .get('/api/tabpfn/forecast')
        .set('Authorization', `Bearer ${authToken}`);

      expect(forecastRes.status).toBe(200);
      expect(forecastRes.body).toHaveProperty('engine');
      expect(forecastRes.body).toHaveProperty('modelLicense');
      expect(forecastRes.body).toHaveProperty('dataPeriod');
      expect(forecastRes.body).toHaveProperty('disclaimer');
      expect(forecastRes.body).toHaveProperty('forecasts');
      expect(forecastRes.body).toHaveProperty('summary');

      // The disclaimer MUST clearly separate predictions from exact accounting totals
      expect(forecastRes.body.disclaimer).toMatch(/prediction|mathematical|not guarantees/i);

      // Verify tabular rows
      const forecasts = forecastRes.body.forecasts;
      expect(Array.isArray(forecasts)).toBe(true);
      expect(forecasts.length).toBeGreaterThan(0);

      const row = forecasts.find((f: any) => f.actualCustomerName === 'Suresh Patel');
      expect(row).toBeDefined();

      // Check anonymization identifier
      expect(row.anonymousId).toMatch(/^MERCHANT_CUST_/);

      // Check probabilistic bounds: 0 <= prob <= 100
      expect(row.repaymentProbabilityPct).toBeGreaterThanOrEqual(0);
      expect(row.repaymentProbabilityPct).toBeLessThanOrEqual(100);

      // Check risk tier
      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(row.riskCategory);

      // Check confidence interval format
      expect(typeof row.confidenceInterval).toBe('string');
      expect(row.confidenceInterval).toContain('±');
    });

    it('enforces merchant data isolation in TabPFN forecasts', async () => {
      // otherUser has no customers with pending balance
      const otherForecastRes = await request(app)
        .get('/api/tabpfn/forecast')
        .set('Authorization', `Bearer ${otherAuthToken}`);

      expect(otherForecastRes.status).toBe(200);
      expect(otherForecastRes.body.forecasts.length).toBe(0);
      expect(otherForecastRes.body.summary.expectedCollectionsNext30DaysPaise).toBe(0);
    });
  });
});
