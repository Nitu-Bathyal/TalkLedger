import { Router } from 'express';
import { TransactionService } from '../services/transaction.service.js';
import { validateBody } from '../middleware/validate.js';
import { CreateTransactionSchema, ReverseTransactionSchema } from '../shared/schemas.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';

export const transactionRouter = Router();

transactionRouter.use(authenticateToken);

// List transactions
transactionRouter.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const customerId = req.query.customerId as string | undefined;
    const type = req.query.type as 'CREDIT' | 'PAYMENT' | 'all' | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const includeReversed = req.query.includeReversed === 'true';

    const transactions = await TransactionService.listTransactions(req.user!.id, {
      customerId,
      type,
      startDate,
      endDate,
      includeReversed,
    });

    res.json({ transactions });
  } catch (err) {
    next(err);
  }
});

// Create new transaction (Credit or Payment)
transactionRouter.post('/', validateBody(CreateTransactionSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const transaction = await TransactionService.createTransaction(req.user!.id, req.body);
    const actionLabel = transaction.type === 'CREDIT' ? 'Credit recorded' : 'Payment received';
    res.status(201).json({
      transaction,
      message: `${actionLabel} for ${transaction.customer?.name || 'customer'}`,
    });
  } catch (err) {
    next(err);
  }
});

// Get single transaction by ID
transactionRouter.get('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const txnId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const transaction = await TransactionService.getTransactionById(req.user!.id, txnId);
    res.json({ transaction });
  } catch (err) {
    next(err);
  }
});

// Reverse a transaction with audit trail
transactionRouter.post('/:id/reverse', validateBody(ReverseTransactionSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const txnId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const transaction = await TransactionService.reverseTransaction(req.user!.id, txnId, req.body);
    res.json({
      transaction,
      message: `Transaction reversed: ${req.body.reason}`,
    });
  } catch (err) {
    next(err);
  }
});
