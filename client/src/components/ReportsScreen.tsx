import React, { useState } from 'react';
import { Customer, Transaction, formatINR } from '../shared/types';
import { api } from '../services/api';

interface ReportsScreenProps {
  customers: Customer[];
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ReportsScreen: React.FC<ReportsScreenProps> = ({
  customers,
  onShowToast,
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('all');
  const [selectedType, setSelectedType] = useState<'all' | 'CREDIT' | 'PAYMENT'>('all');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hasQueried, setHasQueried] = useState(false);
  const [loading, setLoading] = useState(false);

  const runReport = async (silent: boolean = false) => {
    setLoading(true);
    setHasQueried(true);
    try {
      const res = await api.getTransactions({
        customerId: selectedCustomerId !== 'all' ? selectedCustomerId : undefined,
        type: selectedType !== 'all' ? selectedType : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        includeReversed: true,
      });
      setTransactions(res.transactions);
      if (!silent) {
        onShowToast(`Report generated with ${res.transactions.length} records.`, 'info');
      }
    } catch (err: any) {
      if (!silent) {
        onShowToast(err.message || 'Failed to generate report', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    runReport(true);
  }, []);

  const exportCSV = () => {
    if (transactions.length === 0) {
      onShowToast('No transaction records to export. Run a report first.', 'error');
      return;
    }

    const headers = ['Date', 'Customer', 'Type', 'Amount (INR)', 'Payment Mode', 'Description', 'Due Date', 'Status'];
    const rows = transactions.map((t) => [
      new Date(t.transactionDate).toISOString().split('T')[0],
      `"${t.customer?.name || 'Customer'}"`,
      t.type,
      (t.amountPaise / 100).toFixed(2),
      t.paymentMode || '',
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : '',
      t.reversedAt ? 'REVERSED' : 'ACTIVE',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `talkledger_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast('✓ CSV file downloaded successfully!', 'success');
  };

  const totalCreditPaise = transactions
    .filter((t) => t.type === 'CREDIT' && !t.reversedAt)
    .reduce((acc, t) => acc + t.amountPaise, 0);

  const totalPaymentPaise = transactions
    .filter((t) => t.type === 'PAYMENT' && !t.reversedAt)
    .reduce((acc, t) => acc + t.amountPaise, 0);

  return (
    <section className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-ink-brown">Ledger Reports & Statements</h1>
          <p className="text-sm text-ink-muted">
            Filter transactions by date range, inspect audit records, and export CSV ledger sheets.
          </p>
        </div>
        <button
          onClick={exportCSV}
          disabled={transactions.length === 0}
          className={`px-4 py-2 bg-leaf-green text-cream text-sm font-bold border-2 border-ink-brown rounded-xl shadow-bahi-sm hover:bg-leaf-dark flex items-center gap-1.5 transition-all ${
            transactions.length === 0 ? 'opacity-40 cursor-not-allowed' : ''
          }`}
        >
          <i className="fa-solid fa-file-csv text-base"></i> Export to CSV
        </button>
      </div>

      {/* Filter Parameters Card */}
      <div className="bg-white p-5 rounded-2xl border-2 border-ink-brown shadow-bahi space-y-4">
        <h3 className="font-extrabold text-sm text-ink-brown uppercase tracking-wider">Report Parameters</h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase text-ink-muted mb-1">Customer</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-xs font-bold text-ink-brown"
            >
              <option value="all">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-ink-muted mb-1">Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-xs font-bold text-ink-brown"
            >
              <option value="all">All (Credit & Payments)</option>
              <option value="CREDIT">Credit Only</option>
              <option value="PAYMENT">Payments Only</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-ink-muted mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-xs font-bold text-ink-brown"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-ink-muted mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-xs font-bold text-ink-brown"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={() => runReport()}
            disabled={loading}
            className="px-5 py-2.5 bg-leaf-green text-cream font-extrabold text-sm border-2 border-ink-brown rounded-xl shadow-bahi-sm hover:bg-leaf-dark active:translate-y-0.5"
          >
            {loading ? 'Generating...' : '🔍 Generate Report'}
          </button>
        </div>
      </div>

      {/* Report Summary Metrics */}
      {hasQueried && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border-2 border-ink-brown shadow-bahi-sm">
            <span className="text-xs font-bold text-ink-muted uppercase">Period Total Credit</span>
            <span className="text-2xl font-extrabold text-tomato-red block mt-1">
              {formatINR(totalCreditPaise)}
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border-2 border-ink-brown shadow-bahi-sm">
            <span className="text-xs font-bold text-ink-muted uppercase">Period Total Collected</span>
            <span className="text-2xl font-extrabold text-leaf-green block mt-1">
              {formatINR(totalPaymentPaise)}
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border-2 border-ink-brown shadow-bahi-sm">
            <span className="text-xs font-bold text-ink-muted uppercase">Transactions Found</span>
            <span className="text-2xl font-extrabold text-ink-brown block mt-1">
              {transactions.length}
            </span>
          </div>
        </div>
      )}

      {/* Report Results Table */}
      {hasQueried && (
        <div className="bg-white rounded-2xl border-2 border-ink-brown shadow-bahi-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-cream border-b-2 border-ink-brown text-xs font-extrabold text-ink-muted uppercase">
                  <th className="p-3.5 pl-6">Date</th>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Mode</th>
                  <th className="p-3.5">Description</th>
                  <th className="p-3.5 text-right pr-6">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-notebook-line text-sm font-medium">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-ink-muted">
                      No matching records found for the selected parameters.
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => {
                    const isCredit = t.type === 'CREDIT';
                    const isReversed = !!t.reversedAt;

                    return (
                      <tr
                        key={t.id}
                        className={`transition-colors ${
                          isReversed ? 'bg-red-50/50 opacity-60 line-through' : 'hover:bg-cream/40'
                        }`}
                      >
                        <td className="p-3.5 pl-6 text-xs text-ink-muted font-bold">
                          {new Date(t.transactionDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="p-3.5 font-bold text-ink-brown">{t.customer?.name || 'Customer'}</td>
                        <td className="p-3.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border border-ink-brown ${
                              isCredit ? 'bg-tomato-red/10 text-tomato-red' : 'bg-mint-green text-leaf-dark'
                            }`}
                          >
                            {isCredit ? 'Credit' : 'Paid'}
                          </span>
                          {isReversed && (
                            <span className="ml-1 text-[9px] bg-tomato-red text-white px-1 py-0.5 rounded">
                              Reversed
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-xs text-ink-muted font-medium">{t.paymentMode || '—'}</td>
                        <td className="p-3.5 text-xs text-ink-brown">{t.description || '—'}</td>
                        <td
                          className={`p-3.5 text-right pr-6 font-extrabold ${
                            isCredit ? 'text-tomato-red' : 'text-leaf-green'
                          }`}
                        >
                          {isCredit ? '+' : '-'} {formatINR(t.amountPaise)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
