import { useState, useEffect, useCallback } from 'react';
import { Customer, DashboardSummary } from './shared/types';
import { api } from './services/api';
import { Navbar, ScreenTab } from './components/Navbar';
import { Toast, ToastState } from './components/Toast';
import { LandingScreen } from './components/LandingScreen';
import { DashboardScreen } from './components/DashboardScreen';
import { VoiceScreen } from './components/VoiceScreen';
import { LedgerScreen } from './components/LedgerScreen';
import { PaymentsScreen } from './components/PaymentsScreen';
import { ReportsScreen } from './components/ReportsScreen';
import {
  AddCreditModal,
  RecordPaymentModal,
  AddCustomerModal,
  EditCustomerModal,
  ReverseTxnModal,
} from './components/Modals';

export function App() {
  const [currentTab, setCurrentTab] = useState<ScreenTab>('landing');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomerIdForLedger, setSelectedCustomerIdForLedger] = useState<string>('');

  // Modals state
  const [isAddCreditOpen, setIsAddCreditOpen] = useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomerForModal, setSelectedCustomerForModal] = useState<Customer | null>(null);
  const [reverseModalState, setReverseModalState] = useState<{
    id: string | null;
    desc: string;
    amountPaise: number;
  }>({ id: null, desc: '', amountPaise: 0 });

  // Toast notification state
  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: '',
    type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3500);
  };

  const loadData = useCallback(async () => {
    try {
      const [dashRes, custRes] = await Promise.all([
        api.getDashboard(),
        api.getCustomers(),
      ]);
      setSummary(dashRes);
      setCustomers(custRes.customers);
      if (!selectedCustomerIdForLedger && custRes.customers.length > 0) {
        setSelectedCustomerIdForLedger(custRes.customers[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load ledger data:', err);
      showToast(err.message || 'Error connecting to backend API', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedCustomerIdForLedger]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectCustomerForLedger = (custName: string) => {
    const cust = customers.find((c) => c.name.toLowerCase() === custName.toLowerCase());
    if (cust) {
      setSelectedCustomerIdForLedger(cust.id);
    }
    setCurrentTab('ledger');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col font-sans antialiased text-ink-brown selection:bg-haldi-yellow">
      {/* Top Header */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        businessName="Sharma General Store"
      />

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 lg:p-8">
        {currentTab === 'landing' && (
          <LandingScreen
            onNavigate={(tab) => {
              setCurrentTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onShowToast={showToast}
          />
        )}

        {currentTab === 'dashboard' && (
          <DashboardScreen
            summary={summary}
            loading={loading}
            onNavigate={(tab) => {
              setCurrentTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenAddCredit={() => {
              setSelectedCustomerForModal(null);
              setIsAddCreditOpen(true);
            }}
            onOpenRecordPayment={() => {
              setSelectedCustomerForModal(null);
              setIsRecordPaymentOpen(true);
            }}
            onOpenAddCustomer={() => setIsAddCustomerOpen(true)}
            onOpenReverseModal={(id, desc, amountPaise) => {
              setReverseModalState({ id, desc, amountPaise });
            }}
            onSelectCustomerForLedger={handleSelectCustomerForLedger}
          />
        )}

        {currentTab === 'voice' && (
          <VoiceScreen
            customers={customers}
            onTransactionSaved={() => {
              loadData();
              setCurrentTab('dashboard');
            }}
            onShowToast={showToast}
          />
        )}

        {currentTab === 'ledger' && (
          <LedgerScreen
            customers={customers}
            selectedCustomerId={selectedCustomerIdForLedger}
            onOpenAddCreditForCust={(cust) => {
              setSelectedCustomerForModal(cust);
              setIsAddCreditOpen(true);
            }}
            onOpenPaymentForCust={(cust) => {
              setSelectedCustomerForModal(cust);
              setIsRecordPaymentOpen(true);
            }}
            onOpenReverseModal={(id, desc, amountPaise) => {
              setReverseModalState({ id, desc, amountPaise });
            }}
            onShowToast={showToast}
          />
        )}

        {currentTab === 'payments' && (
          <PaymentsScreen
            customers={customers}
            onOpenAddCustomer={() => setIsAddCustomerOpen(true)}
            onOpenEditCustomer={(cust) => setEditingCustomer(cust)}
            onSelectCustomerForLedger={handleSelectCustomerForLedger}
            onPaymentSaved={loadData}
            onShowToast={showToast}
          />
        )}

        {currentTab === 'reports' && (
          <ReportsScreen
            customers={customers}
            onShowToast={showToast}
          />
        )}
      </main>

      {/* Global Modals */}
      <AddCreditModal
        isOpen={isAddCreditOpen}
        onClose={() => setIsAddCreditOpen(false)}
        customers={customers}
        defaultCustomer={selectedCustomerForModal}
        onSuccess={loadData}
        onShowToast={showToast}
      />

      <RecordPaymentModal
        isOpen={isRecordPaymentOpen}
        onClose={() => setIsRecordPaymentOpen(false)}
        customers={customers}
        defaultCustomer={selectedCustomerForModal}
        onSuccess={loadData}
        onShowToast={showToast}
      />

      <AddCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        onSuccess={loadData}
        onShowToast={showToast}
      />

      <EditCustomerModal
        customer={editingCustomer}
        onClose={() => setEditingCustomer(null)}
        onSuccess={loadData}
        onShowToast={showToast}
      />

      <ReverseTxnModal
        txnId={reverseModalState.id}
        txnDesc={reverseModalState.desc}
        amountPaise={reverseModalState.amountPaise}
        onClose={() => setReverseModalState({ id: null, desc: '', amountPaise: 0 })}
        onSuccess={loadData}
        onShowToast={showToast}
      />

      {/* Global Toast */}
      <Toast toast={toast} />
    </div>
  );
}
export default App;
