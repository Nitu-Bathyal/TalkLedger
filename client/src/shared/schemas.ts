import { z } from 'zod';

export const CreateCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required').max(100, 'Name cannot exceed 100 characters'),
  phone: z.string().trim().optional().nullable().refine((val: string | null | undefined) => {
    if (!val || val === '') return true;
    return /^(\+?\d{1,4}[- ]?)?\d{9,12}$/.test(val.replace(/\s+/g, ''));
  }, 'Please enter a valid phone number (e.g. +91 98765 43210)'),
  notes: z.string().trim().max(500, 'Notes cannot exceed 500 characters').optional().nullable(),
  openingBalancePaise: z.number().int().nonnegative().optional().default(0),
});

export const UpdateCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required').max(100).optional(),
  phone: z.string().trim().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const CreateTransactionSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  type: z.enum(['CREDIT', 'PAYMENT']),
  amount: z.number().positive('Amount must be greater than zero').optional(),
  amountPaise: z.number().int().positive('Amount in paise must be positive').optional(),
  description: z.string().trim().max(255).optional().nullable(),
  paymentMode: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'OTHER']).optional().nullable(),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, 'Valid date required (YYYY-MM-DD)').optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid due date required (YYYY-MM-DD)').optional().nullable(),
  source: z.enum(['MANUAL', 'VOICE']).optional().default('MANUAL'),
  allowOverpayment: z.boolean().optional().default(false),
}).refine((data: { amount?: number; amountPaise?: number }) => data.amount !== undefined || data.amountPaise !== undefined, {
  message: 'Either amount or amountPaise must be provided',
  path: ['amount'],
});

export const ReverseTransactionSchema = z.object({
  reason: z.string().trim().min(3, 'Please provide a reason of at least 3 characters for reversing this entry').max(200),
});

export const VoiceParseSchema = z.object({
  transcript: z.string().trim().min(2, 'Voice speech transcript cannot be empty'),
});

export const RegisterUserSchema = z.object({
  email: z.string().trim().email('Valid email address required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  businessName: z.string().trim().min(2, 'Business or Shop name is required'),
  phone: z.string().trim().optional().nullable(),
  upiId: z.string().trim().optional().nullable(),
});

export const LoginUserSchema = z.object({
  email: z.string().trim().email('Valid email address required'),
  password: z.string().min(1, 'Password is required'),
});

export type CreateCustomerInput = z.input<typeof CreateCustomerSchema>;
export type UpdateCustomerInput = z.input<typeof UpdateCustomerSchema>;
export type CreateTransactionInput = z.input<typeof CreateTransactionSchema>;
export type ReverseTransactionInput = z.input<typeof ReverseTransactionSchema>;
export type VoiceParseInput = z.input<typeof VoiceParseSchema>;
export type RegisterUserInput = z.input<typeof RegisterUserSchema>;
export type LoginUserInput = z.input<typeof LoginUserSchema>;
