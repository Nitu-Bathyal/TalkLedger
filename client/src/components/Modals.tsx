import React, { useState } from 'react';
import { Customer, formatINR, PaymentMode } from '../shared/types';
import { api } from '../services/api';

/* ========================================================================= */
/* 1. ADD CREDIT MODAL                                                       */
/* ========================================================================= */
interface AddCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  defaultCustomer?: Customer | null;
  onSuccess: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AddCreditModal: React.FC<AddCreditModalProps> = ({
  isOpen,
  onClose,
  customers,
  defaultCustomer,
  onSuccess,
  onShowToast,
}) => {
  const [customerId, setCustomerId] = useState(defaultCustomer?.id || customers[0]?.id || '');
  const [amount, setAmount] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (defaultCustomer) {
      setCustomerId(defaultCustomer.id);
    } else if (customers.length > 0 && !customerId) {
      setCustomerId(customers[0].id);
    }
  }, [defaultCustomer, customers]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      onShowToast('Please select a customer', 'error');
      return;
    }
    if (!amount || amount <= 0) {
      onShowToast('Please specify a positive credit amount', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createTransaction({
        customerId,
        type: 'CREDIT',
        amount: Number(amount),
        description: description.trim() || 'Credit item',
        dueDate: dueDate || undefined,
        source: 'MANUAL',
      });
      const c = customers.find((cust) => cust.id === customerId);
      onShowToast(`Saved a ₹${amount} credit entry for ${c?.name || 'Customer'}!`, 'success');
      setAmount('');
      setDescription('');
      setDueDate('');
      onSuccess();
      onClose();
    } catch (err: any) {
      onShowToast(err.message || 'Failed to record credit', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink-brown/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border-2 border-ink-brown rounded-3xl max-w-md w-full p-6 shadow-bahi-lg space-y-4 animate-in fade-in zoom-in duration-150">
        <div className="flex justify-between items-center border-b-2 border-notebook-line pb-3">
          <h3 className="font-extrabold text-lg text-ink-brown">Add Credit Entry</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-cream border border-ink-brown flex items-center justify-center font-bold hover:bg-ink-brown hover:text-white"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold uppercase text-ink-muted mb-1">Customer</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
              className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-sm font-bold text-ink-brown focus:outline-none"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (Current: {formatINR(c.balancePaise)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-ink-muted mb-1">
              Credit Amount (₹)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="e.g. 350"
              required
              min="1"
              step="any"
              className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-sm font-extrabold text-tomato-red focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-ink-muted mb-1">Items / Reason</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. flour, cooking oil, snacks"
              className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-xs font-medium text-ink-brown"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-ink-muted mb-1">
              Due Date / Promise Date (Optional)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-xs font-bold text-ink-brown"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 py-2.5 bg-tomato-red text-white font-extrabold text-sm border-2 border-ink-brown rounded-xl shadow-bahi-sm hover:bg-red-600 active:translate-y-0.5 ${
                isSubmitting ? 'opacity-50 cursor-wait' : ''
              }`}
            >
              {isSubmitting ? 'Saving...' : 'Save Credit'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-cream border-2 border-ink-brown text-ink-brown font-bold text-sm rounded-xl hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ========================================================================= */
/* 2. RECORD PAYMENT MODAL                                                   */
/* ========================================================================= */
interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  defaultCustomer?: Customer | null;
  onSuccess: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  customers,
  defaultCustomer,
  onSuccess,
  onShowToast,
}) => {
  const [customerId, setCustomerId] = useState(defaultCustomer?.id || customers[0]?.id || '');
  const [amount, setAmount] = useState<number | ''>('');
  const [mode, setMode] = useState<PaymentMode>('CASH');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (defaultCustomer) {
      setCustomerId(defaultCustomer.id);
    } else if (customers.length > 0 && !customerId) {
      setCustomerId(customers[0].id);
    }
  }, [defaultCustomer, customers]);

  if (!isOpen) return null;

  const selectedCust = customers.find((c) => c.id === customerId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      onShowToast('Please select a customer', 'error');
      return;
    }
    if (!amount || amount <= 0) {
      onShowToast('Please specify a positive payment amount', 'error');
      return;
    }

    if (selectedCust && amount * 100 > selectedCust.balancePaise) {
      const confirmAdvance = window.confirm(
        `Payment (₹${amount}) exceeds the current balance of ${formatINR(
          selectedCust.balancePaise
        )}. Record as advance credit?`
      );
      if (!confirmAdvance) return;
    }

    setIsSubmitting(true);
    try {
      await api.createTransaction({
        customerId,
        type: 'PAYMENT',
        amount: Number(amount),
        paymentMode: mode,
        transactionDate: date,
        description: note.trim() || `Payment received (${mode})`,
        allowOverpayment: true,
      });
      onShowToast(`✓ Received payment of ₹${amount} from ${selectedCust?.name || 'Customer'}!`, 'success');
      setAmount('');
      setNote('');
      onSuccess();
      onClose();
    } catch (err: any) {
      onShowToast(err.message || 'Failed to record payment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink-brown/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border-2 border-ink-brown rounded-3xl max-w-md w-full p-6 shadow-bahi-lg space-y-4 animate-in fade-in zoom-in duration-150">
        <div className="flex justify-between items-center border-b-2 border-notebook-line pb-3">
          <h3 className="font-extrabold text-lg text-ink-brown">Record Payment</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-cream border border-ink-brown flex items-center justify-center font-bold hover:bg-ink-brown hover:text-white"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold uppercase text-ink-muted mb-1">Customer</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
              className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-sm font-bold text-ink-brown focus:outline-none"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (Balance: {formatINR(c.balancePaise)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold uppercase text-ink-muted">
                Payment Amount (₹)
              </label>
              {selectedCust && (
                <span className="text-xs font-bold text-ink-muted">
                  Due: <strong className="text-tomato-red">{formatINR(selectedCust.balancePaise)}</strong>
                </span>
              )}
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="e.g. 500"
              required
              min="1"
              step="any"
              className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-sm font-extrabold text-leaf-green focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-ink-muted mb-1">Mode</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as PaymentMode)}
                className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-xs font-bold text-ink-brown"
              >
                <option value="CASH">💵 Cash</option>
                <option value="UPI">📱 UPI / PhonePe</option>
                <option value="BANK_TRANSFER">🏦 Bank Transfer</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-ink-muted mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-xs font-bold text-ink-brown"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-ink-muted mb-1">Note (Optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Monthly settlement"
              className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-xs font-medium text-ink-brown"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 py-2.5 bg-leaf-green text-cream font-extrabold text-sm border-2 border-ink-brown rounded-xl shadow-bahi-sm hover:bg-leaf-dark active:translate-y-0.5 ${
                isSubmitting ? 'opacity-50 cursor-wait' : ''
              }`}
            >
              {isSubmitting ? 'Saving...' : 'Confirm Payment'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-cream border-2 border-ink-brown text-ink-brown font-bold text-sm rounded-xl hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ========================================================================= */
/* 3. ADD CUSTOMER MODAL                                                     */
/* ========================================================================= */
interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onShowToast,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [openingBalance, setOpeningBalance] = useState<number | ''>(0);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onShowToast('Please provide a customer name', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createCustomer({
        name: name.trim(),
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
        openingBalancePaise: openingBalance ? Math.round(Number(openingBalance) * 100) : 0,
      });

      onShowToast(`Created customer ledger for ${name}!`, 'success');
      setName('');
      setPhone('');
      setOpeningBalance(0);
      setNotes('');
      onSuccess();
      onClose();
    } catch (err: any) {
      onShowToast(err.message || 'Failed to create customer', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink-brown/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border-2 border-ink-brown rounded-3xl max-w-md w-full p-6 shadow-bahi-lg space-y-4 animate-in fade-in zoom-in duration-150">
        <div className="flex justify-between items-center border-b-2 border-notebook-line pb-3">
          <h3 className="font-extrabold text-lg text-ink-brown">Add New Customer</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-cream border border-ink-brown flex items-center justify-center font-bold hover:bg-ink-brown hover:text-white"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold uppercase text-ink-muted mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Vikas Sharma"
              required
              className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-sm font-bold text-ink-brown focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-ink-muted mb-1">
              Mobile Number (Optional)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98000 00000"
              className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-sm font-bold text-ink-brown focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-ink-muted mb-1">
              Opening Credit Balance (₹)
            </label>
            <input
              type="number"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value === '' ? '' : Number(e.target.value))}
              min="0"
              step="any"
              className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-sm font-bold text-ink-brown focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-ink-muted mb-1">Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Shopkeeper neighbor, settles monthly"
              className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-xs text-ink-brown"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 py-2.5 bg-leaf-green text-cream font-extrabold text-sm border-2 border-ink-brown rounded-xl shadow-bahi-sm hover:bg-leaf-dark active:translate-y-0.5 ${
                isSubmitting ? 'opacity-50 cursor-wait' : ''
              }`}
            >
              {isSubmitting ? 'Creating...' : 'Create Customer Ledger'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-cream border-2 border-ink-brown text-ink-brown font-bold text-sm rounded-xl hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ========================================================================= */
/* 4. EDIT CUSTOMER MODAL                                                    */
/* ========================================================================= */
interface EditCustomerModalProps {
  customer: Customer | null;
  onClose: () => void;
  onSuccess: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const EditCustomerModal: React.FC<EditCustomerModalProps> = ({
  customer,
  onClose,
  onSuccess,
  onShowToast,
}) => {
  const [name, setName] = useState(customer?.name || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [notes, setNotes] = useState(customer?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (customer) {
      setName(customer.name);
      setPhone(customer.phone || '');
      setNotes(customer.notes || '');
    }
  }, [customer]);

  if (!customer) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.updateCustomer(customer.id, {
        name: name.trim(),
        phone: phone.trim() || null,
        notes: notes.trim() || null,
      });
      onShowToast('Customer details updated!', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      onShowToast(err.message || 'Failed to update customer', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink-brown/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border-2 border-ink-brown rounded-3xl max-w-md w-full p-6 shadow-bahi-lg space-y-4 animate-in fade-in zoom-in duration-150">
        <div className="flex justify-between items-center border-b-2 border-notebook-line pb-3">
          <h3 className="font-extrabold text-lg text-ink-brown">Edit Customer Details</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-cream border border-ink-brown flex items-center justify-center font-bold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold uppercase text-ink-muted mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-sm font-bold text-ink-brown"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-ink-muted mb-1">Mobile Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-sm font-bold text-ink-brown"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-ink-muted mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-xs text-ink-brown"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-leaf-green text-cream font-extrabold text-sm border-2 border-ink-brown rounded-xl shadow-bahi-sm hover:bg-leaf-dark"
            >
              {isSubmitting ? 'Saving...' : 'Update Customer'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-cream border-2 border-ink-brown text-ink-brown font-bold text-sm rounded-xl"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ========================================================================= */
/* 5. REVERSE TRANSACTION MODAL                                              */
/* ========================================================================= */
interface ReverseTxnModalProps {
  txnId: string | null;
  txnDesc: string;
  amountPaise: number;
  onClose: () => void;
  onSuccess: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ReverseTxnModal: React.FC<ReverseTxnModalProps> = ({
  txnId,
  txnDesc,
  amountPaise,
  onClose,
  onSuccess,
  onShowToast,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!txnId) return null;

  const handleReverse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 3) {
      onShowToast('Please provide a reason of at least 3 characters', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.reverseTransaction(txnId, { reason: reason.trim() });
      onShowToast('✓ Financial transaction reversed successfully.', 'success');
      setReason('');
      onSuccess();
      onClose();
    } catch (err: any) {
      onShowToast(err.message || 'Failed to reverse transaction', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink-brown/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border-2 border-ink-brown rounded-3xl max-w-md w-full p-6 shadow-bahi-lg space-y-4 animate-in fade-in zoom-in duration-150">
        <div className="flex justify-between items-center border-b-2 border-notebook-line pb-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-tomato-red/10 border border-ink-brown flex items-center justify-center text-tomato-red font-bold">
              <i className="fa-solid fa-rotate-left"></i>
            </span>
            <h3 className="font-extrabold text-lg text-ink-brown">Reverse Financial Entry</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-cream border border-ink-brown flex items-center justify-center font-bold"
          >
            ✕
          </button>
        </div>

        <div className="bg-cream p-3 rounded-xl border border-ink-brown text-xs text-ink-brown space-y-1">
          <span className="font-extrabold block">Entry details:</span>
          <div>Amount: <strong className="text-tomato-red">{formatINR(amountPaise)}</strong></div>
          <div>Description: {txnDesc}</div>
          <div className="text-[11px] text-ink-muted mt-1 italic">
            Note: Posted ledger entries are reversed rather than silently deleted, creating a verifiable audit trail.
          </div>
        </div>

        <form onSubmit={handleReverse} className="space-y-3">
          <div>
            <label className="block text-xs font-bold uppercase text-ink-muted mb-1">
              Reason for Reversal <span className="text-tomato-red">*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Mistakenly entered, duplicate entry, customer returned item"
              required
              minLength={3}
              className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-xs font-bold text-ink-brown focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 py-2.5 bg-tomato-red text-white font-extrabold text-sm border-2 border-ink-brown rounded-xl shadow-bahi-sm hover:bg-red-600 active:translate-y-0.5 ${
                isSubmitting ? 'opacity-50 cursor-wait' : ''
              }`}
            >
              {isSubmitting ? 'Reversing...' : 'Confirm Reversal'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-cream border-2 border-ink-brown text-ink-brown font-bold text-sm rounded-xl hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
