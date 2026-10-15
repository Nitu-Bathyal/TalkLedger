import React, { useState } from 'react';
import { Customer, formatINR, PaymentMode } from '../shared/types';
import { api } from '../services/api';

interface PaymentsScreenProps {
  customers: Customer[];
  onOpenAddCustomer: () => void;
  onOpenEditCustomer: (customer: Customer) => void;
  onSelectCustomerForLedger: (customerName: string) => void;
  onPaymentSaved: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const PaymentsScreen: React.FC<PaymentsScreenProps> = ({
  customers,
  onOpenAddCustomer,
  onOpenEditCustomer,
  onSelectCustomerForLedger,
  onPaymentSaved,
  onShowToast,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'settled'>('all');
  const [search, setSearch] = useState('');

  // Payment form state
  const [payCustId, setPayCustId] = useState<string>(customers[0]?.id || '');
  const [payAmount, setPayAmount] = useState<number | ''>('');
  const [payMode, setPayMode] = useState<PaymentMode>('CASH');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payNote, setPayNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedCustomer = customers.find((c) => c.id === payCustId);

  const filteredCustomers = customers.filter((c) => {
    if (filterMode === 'pending' && c.balancePaise <= 0) return false;
    if (filterMode === 'settled' && c.balancePaise > 0) return false;
    if (search.trim() !== '') {
      const q = search.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchPhone = c.phone?.toLowerCase().includes(q) || false;
      return matchName || matchPhone;
    }
    return true;
  });

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payCustId) {
      onShowToast('Please select a customer', 'error');
      return;
    }

    if (!payAmount || payAmount <= 0) {
      onShowToast('Please enter a positive payment amount', 'error');
      return;
    }

    if (selectedCustomer && payAmount * 100 > selectedCustomer.balancePaise) {
      const confirmAdvance = window.confirm(
        `This payment (₹${payAmount}) exceeds the customer's outstanding balance of ${formatINR(
          selectedCustomer.balancePaise
        )}. Record as advance credit?`
      );
      if (!confirmAdvance) return;
    }

    setIsSubmitting(true);
    try {
      await api.createTransaction({
        customerId: payCustId,
        type: 'PAYMENT',
        amount: Number(payAmount),
        paymentMode: payMode,
        transactionDate: payDate,
        description: payNote.trim() || `Payment received (${payMode})`,
        allowOverpayment: true,
      });

      onShowToast(`✓ Received payment of ₹${payAmount} from ${selectedCustomer?.name || 'Customer'}!`, 'success');
      setPayAmount('');
      setPayNote('');
      onPaymentSaved();
    } catch (err: any) {
      onShowToast(err.message || 'Failed to record payment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-ink-brown">Customers & Payments</h1>
          <p className="text-sm text-ink-muted">
            Manage all store accounts, filter balances, and log new cash/UPI payments.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onOpenAddCustomer}
            className="px-4 py-2 bg-white text-ink-brown text-sm font-bold border-2 border-ink-brown rounded-xl shadow-bahi-sm hover:bg-cream active:translate-y-0.5"
          >
            + New Customer
          </button>
        </div>
      </div>

      {/* Directory Grid & Quick Payment Recording Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Customer Directory List (7 cols) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border-2 border-ink-brown shadow-bahi space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b-2 border-notebook-line">
            <h3 className="font-extrabold text-base text-ink-brown">Customer Directory</h3>
            <div className="flex gap-1 text-xs">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 rounded font-bold transition-all ${
                  filterMode === 'all'
                    ? 'bg-ink-brown text-cream'
                    : 'bg-cream border border-ink-brown text-ink-brown hover:bg-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterMode('pending')}
                className={`px-2.5 py-1 rounded font-bold border border-ink-brown transition-all ${
                  filterMode === 'pending'
                    ? 'bg-tomato-red text-white'
                    : 'bg-cream text-tomato-red hover:bg-tomato-red/10'
                }`}
              >
                Has Credit
              </button>
              <button
                onClick={() => setFilterMode('settled')}
                className={`px-2.5 py-1 rounded font-bold border border-ink-brown transition-all ${
                  filterMode === 'settled'
                    ? 'bg-leaf-green text-cream'
                    : 'bg-cream text-leaf-green hover:bg-mint-green'
                }`}
              >
                Settled
              </button>
            </div>
          </div>

          {/* Search Input */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by customer name or phone..."
            className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-xs font-bold text-ink-brown focus:outline-none focus:ring-2 focus:ring-leaf-green"
          />

          {/* Customer Cards Container */}
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-8 text-sm text-ink-muted">
                No customers found matching this filter.
              </div>
            ) : (
              filteredCustomers.map((c) => {
                const hasCredit = c.balancePaise > 0;
                return (
                  <div
                    key={c.id}
                    className="p-3.5 bg-cream rounded-xl border-2 border-ink-brown flex items-center justify-between hover:bg-white transition-colors group"
                  >
                    <div>
                      <button
                        onClick={() => onSelectCustomerForLedger(c.name)}
                        className="font-bold text-sm text-ink-brown group-hover:text-leaf-green hover:underline text-left block"
                      >
                        {c.name}
                      </button>
                      <span className="text-xs text-ink-muted flex items-center gap-2 mt-0.5">
                        <span>{c.phone || 'No phone'}</span>
                        <button
                          onClick={() => onOpenEditCustomer(c)}
                          className="text-[10px] text-ink-muted hover:text-ink-brown underline"
                        >
                          Edit
                        </button>
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span
                          className={`font-extrabold text-sm block ${
                            hasCredit ? 'text-tomato-red' : 'text-leaf-green'
                          }`}
                        >
                          {formatINR(c.balancePaise)}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border border-ink-brown ${
                            hasCredit ? 'bg-tomato-red/10 text-tomato-red' : 'bg-mint-green text-leaf-dark'
                          }`}
                        >
                          {hasCredit ? 'Pending' : 'Settled'}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          setPayCustId(c.id);
                          const el = document.getElementById('pay-amount-input');
                          if (el) el.focus();
                        }}
                        className="px-2 py-1 bg-white hover:bg-leaf-green hover:text-cream text-xs font-bold border border-ink-brown rounded-lg transition-colors"
                        title="Record payment for this customer"
                      >
                        Pay
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Record Payment Form Box (5 cols) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border-2 border-ink-brown shadow-bahi space-y-5 h-fit">
          <div className="flex items-center justify-between border-b-2 border-notebook-line pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-mint-green border border-ink-brown flex items-center justify-center text-leaf-green font-bold">
                <i className="fa-solid fa-receipt"></i>
              </div>
              <h3 className="font-extrabold text-base text-ink-brown">Record New Payment</h3>
            </div>
            <span className="text-xs font-handwriting text-xl text-leaf-green font-bold">
              Quick Settlement
            </span>
          </div>

          <form onSubmit={handleSubmitPayment} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-ink-muted mb-1">
                Select Customer
              </label>
              <select
                value={payCustId}
                onChange={(e) => setPayCustId(e.target.value)}
                required
                className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-sm font-bold text-ink-brown focus:outline-none focus:ring-2 focus:ring-leaf-green"
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
                {selectedCustomer && (
                  <span className="text-xs font-bold text-ink-muted">
                    Balance: <strong className="text-tomato-red">{formatINR(selectedCustomer.balancePaise)}</strong>
                  </span>
                )}
              </div>
              <input
                type="number"
                id="pay-amount-input"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 500"
                min="1"
                step="any"
                required
                className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-sm font-extrabold text-leaf-green focus:outline-none focus:ring-2 focus:ring-leaf-green"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-ink-muted mb-1">Payment Mode</label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value as PaymentMode)}
                  className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-xs font-bold text-ink-brown"
                >
                  <option value="CASH">💵 Cash</option>
                  <option value="UPI">📱 UPI / PhonePe</option>
                  <option value="BANK_TRANSFER">🏦 Bank Transfer</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-ink-muted mb-1">Date</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-xs font-bold text-ink-brown"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-ink-muted mb-1">Optional Note</label>
              <input
                type="text"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="e.g. Partial settlement for ration"
                className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-xs text-ink-brown"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3 bg-leaf-green text-cream font-extrabold text-sm border-2 border-ink-brown rounded-xl shadow-bahi-sm hover:bg-leaf-dark active:translate-y-0.5 transition-all ${
                isSubmitting ? 'opacity-50 cursor-wait' : ''
              }`}
            >
              {isSubmitting ? 'Recording...' : '✓ Confirm Payment & Save'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};
