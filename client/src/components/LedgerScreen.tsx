import React, { useState, useEffect } from 'react';
import { Customer, Transaction, formatINR } from '../shared/types';
import { api } from '../services/api';

interface LedgerScreenProps {
  customers: Customer[];
  selectedCustomerId?: string;
  onOpenAddCreditForCust: (customer: Customer) => void;
  onOpenPaymentForCust: (customer: Customer) => void;
  onOpenReverseModal: (txnId: string, desc: string, amountPaise: number) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const LedgerScreen: React.FC<LedgerScreenProps> = ({
  customers,
  selectedCustomerId,
  onOpenAddCreditForCust,
  onOpenPaymentForCust,
  onOpenReverseModal,
  onShowToast,
}) => {
  const [activeCustId, setActiveCustId] = useState<string>(
    selectedCustomerId || customers[0]?.id || ''
  );
  const [customerDetail, setCustomerDetail] = useState<(Customer & { transactions: Transaction[] }) | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedCustomerId) {
      setActiveCustId(selectedCustomerId);
    } else if (!activeCustId && customers.length > 0) {
      setActiveCustId(customers[0].id);
    }
  }, [selectedCustomerId, customers]);

  useEffect(() => {
    if (activeCustId) {
      fetchCustomerLedger(activeCustId);
    }
  }, [activeCustId]);

  const fetchCustomerLedger = async (id: string) => {
    setLoading(true);
    try {
      const res = await api.getCustomer(id);
      setCustomerDetail(res.customer);
    } catch (err: any) {
      onShowToast(err.message || 'Failed to load customer ledger', 'error');
    } finally {
      setLoading(false);
    }
  };

  const currentCustomer = customers.find((c) => c.id === activeCustId) || customerDetail;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const copyReminderMessage = () => {
    if (!currentCustomer) return;
    const balFormatted = formatINR(currentCustomer.balancePaise);
    const message = `Namaste ${currentCustomer.name}, your current outstanding balance at Sharma General Store is ${balFormatted}. Please make the payment at your earliest convenience via Cash or UPI (sharmastore@upi). Thank you for your continued support!`;

    navigator.clipboard
      .writeText(message)
      .then(() => {
        onShowToast('📲 Reminder message copied to clipboard!', 'success');
      })
      .catch(() => {
        // Fallback textarea
        const temp = document.createElement('textarea');
        temp.value = message;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        onShowToast('📲 Reminder message copied to clipboard!', 'success');
      });
  };

  const openWhatsAppReminder = () => {
    if (!currentCustomer) return;
    const balFormatted = formatINR(currentCustomer.balancePaise);
    const phone = currentCustomer.phone?.replace(/[^\d+]/g, '') || '';
    const message = encodeURIComponent(
      `Namaste ${currentCustomer.name}, your current outstanding balance at Sharma General Store is ${balFormatted}. Please make the payment when convenient. Thank you!`
    );
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  return (
    <section className="space-y-6 animate-in fade-in duration-150">
      {/* Customer Selector Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border-2 border-ink-brown shadow-bahi">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-xs font-bold text-ink-muted uppercase whitespace-nowrap">
            Select Customer:
          </span>
          <select
            value={activeCustId}
            onChange={(e) => setActiveCustId(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-sm font-bold text-ink-brown focus:outline-none"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.phone || 'No phone'}) — Bal: {formatINR(c.balancePaise)}
              </option>
            ))}
          </select>
        </div>

        {currentCustomer && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenAddCreditForCust(currentCustomer)}
              className="px-3.5 py-2 bg-tomato-red text-white text-xs font-bold border-2 border-ink-brown rounded-xl shadow-bahi-sm hover:bg-red-600 active:translate-y-0.5"
            >
              + Add Credit
            </button>
            <button
              onClick={() => onOpenPaymentForCust(currentCustomer)}
              className="px-3.5 py-2 bg-leaf-green text-cream text-xs font-bold border-2 border-ink-brown rounded-xl shadow-bahi-sm hover:bg-leaf-dark active:translate-y-0.5"
            >
              ✓ Record Payment
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-leaf-green border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : !currentCustomer ? (
        <div className="bg-white p-8 rounded-2xl border-2 border-ink-brown text-center space-y-2">
          <p className="font-bold text-ink-muted">No customers found. Please add a customer first.</p>
        </div>
      ) : (
        <>
          {/* Customer Header Card */}
          <div className="bg-white p-6 rounded-2xl border-2 border-ink-brown shadow-bahi relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex items-center gap-4">
                {/* Avatar Initials */}
                <div className="w-16 h-16 bg-haldi-yellow text-ink-brown font-extrabold text-2xl border-2 border-ink-brown rounded-2xl flex items-center justify-center shadow-bahi-sm">
                  {getInitials(currentCustomer.name)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-extrabold text-ink-brown">{currentCustomer.name}</h2>
                    <span className="bg-mint-green text-leaf-dark text-xs font-bold px-2 py-0.5 rounded border border-ink-brown">
                      {currentCustomer.balancePaise > 0 ? 'Active Credit Account' : 'Account Settled'}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-ink-muted mt-0.5">
                    <i className="fa-solid fa-phone mr-1"></i> {currentCustomer.phone || 'No phone recorded'}
                  </p>
                  {currentCustomer.notes && (
                    <p className="text-xs text-ink-muted mt-1 italic font-medium">"{currentCustomer.notes}"</p>
                  )}
                </div>
              </div>

              {/* Reminder WhatsApp Action Box */}
              <div className="bg-cream p-3.5 rounded-xl border-2 border-ink-brown flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                <div className="text-left">
                  <span className="text-[11px] font-bold text-ink-muted uppercase block">Payment Reminder</span>
                  <span className="text-xs font-bold text-ink-brown">Polite notice with UPI info</span>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={copyReminderMessage}
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-leaf-green text-cream font-bold text-xs rounded-lg border border-ink-brown shadow-bahi-sm hover:bg-leaf-dark flex items-center justify-center gap-1.5"
                  >
                    <i className="fa-regular fa-copy"></i>
                    <span>Copy Text</span>
                  </button>
                  {currentCustomer.phone && (
                    <button
                      onClick={openWhatsAppReminder}
                      className="px-3.5 py-2 bg-[#25D366] text-white font-bold text-xs rounded-lg border border-ink-brown shadow-bahi-sm hover:bg-green-600 flex items-center justify-center gap-1.5"
                      title="Open in WhatsApp"
                    >
                      <i className="fa-brands fa-whatsapp text-sm"></i>
                      <span>WhatsApp</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Financial Metrics Bar for this Customer */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t-2 border-notebook-line">
              <div>
                <span className="text-[11px] font-bold text-ink-muted uppercase">Current Balance</span>
                <span
                  className={`text-2xl font-extrabold block ${
                    currentCustomer.balancePaise > 0 ? 'text-tomato-red' : 'text-leaf-green'
                  }`}
                >
                  {formatINR(currentCustomer.balancePaise)}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-ink-muted uppercase">Total Credit Given</span>
                <span className="text-xl font-bold text-ink-brown block">
                  {formatINR(currentCustomer.totalCreditPaise)}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-ink-muted uppercase">Total Received</span>
                <span className="text-xl font-bold text-leaf-green block">
                  {formatINR(currentCustomer.totalPaymentPaise)}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-ink-muted uppercase">Last Activity</span>
                <span className="text-sm font-bold text-ink-brown block mt-1">
                  {currentCustomer.lastActivityDate
                    ? new Date(currentCustomer.lastActivityDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'No transactions yet'}
                </span>
              </div>
            </div>
          </div>

          {/* Ledger-inspired transaction table */}
          <div className="bg-white rounded-2xl border-2 border-ink-brown shadow-bahi-lg overflow-hidden relative">
            {/* Red Notebook Margin Line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 border-r-2 border-margin-red hidden sm:block"></div>

            <div className="p-4 bg-cream border-b-2 border-ink-brown flex justify-between items-center">
              <span className="font-extrabold text-sm text-ink-brown flex items-center gap-2">
                <i className="fa-solid fa-book-open text-leaf-green"></i> Ledger Entry History
              </span>
              <span className="font-handwriting text-2xl text-leaf-green font-bold">Bahi-Khata Ledger</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b-2 border-ink-brown text-xs font-extrabold text-ink-muted uppercase">
                    <th className="p-3.5 pl-6 sm:pl-12">Date</th>
                    <th className="p-3.5">Details / Description</th>
                    <th className="p-3.5 text-right text-tomato-red">Credit Added (+)</th>
                    <th className="p-3.5 text-right text-leaf-green">Payment Received (−)</th>
                    <th className="p-3.5 text-right pr-6">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-notebook-line text-sm font-medium">
                  {!customerDetail?.transactions || customerDetail.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-ink-muted">
                        No transactions found for this customer yet.
                      </td>
                    </tr>
                  ) : (
                    customerDetail.transactions.map((t) => {
                      const isCredit = t.type === 'CREDIT';
                      const isReversed = !!t.reversedAt;

                      return (
                        <tr
                          key={t.id}
                          className={`transition-colors ${
                            isReversed ? 'bg-red-50/50 opacity-60 line-through' : 'hover:bg-cream/50'
                          }`}
                        >
                          <td className="p-3.5 pl-6 sm:pl-12 font-bold text-xs text-ink-muted">
                            {new Date(t.transactionDate).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="p-3.5 font-semibold text-ink-brown">
                            {t.description || (isCredit ? 'Credit' : 'Payment')}
                            {isReversed && (
                              <span className="ml-2 text-[10px] bg-tomato-red text-white px-1.5 py-0.5 rounded font-bold no-underline inline-block">
                                Reversed: {t.reversalReason}
                              </span>
                            )}
                            {t.dueDate && (
                              <span className="block text-[11px] text-ink-muted no-underline">
                                Due: {new Date(t.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right font-extrabold text-tomato-red">
                            {isCredit ? formatINR(t.amountPaise) : '—'}
                          </td>
                          <td className="p-3.5 text-right font-extrabold text-leaf-green">
                            {!isCredit ? formatINR(t.amountPaise) : '—'}
                          </td>
                          <td className="p-3.5 text-right pr-6">
                            {!isReversed && (
                              <button
                                onClick={() =>
                                  onOpenReverseModal(
                                    t.id,
                                    t.description || (isCredit ? 'Credit' : 'Payment'),
                                    t.amountPaise
                                  )
                                }
                                className="px-2 py-1 bg-white hover:bg-tomato-red hover:text-white border border-ink-brown rounded text-xs font-bold text-ink-muted transition-colors"
                                title="Reverse financial transaction"
                              >
                                Reverse
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
