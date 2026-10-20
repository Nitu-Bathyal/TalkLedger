import React, { useState } from 'react';
import { DashboardSummary, formatINR } from '../shared/types';
import { ScreenTab } from './Navbar';

interface DashboardScreenProps {
  summary: DashboardSummary | null;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onNavigate: (tab: ScreenTab) => void;
  onOpenAddCredit: () => void;
  onOpenRecordPayment: () => void;
  onOpenAddCustomer: () => void;
  onOpenReverseModal: (txnId: string, desc: string, amountPaise: number) => void;
  onSelectCustomerForLedger: (customerName: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  summary,
  loading,
  error,
  onRetry,
  onNavigate,
  onOpenAddCredit,
  onOpenRecordPayment,
  onOpenAddCustomer,
  onOpenReverseModal,
  onSelectCustomerForLedger,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'CREDIT' | 'PAYMENT'>('all');

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-12 h-12 border-4 border-leaf-green border-t-transparent rounded-full animate-spin"></div>
        <p className="font-bold text-ink-muted">Loading your store ledger...</p>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="bg-white p-8 rounded-2xl border-2 border-tomato-red/30 shadow-bahi max-w-xl mx-auto my-12 text-center space-y-4">
        <div className="w-16 h-16 bg-tomato-red/10 text-tomato-red rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
          <i className="fa-solid fa-triangle-exclamation"></i>
        </div>
        <h2 className="text-xl font-extrabold text-ink-brown">Unable to Load Ledger Data</h2>
        <p className="text-sm text-ink-muted">
          {error || 'The server could not provide ledger records. If deploying on Render, ensure DATABASE_URL is configured in your Render dashboard.'}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-6 py-2.5 bg-leaf-green hover:bg-leaf-green/90 text-white font-bold rounded-xl shadow-bahi transition inline-flex items-center gap-2 text-sm"
          >
            <i className="fa-solid fa-rotate-right"></i>
            Retry Connection
          </button>
        )}
      </div>
    );
  }

  // Filter recent transactions
  const filteredTransactions = summary.recentTransactions.filter((t) => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const name = t.customer?.name?.toLowerCase() || '';
      const desc = t.description?.toLowerCase() || '';
      return name.includes(q) || desc.includes(q);
    }
    return true;
  });

  return (
    <section className="space-y-6 animate-in fade-in duration-150">
      {/* Top Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border-2 border-ink-brown shadow-bahi">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-brown">Welcome back! 👋</h1>
            <span className="font-handwriting text-2xl text-leaf-green font-bold">Daily overview dekh lo</span>
          </div>
          <p className="text-sm text-ink-muted mt-0.5">Sharma General Store • Active Bahi-Khata</p>
        </div>

        {/* Customer Search Bar */}
        <div className="relative max-w-xs w-full">
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted text-sm"></i>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer (e.g. Aarav Sharma)..."
            className="w-full pl-10 pr-4 py-2 bg-cream border-2 border-ink-brown rounded-xl text-sm font-bold text-ink-brown focus:outline-none focus:ring-2 focus:ring-leaf-green"
          />
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Card 1: Total Credit */}
        <div className="bg-white p-5 rounded-2xl border-2 border-ink-brown shadow-bahi relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-ink-muted uppercase tracking-wider block">
                Total Credit (Outstanding)
              </span>
              <span className="text-3xl font-extrabold text-tomato-red mt-1 block">
                {formatINR(summary.totalCreditPaise)}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-tomato-red/10 border-2 border-ink-brown flex items-center justify-center text-tomato-red font-bold">
              <i className="fa-solid fa-hand-holding-dollar"></i>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-notebook-line flex justify-between items-center text-xs">
            <span className="text-ink-muted">To collect from customers</span>
            <span className="font-bold text-tomato-red">{summary.customersWithBalanceCount} Customers</span>
          </div>
        </div>

        {/* Card 2: Payments Received */}
        <div className="bg-white p-5 rounded-2xl border-2 border-ink-brown shadow-bahi relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-ink-muted uppercase tracking-wider block">
                Payments Received (Total)
              </span>
              <span className="text-3xl font-extrabold text-leaf-green mt-1 block">
                {formatINR(summary.totalPaymentsCollectedPaise)}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-mint-green border-2 border-ink-brown flex items-center justify-center text-leaf-green font-bold">
              <i className="fa-solid fa-circle-check"></i>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-notebook-line flex justify-between items-center text-xs">
            <span className="text-ink-muted">Settled via Cash & UPI</span>
            <span className="font-bold text-leaf-green">7-Day: {formatINR(summary.weeklyTotalCollectedPaise)}</span>
          </div>
        </div>

        {/* Card 3: Pending Reminders */}
        <div className="bg-white p-5 rounded-2xl border-2 border-ink-brown shadow-bahi relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-ink-muted uppercase tracking-wider block">
                Pending Due Reminders
              </span>
              <span className="text-3xl font-extrabold text-ink-brown mt-1 block">
                {summary.overdueCustomersCount || summary.customersWithBalanceCount}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-haldi-yellow border-2 border-ink-brown flex items-center justify-center text-ink-brown font-bold">
              <i className="fa-solid fa-clock font-bold"></i>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-notebook-line flex justify-between items-center text-xs">
            <span className="text-ink-muted">Overdue & pending dues</span>
            <button
              onClick={() => onNavigate('ledger')}
              className="font-bold text-leaf-green hover:underline"
            >
              Send Reminders →
            </button>
          </div>
        </div>
      </div>

      {/* Quick Action Bar */}
      <div className="bg-cream-card p-4 rounded-2xl border-2 border-ink-brown shadow-bahi flex flex-wrap gap-3 items-center justify-between">
        <span className="font-bold text-sm text-ink-brown flex items-center gap-2">
          <i className="fa-solid fa-bolt text-haldi-yellow text-base"></i> Quick Actions:
        </span>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={onOpenAddCredit}
            className="px-3.5 py-2 bg-tomato-red text-white text-xs font-extrabold border-2 border-ink-brown rounded-xl shadow-bahi-sm hover:bg-red-600 flex items-center gap-1.5 active:translate-x-0.5 active:translate-y-0.5"
          >
            <i className="fa-solid fa-plus"></i> Add Credit
          </button>
          <button
            onClick={onOpenRecordPayment}
            className="px-3.5 py-2 bg-leaf-green text-cream text-xs font-extrabold border-2 border-ink-brown rounded-xl shadow-bahi-sm hover:bg-leaf-dark flex items-center gap-1.5 active:translate-x-0.5 active:translate-y-0.5"
          >
            <i className="fa-solid fa-check"></i> Record Payment
          </button>
          <button
            onClick={onOpenAddCustomer}
            className="px-3.5 py-2 bg-white text-ink-brown text-xs font-extrabold border-2 border-ink-brown rounded-xl shadow-bahi-sm hover:bg-cream flex items-center gap-1.5 active:translate-x-0.5 active:translate-y-0.5"
          >
            <i className="fa-solid fa-user-plus"></i> Add Customer
          </button>
          <button
            onClick={() => onNavigate('voice')}
            className="px-4 py-2 bg-haldi-yellow text-ink-brown text-xs font-extrabold border-2 border-ink-brown rounded-xl shadow-bahi-sm hover:bg-yellow-400 flex items-center gap-1.5 active:translate-x-0.5 active:translate-y-0.5"
          >
            <i className="fa-solid fa-microphone text-tomato-red"></i> Speak to Add
          </button>
        </div>
      </div>

      {/* Charts & Recent Transactions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Weekly Collections Bar Chart */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border-2 border-ink-brown shadow-bahi flex flex-col justify-between space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-extrabold text-base text-ink-brown">Weekly Collections</h3>
              <span className="text-xs text-ink-muted">Last 7 days recovery trend</span>
            </div>
            <span className="font-handwriting text-xl text-leaf-green font-bold">Good Recovery!</span>
          </div>

          {/* Dynamic HTML/CSS Bar Chart with Real Data */}
          <div className="h-44 flex items-end justify-between gap-2 pt-6 pb-2 px-2 border-b-2 border-notebook-line">
            {summary.weeklyCollections.map((col, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                <span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5 whitespace-nowrap bg-ink-brown text-cream px-1 rounded shadow-sm">
                  {formatINR(col.amountPaise)}
                </span>
                <div
                  className={`w-full border-2 border-ink-brown rounded-t-lg transition-all ${
                    idx === summary.weeklyCollections.length - 1
                      ? 'bg-leaf-green'
                      : idx === summary.weeklyCollections.length - 3
                      ? 'bg-haldi-yellow group-hover:bg-yellow-400'
                      : 'bg-mint-green group-hover:bg-leaf-green'
                  }`}
                  style={{ height: `${col.percentage}%` }}
                ></div>
                <span className="text-[11px] font-bold text-ink-muted">{col.day}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center text-xs font-bold text-ink-muted pt-1">
            <span>
              Total Collected: <strong className="text-leaf-green text-sm">{formatINR(summary.weeklyTotalCollectedPaise)}</strong>
            </span>
            <span className="text-ink-muted">Live 7-Day Total</span>
          </div>
        </div>

        {/* Recent Transactions Table Card */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border-2 border-ink-brown shadow-bahi space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-notebook-line pb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base text-ink-brown">Recent Transactions</h3>
              <span className="bg-cream text-ink-brown text-xs font-bold px-2 py-0.5 rounded border border-ink-brown">
                {filteredTransactions.length} Entries
              </span>
            </div>

            {/* Filter Chips */}
            <div className="flex gap-1.5 text-xs font-bold">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded border border-ink-brown transition-all ${
                  filterType === 'all' ? 'bg-ink-brown text-cream' : 'bg-cream text-ink-brown hover:bg-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('CREDIT')}
                className={`px-2.5 py-1 rounded border border-ink-brown transition-all ${
                  filterType === 'CREDIT' ? 'bg-tomato-red text-white' : 'bg-cream text-ink-brown hover:bg-tomato-red hover:text-white'
                }`}
              >
                Credit
              </button>
              <button
                onClick={() => setFilterType('PAYMENT')}
                className={`px-2.5 py-1 rounded border border-ink-brown transition-all ${
                  filterType === 'PAYMENT' ? 'bg-leaf-green text-cream' : 'bg-cream text-ink-brown hover:bg-leaf-green hover:text-white'
                }`}
              >
                Payments
              </button>
            </div>
          </div>

          {/* Transactions List */}
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-8 text-sm text-ink-muted">
                No transactions found matching your criteria.
              </div>
            ) : (
              filteredTransactions.map((t) => {
                const isCredit = t.type === 'CREDIT';
                const custName = t.customer?.name || 'Customer';

                return (
                  <div
                    key={t.id}
                    className="p-3 bg-cream rounded-xl border-2 border-ink-brown flex items-center justify-between hover:bg-white transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg border border-ink-brown flex items-center justify-center font-bold text-sm ${
                          isCredit ? 'bg-tomato-red/10 text-tomato-red' : 'bg-mint-green text-leaf-green'
                        }`}
                      >
                        <i className={`fa-solid ${isCredit ? 'fa-arrow-up-right' : 'fa-arrow-down-left'}`}></i>
                      </div>
                      <div>
                        <button
                          onClick={() => onSelectCustomerForLedger(custName)}
                          className="font-bold text-sm text-ink-brown hover:text-leaf-green hover:underline text-left block"
                        >
                          {custName}
                        </button>
                        <span className="text-[11px] text-ink-muted block">
                          {t.description || (isCredit ? 'Credit' : 'Payment')} • {new Date(t.transactionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span
                          className={`font-extrabold text-base block ${
                            isCredit ? 'text-tomato-red' : 'text-leaf-green'
                          }`}
                        >
                          {isCredit ? '+' : '-'} {formatINR(t.amountPaise)}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border border-ink-brown ${
                            isCredit ? 'bg-tomato-red/10 text-tomato-red' : 'bg-mint-green text-leaf-dark'
                          }`}
                        >
                          {isCredit ? 'Credit' : 'Paid'}
                        </span>
                      </div>

                      {/* Reversal action button */}
                      <button
                        title="Reverse transaction"
                        onClick={() => onOpenReverseModal(t.id, t.description || (isCredit ? 'Credit' : 'Payment'), t.amountPaise)}
                        className="w-7 h-7 rounded-lg border border-ink-brown bg-white hover:bg-cream text-ink-muted hover:text-tomato-red flex items-center justify-center text-xs transition-colors"
                      >
                        <i className="fa-solid fa-rotate-left"></i>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
