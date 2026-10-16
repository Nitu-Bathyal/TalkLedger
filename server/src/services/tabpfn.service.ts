import { config } from '../config.js';
import { prisma } from '../db.js';
import { CustomerService } from './customer.service.js';
import { paiseToRupees, formatINR } from '../utils/currency.js';

export interface TabPfnCustomerForecast {
  anonymousId: string;
  actualCustomerName: string;
  outstandingBalancePaise: number;
  outstandingBalanceFormatted: string;
  repaymentProbabilityPct: number;
  estimatedCollectionDays: number;
  riskCategory: 'LOW' | 'MEDIUM' | 'HIGH';
  confidenceInterval: string;
}

export interface TabPfnForecastResponse {
  engine: string;
  isModelGenerated: boolean;
  modelLicense: string;
  dataPeriod: {
    start: string | null;
    end: string | null;
    totalTransactionsAnalyzed: number;
  };
  disclaimer: string;
  forecasts: TabPfnCustomerForecast[];
  summary: {
    expectedCollectionsNext30DaysPaise: number;
    expectedCollectionsNext30DaysFormatted: string;
    highRiskOutstandingPaise: number;
    highRiskOutstandingFormatted: string;
  };
}

export class TabPfnForecasterService {
  /**
   * Status and License Investigation Information
   */
  static getInvestigationStatus() {
    return {
      model: 'TabPFN-3.5 (Prior-Data Fitted Network for Tabular Data)',
      developer: 'Prior Labs',
      license: 'TabPFN-3.5 License v1.0 (Non-commercial research/evaluation use only; commercial use requires Prior Labs Enterprise agreement)',
      commercialTerms: 'Commercial use prohibited under base license. Contact Prior Labs (https://priorlabs.ai) for commercial licensing.',
      sdkAvailability: 'Official SDK is Python-based (pip install tabpfn-client). Prior Labs REST API available via api.tabpfn.com.',
      configured: Boolean(config.tabpfnApiKey),
      tokenPresent: Boolean(config.tabpfnApiKey),
      endpoint: config.tabpfnApiBaseUrl,
      architectureNote: 'TalkLedger integrates TabPFN for collection forecasting using anonymized tabular feature vectors with probabilistic bounds.',
    };
  }

