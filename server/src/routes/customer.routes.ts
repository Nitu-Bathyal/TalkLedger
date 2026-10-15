import { Router } from 'express';
import { CustomerService } from '../services/customer.service.js';
import { TransactionService } from '../services/transaction.service.js';
import { validateBody } from '../middleware/validate.js';
import { CreateCustomerSchema, UpdateCustomerSchema } from '../shared/schemas.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';

export const customerRouter = Router();

customerRouter.use(authenticateToken);

// List all customers
customerRouter.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const search = req.query.search as string | undefined;
    const filter = req.query.filter as 'all' | 'pending' | 'settled' | undefined;
    const customers = await CustomerService.listCustomers(req.user!.id, { search, filter });
    res.json({ customers });
  } catch (err) {
    next(err);
  }
});

// Create new customer
customerRouter.post('/', validateBody(CreateCustomerSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const customer = await CustomerService.createCustomer(req.user!.id, req.body);
    res.status(201).json({ customer, message: `Created customer ledger for ${customer.name}` });
  } catch (err) {
    next(err);
  }
});

// Get single customer by ID
customerRouter.get('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const customerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const customer = await CustomerService.getCustomerById(req.user!.id, customerId);
    res.json({ customer });
  } catch (err) {
    next(err);
  }
});

// Update customer details
customerRouter.patch('/:id', validateBody(UpdateCustomerSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const customerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const customer = await CustomerService.updateCustomer(req.user!.id, customerId, req.body);
    res.json({ customer, message: 'Customer details updated successfully' });
  } catch (err) {
    next(err);
  }
});

// Get customer's transactions
customerRouter.get('/:id/transactions', async (req: AuthenticatedRequest, res, next) => {
  try {
    const customerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const transactions = await TransactionService.listTransactions(req.user!.id, {
      customerId,
      includeReversed: true,
    });
    res.json({ transactions });
  } catch (err) {
    next(err);
  }
});
