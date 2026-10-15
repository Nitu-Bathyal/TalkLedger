/**
 * TalkLedger — Shared Types & Enums
 */

export type TransactionType = 'CREDIT' | 'PAYMENT' | 'REVERSAL';
export type TransactionSource = 'MANUAL' | 'VOICE';
export type PaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'OTHER';

export interface UserProfile {
  id: string;
  email: string;
  businessName: string;
  phone?: string | null;
  upiId?: string | null;
  createdAt: string;
}

export interface Customer {
  id: string;
  userId: string;
  name: string;
  phone?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  balancePaise: number; // outstanding credit owed by customer
  totalCreditPaise: number;
  totalPaymentPaise: number;
  transactionCount: number;
  lastActivityDate?: string | null;
  isOverdue?: boolean;
}

export interface Transaction {
  id: string;
  userId: string;
  customerId: string;
  type: TransactionType;
  amountPaise: number;
  description?: string | null;
  paymentMode?: PaymentMode | null;
  transactionDate: string; // ISO 8601 or YYYY-MM-DD
  dueDate?: string | null;
  source: TransactionSource;
  reversedAt?: string | null;
  reversalReason?: string | null;
  originalTransactionId?: string | null;
  createdAt: string;
  customer?: {
    id: string;
    name: string;
    phone?: string | null;
  };
}

export interface WeeklyCollectionDay {
  day: string; // Mon, Tue...
  date: string; // YYYY-MM-DD
  amountPaise: number;
  percentage: number; // 0-100 relative to peak
}

export interface DashboardSummary {
  totalCreditPaise: number;
  totalPaymentsCollectedPaise: number;
  totalCustomers: number;
  customersWithBalanceCount: number;
  overdueCustomersCount: number;
  weeklyCollections: WeeklyCollectionDay[];
  weeklyTotalCollectedPaise: number;
  recentTransactions: Transaction[];
}

export interface VoiceParseResult {
  customerName: string | null;
  matchedCustomerId: string | null;
  customerCandidates?: Array<{ id: string; name: string; phone?: string | null; balancePaise: number }>;
  transactionType: 'CREDIT' | 'PAYMENT' | null;
  amount: number | null; // in Rupees
  amountPaise: number | null; // in Paise
  description: string | null;
  dueDate: string | null; // YYYY-MM-DD
  paymentMode: PaymentMode | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  ambiguityIndicators: string[];
  clarificationNeeded: boolean;
  clarificationReason: string | null;
  rawTranscript: string;
}

/**
 * Currency and financial math utilities
 */
export function rupeesToPaise(rupees: number | string): number {
  const num = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
  if (isNaN(num) || !isFinite(num)) {
    throw new Error('Invalid rupee amount');
  }
  return Math.round(num * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function formatINR(paise: number, options?: { showPaise?: boolean }): string {
  const rupees = paise / 100;
  const isNegative = rupees < 0;
  const absRupees = Math.abs(rupees);
  
  // Format with Indian numbering system
  const hasDecimal = options?.showPaise || (paise % 100 !== 0);
  const formatted = absRupees.toLocaleString('en-IN', {
    minimumFractionDigits: hasDecimal ? 2 : 0,
    maximumFractionDigits: 2,
  });

  return `${isNegative ? '-' : ''}₹${formatted}`;
}
