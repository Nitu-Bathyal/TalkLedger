import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export const ForecastScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<any>(null);
  const [forecastData, setForecastData] = useState<any>(null);

  const loadForecast = async () => {
    setLoading(true);
    try {
      const [st, fc] = await Promise.all([
        api.getTabPfnStatus().catch(() => null),
        api.getTabPfnForecast().catch(() => null),
      ]);
      setStatus(st);
      setForecastData(fc);
    } catch (err) {
      console.error('Error loading TabPFN forecast:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForecast();
  }, []);

  return (
    <section className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Top Banner */}
      <div className="bg-white border-2 border-ink-brown rounded-3xl p-6 shadow-bahi-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 bg-haldi-yellow border border-ink-brown px-3 py-1 rounded-full text-xs font-extrabold text-ink-brown shadow-sm">
            <i className="fa-solid fa-chart-line"></i>
            <span>TabPFN-3.5 Foundation Model for Tabular Data</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-brown">Collection & Credit Risk Forecast</h1>
          <p className="text-xs text-ink-muted">
            Predictive machine learning on anonymized customer transaction intervals to forecast repayment timing.
          </p>
        </div>

        <button
          onClick={loadForecast}
          disabled={loading}
          className="px-4 py-2 bg-leaf-green text-cream font-bold text-xs rounded-xl border border-ink-brown shadow-bahi-sm hover:bg-leaf-dark flex items-center gap-1.5 transition-all"
        >
          <i className={`fa-solid fa-rotate ${loading ? 'animate-spin' : ''}`}></i>
          <span>Refresh Forecast</span>
        </button>
      </div>

      {/* Mandatory Prominent Disclaimer Banner */}
      <div className="bg-haldi-yellow/30 border-2 border-ink-brown rounded-2xl p-4 shadow-bahi-sm text-xs font-bold text-ink-brown space-y-1">
        <div className="flex items-center gap-2 text-tomato-red">
          <i className="fa-solid fa-triangle-exclamation text-base"></i>
          <span className="font-extrabold uppercase tracking-wide">Predictive Analytics Notice</span>
        </div>
        <p className="text-ink-muted font-medium text-[11px] leading-relaxed">
          Forecasts are mathematical probabilities calculated from historical repayment intervals and are{' '}
          <strong>NOT guarantees of payment</strong>. Predictions must never be treated as confirmed accounting figures or
          substitute for exact ledger balances. Basic ledger functionality operates 100% independently of predictive models.
        </p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border-2 border-ink-brown rounded-2xl p-5 shadow-bahi-sm space-y-1">
          <span className="text-xs font-bold text-ink-muted uppercase">Expected Collections (30 Days)</span>
          <div className="text-2xl font-extrabold text-leaf-green">
            {forecastData?.summary?.expectedCollectionsNext30DaysFormatted || '₹0'}
          </div>
          <span className="text-[10px] text-ink-muted block">Based on repayment interval probabilities</span>
        </div>

        <div className="bg-white border-2 border-ink-brown rounded-2xl p-5 shadow-bahi-sm space-y-1">
          <span className="text-xs font-bold text-ink-muted uppercase">High-Risk Balances Flagged</span>
          <div className="text-2xl font-extrabold text-tomato-red">
            {forecastData?.summary?.highRiskOutstandingFormatted || '₹0'}
          </div>
          <span className="text-[10px] text-ink-muted block">Overdue or irregular repayment history</span>
        </div>

        <div className="bg-white border-2 border-ink-brown rounded-2xl p-5 shadow-bahi-sm space-y-1">
          <span className="text-xs font-bold text-ink-muted uppercase">Inference Engine</span>
          <div className="text-sm font-extrabold text-ink-brown truncate" title={forecastData?.engine}>
            {forecastData?.isModelGenerated ? 'TabPFN-3.5 Cloud' : 'Statistical-Baseline'}
          </div>
          <span className="text-[10px] text-ink-muted block font-mono truncate">
            {forecastData?.isModelGenerated ? 'Prior Labs Model' : 'Token unconfigured - using baseline'}
          </span>
        </div>
      </div>

      {/* Tabular Forecast Table */}
      <div className="bg-white border-2 border-ink-brown rounded-3xl p-6 shadow-bahi-lg space-y-4 overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b-2 border-notebook-line pb-3">
          <div>
            <h3 className="font-extrabold text-base text-ink-brown">Anonymized Customer Repayment Probabilities</h3>
            <span className="text-[11px] text-ink-muted">
              Data period analyzed: {forecastData?.dataPeriod?.start || 'N/A'} to{' '}
              {forecastData?.dataPeriod?.end || 'N/A'} ({forecastData?.dataPeriod?.totalTransactionsAnalyzed || 0}{' '}
              transactions)
            </span>
          </div>

          <div className="flex gap-2">
            <span className="px-2 py-0.5 bg-mint-green border border-ink-brown rounded text-[10px] font-bold text-leaf-dark">
              Low Risk: &gt;70%
            </span>
            <span className="px-2 py-0.5 bg-haldi-yellow border border-ink-brown rounded text-[10px] font-bold text-ink-brown">
              Med: 40-70%
            </span>
            <span className="px-2 py-0.5 bg-tomato-red/20 border border-ink-brown rounded text-[10px] font-bold text-tomato-red">
              High: &lt;40%
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs font-bold text-ink-muted">
            <i className="fa-solid fa-spinner animate-spin mr-2"></i> Analyzing historical transaction intervals...
          </div>
        ) : forecastData?.forecasts?.length === 0 ? (
          <div className="py-12 text-center text-xs text-ink-muted font-bold">
            No customers currently have outstanding credit. All ledger balances are settled!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-ink-brown text-ink-muted uppercase text-[10px] font-extrabold tracking-wider bg-cream/60">
                  <th className="py-2.5 px-3">Anonymous Token</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3 text-right">Outstanding (₹)</th>
                  <th className="py-2.5 px-3">Repayment Prob.</th>
                  <th className="py-2.5 px-3">Est. Days to Settle</th>
                  <th className="py-2.5 px-3">Risk Level</th>
                  <th className="py-2.5 px-3">Confidence Interval</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-notebook-line font-medium text-ink-brown">
                {forecastData?.forecasts?.map((item: any) => (
                  <tr key={item.anonymousId} className="hover:bg-cream/40 transition-colors">
                    <td className="py-3 px-3 font-mono text-[11px] font-bold text-ink-muted">
                      {item.anonymousId}
                    </td>
                    <td className="py-3 px-3 font-bold text-ink-brown">{item.actualCustomerName}</td>
                    <td className="py-3 px-3 text-right font-extrabold text-tomato-red">
                      {item.outstandingBalanceFormatted}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-cream border border-ink-brown rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              item.riskCategory === 'LOW'
                                ? 'bg-leaf-green'
                                : item.riskCategory === 'MEDIUM'
                                ? 'bg-yellow-500'
                                : 'bg-tomato-red'
                            }`}
                            style={{ width: `${item.repaymentProbabilityPct}%` }}
                          ></div>
                        </div>
                        <span className="font-extrabold text-[11px]">{item.repaymentProbabilityPct}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-bold">
                      ~{item.estimatedCollectionDays} days
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                          item.riskCategory === 'LOW'
                            ? 'bg-mint-green text-leaf-dark border-leaf-green'
                            : item.riskCategory === 'MEDIUM'
                            ? 'bg-haldi-yellow text-ink-brown border-ink-brown'
                            : 'bg-tomato-red/20 text-tomato-red border-tomato-red'
                        }`}
                      >
                        {item.riskCategory}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[11px] text-ink-muted font-mono">
                      {item.confidenceInterval}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TabPFN Architecture & License Investigation Section */}
      <div className="bg-cream border-2 border-ink-brown rounded-3xl p-6 shadow-bahi space-y-3 text-xs text-ink-brown">
        <div className="flex items-center gap-2 font-extrabold text-sm border-b border-ink-brown/20 pb-2">
          <i className="fa-solid fa-microscope text-leaf-green"></i>
          <span>TabPFN-3.5 Investigation & License Architecture Report</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1">
            <span className="font-bold text-ink-muted uppercase text-[10px]">Model & Developer</span>
            <div className="font-extrabold">{status?.model || 'TabPFN-3.5 (Prior Labs)'}</div>
            <p className="text-[11px] text-ink-muted leading-relaxed">
              Prior-data Fitted Networks (PFNs) approximate Bayesian inference for small tabular datasets in a single forward pass without hyperparameter tuning.
            </p>
          </div>

          <div className="space-y-1">
            <span className="font-bold text-ink-muted uppercase text-[10px]">License & Terms</span>
            <div className="font-extrabold text-tomato-red">{status?.license || 'TabPFN-3.5 License v1.0'}</div>
            <p className="text-[11px] text-ink-muted leading-relaxed">
              Model weights are licensed for <strong>non-commercial research and evaluation only</strong>. Production or revenue-generating deployments require an enterprise license directly from Prior Labs.
            </p>
          </div>

          <div className="space-y-1 md:col-span-2 bg-white/70 p-3 rounded-xl border border-ink-brown/30 font-mono text-[11px]">
            <div><strong>Token Status:</strong> {status?.configured ? 'Configured (Active)' : 'Unconfigured (Running on baseline heuristic)'}</div>
            <div><strong>To configure Prior Labs API:</strong> Set <code className="text-tomato-red">TABPFN_TOKEN</code> in your environment variables.</div>
          </div>
        </div>
      </div>
    </section>
  );
};
