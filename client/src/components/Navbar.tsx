import React from 'react';

export type ScreenTab = 'landing' | 'dashboard' | 'voice' | 'ledger' | 'payments' | 'reports' | 'gemma' | 'forecast';

interface NavbarProps {
  currentTab: ScreenTab;
  onSelectTab: (tab: ScreenTab) => void;
  businessName?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab, businessName = 'Sharma General Store' }) => {
  return (
    <header className="sticky top-0 z-40 bg-cream/90 backdrop-blur-md border-b-2 border-ink-brown px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <button
          onClick={() => onSelectTab('landing')}
          className="flex items-center gap-3 text-left group focus:outline-none"
        >
          <div className="w-10 h-10 rounded-xl bg-leaf-green border-2 border-ink-brown flex items-center justify-center text-cream shadow-bahi-sm group-hover:-translate-y-0.5 transition-transform">
            <i className="fa-solid fa-book-bookmark text-lg"></i>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl tracking-tight leading-none text-ink-brown">TalkLedger</span>
              <span className="text-xs bg-haldi-yellow border border-ink-brown text-ink-brown font-bold px-1.5 py-0.5 rounded-md shadow-sm">AI</span>
            </div>
            <span className="text-[10px] font-medium text-ink-muted hidden sm:block">Speak naturally. Track every balance.</span>
          </div>
        </button>

        {/* Main Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1 bg-white/80 p-1.5 rounded-xl border-2 border-ink-brown shadow-bahi-sm">
          <button
            onClick={() => onSelectTab('landing')}
            className={`nav-btn px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              currentTab === 'landing' ? 'bg-leaf-green text-cream' : 'text-ink-brown hover:bg-cream'
            }`}
          >
            <i className="fa-solid fa-house mr-1 text-xs"></i>Home
          </button>
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`nav-btn px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              currentTab === 'dashboard' ? 'bg-leaf-green text-cream' : 'text-ink-brown hover:bg-cream'
            }`}
          >
            <i className="fa-solid fa-chart-pie mr-1 text-xs"></i>Dashboard
          </button>
          <button
            onClick={() => onSelectTab('gemma')}
            className={`nav-btn px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1 ${
              currentTab === 'gemma' ? 'bg-leaf-green text-cream' : 'bg-haldi-yellow/30 text-ink-brown hover:bg-haldi-yellow'
            }`}
          >
            <i className="fa-solid fa-sparkles text-tomato-red"></i>
            <span>Gemma AI</span>
          </button>
          <button
            onClick={() => onSelectTab('voice')}
            className={`nav-btn px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              currentTab === 'voice' ? 'bg-leaf-green text-cream' : 'text-ink-brown hover:bg-cream'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-tomato-red animate-ping"></span>
            <i className="fa-solid fa-microphone text-xs"></i>Voice
          </button>
          <button
            onClick={() => onSelectTab('ledger')}
            className={`nav-btn px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              currentTab === 'ledger' ? 'bg-leaf-green text-cream' : 'text-ink-brown hover:bg-cream'
            }`}
          >
            <i className="fa-solid fa-address-book mr-1 text-xs"></i>Ledger
          </button>
          <button
            onClick={() => onSelectTab('payments')}
            className={`nav-btn px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              currentTab === 'payments' ? 'bg-leaf-green text-cream' : 'text-ink-brown hover:bg-cream'
            }`}
          >
            <i className="fa-solid fa-money-bill-transfer mr-1 text-xs"></i>Payments
          </button>
          <button
            onClick={() => onSelectTab('forecast')}
            className={`nav-btn px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              currentTab === 'forecast' ? 'bg-leaf-green text-cream' : 'text-ink-brown hover:bg-cream'
            }`}
          >
            <i className="fa-solid fa-chart-line mr-1 text-xs"></i>Forecast
          </button>
          <button
            onClick={() => onSelectTab('reports')}
            className={`nav-btn px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              currentTab === 'reports' ? 'bg-leaf-green text-cream' : 'text-ink-brown hover:bg-cream'
            }`}
          >
            <i className="fa-solid fa-file-invoice mr-1 text-xs"></i>Reports
          </button>
        </nav>

        {/* Action CTA Buttons */}
        <div className="flex items-center gap-2">
          {businessName && (
            <span className="hidden lg:inline-block text-xs font-semibold text-ink-muted bg-cream-soft border border-ink-brown/20 px-2.5 py-1 rounded-lg">
              <i className="fa-solid fa-store mr-1 text-leaf-green"></i>
              {businessName}
            </span>
          )}
          <button
            onClick={() => onSelectTab('gemma')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-leaf-green text-cream border-2 border-ink-brown rounded-xl font-bold text-xs shadow-bahi hover:bg-leaf-dark transition-all"
          >
            <i className="fa-solid fa-wand-magic-sparkles text-haldi-yellow"></i>
            <span>Ask Gemma</span>
          </button>

          <button
            onClick={() => onSelectTab('voice')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-haldi-yellow text-ink-brown border-2 border-ink-brown rounded-xl font-bold text-xs shadow-bahi hover:bg-yellow-400 transition-all"
          >
            <i className="fa-solid fa-microphone text-tomato-red"></i>
            <span>Speak</span>
          </button>
        </div>
      </div>
    </header>
  );
};
