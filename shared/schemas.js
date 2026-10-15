"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginUserSchema = exports.RegisterUserSchema = exports.VoiceParseSchema = exports.ReverseTransactionSchema = exports.CreateTransactionSchema = exports.UpdateCustomerSchema = exports.CreateCustomerSchema = void 0;
const zod_1 = require("zod");
exports.CreateCustomerSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1, 'Customer name is required').max(100, 'Name cannot exceed 100 characters'),
    phone: zod_1.z.string().trim().optional().nullable().refine((val) => {
        if (!val || val === '')
            return true;
        // Allow standard Indian/international formats (10 digits with optional +91, spaces, dashes)
        return /^(\+?\d{1,4}[- ]?)?\d{9,12}$/.test(val.replace(/\s+/g, ''));
    }, 'Please enter a valid phone number (e.g. +91 98765 43210)'),
    notes: zod_1.z.string().trim().max(500, 'Notes cannot exceed 500 characters').optional().nullable(),
    openingBalancePaise: zod_1.z.number().int().nonnegative().optional().default(0),
});
exports.UpdateCustomerSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1, 'Customer name is required').max(100).optional(),
    phone: zod_1.z.string().trim().optional().nullable(),
    notes: zod_1.z.string().trim().max(500).optional().nullable(),
});
exports.CreateTransactionSchema = zod_1.z.object({
    customerId: zod_1.z.string().min(1, 'Customer is required'),
    type: zod_1.z.enum(['CREDIT', 'PAYMENT'], {
        errorMap: () => ({ message: 'Transaction type must be CREDIT or PAYMENT' }),
    }),
    amount: zod_1.z.number().positive('Amount must be greater than zero').optional(),
    amountPaise: zod_1.z.number().int().positive('Amount in paise must be positive').optional(),
    description: zod_1.z.string().trim().max(255).optional().nullable(),
    paymentMode: zod_1.z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'OTHER']).optional().nullable(),
    transactionDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, 'Valid date required (YYYY-MM-DD)').optional(),
    dueDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid due date required (YYYY-MM-DD)').optional().nullable(),
    source: zod_1.z.enum(['MANUAL', 'VOICE']).optional().default('MANUAL'),
    allowOverpayment: zod_1.z.boolean().optional().default(false),
}).refine(data => data.amount !== undefined || data.amountPaise !== undefined, {
    message: 'Either amount or amountPaise must be provided',
    path: ['amount'],
});
exports.ReverseTransactionSchema = zod_1.z.object({
    reason: zod_1.z.string().trim().min(3, 'Please provide a reason of at least 3 characters for reversing this entry').max(200),
});
exports.VoiceParseSchema = zod_1.z.object({
    transcript: zod_1.z.string().trim().min(2, 'Voice speech transcript cannot be empty'),
});
exports.RegisterUserSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email('Valid email address required'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    businessName: zod_1.z.string().trim().min(2, 'Business or Shop name is required'),
    phone: zod_1.z.string().trim().optional().nullable(),
    upiId: zod_1.z.string().trim().optional().nullable(),
});
exports.LoginUserSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email('Valid email address required'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
