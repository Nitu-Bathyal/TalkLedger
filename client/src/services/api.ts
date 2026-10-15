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
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
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
    throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
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
};
