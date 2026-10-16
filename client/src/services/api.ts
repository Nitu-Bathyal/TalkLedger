import {
  Customer,
  Transaction,
  DashboardSummary,
  VoiceParseResult,
} from '../shared/types';
import {
  CreateCustomerInput,
  UpdateCustomerInput,
  CreateTransactionInput,
  ReverseTransactionInput,
} from '../shared/schemas';

const API_BASE = '/api';

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  const token = localStorage.getItem('talkledger_token');
  if (token && token !== 'null' && token !== 'undefined' && token.trim() !== '') {
    headers['Authorization'] = `Bearer ${token.trim()}`;
  }
  return headers;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('talkledger_token');
    }
    let errorMessage = '';
    if (Array.isArray(data.details) && data.details.length > 0) {
      errorMessage = data.details.map((d: any) => d.message).filter(Boolean).join('; ');
    }
    if (!errorMessage) {
      errorMessage = data.message || data.error || `Request failed with status ${res.status}`;
    }
    throw new Error(errorMessage);
  }

  return data as T;
}

export const api = {
  // Health
  checkHealth: () => request<{ status: string }>('/health'),

  // Dashboard
  getDashboard: () => request<DashboardSummary>('/dashboard'),

  // Customers
  getCustomers: (search?: string, filter?: 'all' | 'pending' | 'settled') => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (filter) params.append('filter', filter);
    const qs = params.toString();
    return request<{ customers: Customer[] }>(`/customers${qs ? `?${qs}` : ''}`);
  },

  getCustomer: (id: string) => request<{ customer: Customer & { transactions: Transaction[] } }>(`/customers/${id}`),

  createCustomer: (data: CreateCustomerInput) =>
    request<{ customer: Customer; message: string }>('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCustomer: (id: string, data: UpdateCustomerInput) =>
    request<{ customer: Customer; message: string }>(`/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Transactions
  getTransactions: (options?: {
    customerId?: string;
    type?: 'CREDIT' | 'PAYMENT' | 'all';
    startDate?: string;
    endDate?: string;
    includeReversed?: boolean;
  }) => {
    const params = new URLSearchParams();
    if (options?.customerId) params.append('customerId', options.customerId);
    if (options?.type) params.append('type', options.type);
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);
    if (options?.includeReversed) params.append('includeReversed', 'true');
    const qs = params.toString();
    return request<{ transactions: Transaction[] }>(`/transactions${qs ? `?${qs}` : ''}`);
  },

  createTransaction: (data: CreateTransactionInput) =>
    request<{ transaction: Transaction; message: string }>('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  reverseTransaction: (id: string, data: ReverseTransactionInput) =>
    request<{ transaction: Transaction; message: string }>(`/transactions/${id}/reverse`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Voice AI
  parseVoice: (transcript: string) =>
    request<VoiceParseResult>('/voice/parse', {
      method: 'POST',
      body: JSON.stringify({ transcript }),
    }),

  // Auth & Profile
  getMe: () => request<{ user: any }>('/auth/me'),

  login: (data: { email: string; password: string }) =>
    request<{ user: any; token: string; message: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  register: (data: { email: string; password: string; businessName: string; phone?: string; upiId?: string }) =>
    request<{ user: any; token: string; message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Google Gemma 2 Conversational Assistant
  getGemmaStatus: () =>
    request<{
      configured: boolean;
      provider: string;
      model: string;
      status: string;
      message: string;
      instructions: string;
    }>('/gemma/status'),

  sendGemmaChat: (prompt: string, history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []) =>
    request<{
      message: string;
      model: string;
      provider: string;
      preview?: {
        actionType: 'TRANSACTION' | 'CUSTOMER';
        requiresConfirmation: true;
        data: any;
        summaryText: string;
      } | null;
      error?: string | null;
    }>('/gemma/chat', {
      method: 'POST',
      body: JSON.stringify({ prompt, history }),
    }),

  confirmGemmaAction: (actionType: 'TRANSACTION' | 'CUSTOMER', data: any) =>
    request<{ success: boolean; message: string; customer?: Customer; transaction?: Transaction }>(
      '/gemma/confirm-action',
      {
        method: 'POST',
        body: JSON.stringify({ actionType, data }),
      }
    ),

  // TabPFN-3.5 Tabular Predictive Analytics
  getTabPfnStatus: () =>
    request<{
      model: string;
      developer: string;
      license: string;
      sdkAvailability: string;
      configured: boolean;
      tokenPresent: boolean;
      endpoint: string;
      architectureNote: string;
    }>('/tabpfn/status'),

  getTabPfnForecast: () =>
    request<{
      engine: string;
      isModelGenerated: boolean;
      modelLicense: string;
      dataPeriod: { start: string | null; end: string | null; totalTransactionsAnalyzed: number };
      disclaimer: string;
      forecasts: Array<{
        anonymousId: string;
        actualCustomerName: string;
        outstandingBalancePaise: number;
        outstandingBalanceFormatted: string;
        repaymentProbabilityPct: number;
        estimatedCollectionDays: number;
        riskCategory: 'LOW' | 'MEDIUM' | 'HIGH';
        confidenceInterval: string;
      }>;
      summary: {
        expectedCollectionsNext30DaysPaise: number;
        expectedCollectionsNext30DaysFormatted: string;
        highRiskOutstandingPaise: number;
        highRiskOutstandingFormatted: string;
      };
    }>('/tabpfn/forecast'),
};