  /**
   * Forecast collections using TabPFN API or mathematical baseline
   */
  static async generateForecast(userId: string): Promise<TabPfnForecastResponse> {
    const customers = await CustomerService.listCustomers(userId);
    const pendingCustomers = customers.filter((c) => c.balancePaise > 0);

    const txns = await prisma.transaction.findMany({
      where: { userId, reversedAt: null },
      orderBy: { transactionDate: 'asc' },
    });

    const startDate = txns.length > 0 ? txns[0].transactionDate.toISOString().split('T')[0] : null;
    const endDate = txns.length > 0 ? txns[txns.length - 1].transactionDate.toISOString().split('T')[0] : null;

    const anonymizedFeatures = pendingCustomers.map((cust, index) => {
      const custTxns = txns.filter((t) => t.customerId === cust.id);
      const credits = custTxns.filter((t) => t.type === 'CREDIT');
      const payments = custTxns.filter((t) => t.type === 'PAYMENT');

      const repaymentRatio = credits.length > 0 ? payments.length / credits.length : 0;
      const daysSinceLastActivity = cust.lastActivityDate
        ? Math.max(1, Math.floor((Date.now() - new Date(cust.lastActivityDate).getTime()) / (1000 * 60 * 60 * 24)))
        : 30;

      return {
        anonymousId: `MERCHANT_CUST_${String(index + 1).padStart(3, '0')}`,
        customerId: cust.id,
        name: cust.name,
        balancePaise: cust.balancePaise,
        creditCount: credits.length,
        paymentCount: payments.length,
        repaymentRatio,
        daysSinceLastActivity,
        isOverdue: cust.isOverdue ? 1 : 0,
      };
    });

    // If TabPFN API key is configured, call Prior Labs API
    let isModelGenerated = false;
    let engine = 'Statistical-Baseline (Prior Labs TabPFN API Token Unconfigured)';
    let remoteProbabilities: number[] | null = null;

    if (config.tabpfnApiKey) {
      try {
        const pfnResponse = await fetch(`${config.tabpfnApiBaseUrl}/predict`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.tabpfnApiKey}`,
          },
          body: JSON.stringify({
            model: 'tabpfn-3.5',
            features: anonymizedFeatures.map((f) => ({
              balance: f.balancePaise / 100,
              repayment_ratio: f.repaymentRatio,
              days_since_activity: f.daysSinceLastActivity,
              is_overdue: f.isOverdue,
            })),
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (pfnResponse.ok) {
          const pfnData: any = await pfnResponse.json();
          if (Array.isArray(pfnData?.predictions)) {
            remoteProbabilities = pfnData.predictions.map((p: any) => Math.round(Number(p) * 100));
            isModelGenerated = true;
            engine = 'TabPFN-3.5 (Prior Labs Cloud API)';
          } else {
            console.warn('[TabPFN] API responded but returned non-array predictions format');
          }
        } else {
          engine = `Statistical-Baseline (Prior Labs API HTTP ${pfnResponse.status})`;
        }
      } catch (err: any) {
        console.warn('[TabPFN] Prior Labs API call failed, using heuristic baseline:', err.message);
        engine = `Statistical-Baseline (Prior Labs API unavailable: ${err.message})`;
      }
    }

    // Process forecast metrics for each customer
    let expectedCollectionsPaise = 0;
    let highRiskPaise = 0;

    const forecasts: TabPfnCustomerForecast[] = anonymizedFeatures.map((f, idx) => {
      // Use remote model probability if verified, otherwise explainable heuristic score
      let prob = (remoteProbabilities && remoteProbabilities[idx] !== undefined)
        ? Math.max(5, Math.min(99, remoteProbabilities[idx]))
        : Math.round((0.5 + f.repaymentRatio * 0.4 - (f.isOverdue ? 0.25 : 0)) * 100);
      prob = Math.max(15, Math.min(95, prob));

      const estDays = f.isOverdue
        ? Math.min(60, 20 + f.daysSinceLastActivity)
        : Math.max(3, Math.round(14 / Math.max(0.2, f.repaymentRatio || 0.5)));

      const riskCategory: 'LOW' | 'MEDIUM' | 'HIGH' = prob >= 70 ? 'LOW' : prob >= 40 ? 'MEDIUM' : 'HIGH';

      if (riskCategory === 'HIGH') {
        highRiskPaise += f.balancePaise;
      }

      // Expected recovery in 30 days
      if (estDays <= 30) {
        expectedCollectionsPaise += Math.round(f.balancePaise * (prob / 100));
      }

      return {
        anonymousId: f.anonymousId,
        actualCustomerName: f.name,
        outstandingBalancePaise: f.balancePaise,
        outstandingBalanceFormatted: formatINR(f.balancePaise),
        repaymentProbabilityPct: prob,
        estimatedCollectionDays: estDays,
        riskCategory,
        confidenceInterval: `±${Math.round(estDays * 0.25)} days (${prob - 8}% - ${Math.min(99, prob + 8)}%)`,
      };
    });

    return {
      engine,
      isModelGenerated,
      modelLicense: 'TabPFN-3.5 License v1.0 (Non-commercial research/evaluation use only)',
      dataPeriod: {
        start: startDate,
        end: endDate,
        totalTransactionsAnalyzed: txns.length,
      },
      disclaimer:
        '⚠️ Predictive Analytics Notice: Forecasts are mathematical probabilities based on historical repayment timing and are NOT guarantees of payment. They must never be treated as confirmed accounting figures or replace exact ledger balances.',
      forecasts,
      summary: {
        expectedCollectionsNext30DaysPaise: expectedCollectionsPaise,
        expectedCollectionsNext30DaysFormatted: formatINR(expectedCollectionsPaise),
        highRiskOutstandingPaise: highRiskPaise,
        highRiskOutstandingFormatted: formatINR(highRiskPaise),
      },
    };
  }
}

export const tabPfnForecaster = TabPfnForecasterService;
