import { z } from 'zod';

export const CreateCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Customer name is required')
    .max(100, 'Customer name cannot exceed 100 characters'),
  phone: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val === '' ? null : val))
    .refine((val: string | null | undefined) => {
      if (!val) return true;
      const clean = val.replace(/[\s\-\(\)\.]/g, '');
      return /^\+?\d{7,15}$/.test(clean);
    }, 'Please enter a valid phone number (7-15 digits, e.g. +91 98765 43210)'),
  notes: z
    .string()
    .trim()
    .max(500, 'Notes cannot exceed 500 characters')
    .optional()
    .nullable()
    .transform((val) => (val === '' ? null : val)),
  openingBalancePaise: z.number().int().nonnegative().optional().default(0),
});

export const UpdateCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Customer name cannot be empty')
    .max(100, 'Customer name cannot exceed 100 characters')
    .optional(),
  phone: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val === '' ? null : val))
    .refine((val: string | null | undefined) => {
      if (!val) return true;
      const clean = val.replace(/[\s\-\(\)\.]/g, '');
      return /^\+?\d{7,15}$/.test(clean);
    }, 'Please enter a valid phone number (7-15 digits, e.g. +91 98765 43210)'),
  notes: z
    .string()
    .trim()
    .max(500, 'Notes cannot exceed 500 characters')
    .optional()
    .nullable()
    .transform((val) => (val === '' ? null : val)),
});

export const CreateTransactionSchema = z
  .object({
    customerId: z.string().trim().min(1, 'Select a valid customer'),
    type: z.enum(['CREDIT', 'PAYMENT']),
    amount: z.number().positive('Amount must be greater than zero').optional(),
    amountPaise: z.number().int().positive('Amount in paise must be positive').optional(),
    description: z
      .string()
      .trim()
      .max(255, 'Description cannot exceed 255 characters')
      .optional()
      .nullable()
      .transform((val) => (val === '' ? null : val)),
    paymentMode: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'OTHER']).optional().nullable(),
    transactionDate: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) => (val === '' ? undefined : val))
      .refine((val) => !val || /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(val), {
        message: 'Valid date required (YYYY-MM-DD)',
      }),
    dueDate: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) => (val === '' ? null : val))
      .refine((val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
        message: 'Valid due date required (YYYY-MM-DD)',
      }),
    source: z.enum(['MANUAL', 'VOICE']).optional().default('MANUAL'),
    allowOverpayment: z.boolean().optional().default(false),
  })
  .refine((data) => data.amount !== undefined || data.amountPaise !== undefined, {
    message: 'Please specify a transaction amount greater than zero',
    path: ['amount'],
  });

export const ReverseTransactionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, 'Please provide a reason of at least 3 characters for reversing this entry')
    .max(200, 'Reason cannot exceed 200 characters'),
});

export const VoiceParseSchema = z
  .object({
    transcript: z.string().trim().optional(),
    text: z.string().trim().optional(),
  })
  .refine(
    (data) => {
      const content = (data.transcript || data.text || '').trim();
      return content.length > 0;
    },
    {
      message: 'Please speak or enter a transaction phrase to parse',
      path: ['transcript'],
    }
  );

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
