import React, { useEffect, useState } from 'react';
import api from '../lib/api';

const TokenUsage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    api.get('/token-usage', { params: { days } }).then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [days]);

  const fmt = (n) => {
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return (n || 0).toString();
  };

  if (loading) return <div className="text-center py-20 text-slate-500">Loading token usage...</div>;
  if (!data) return <div className="text-center py-20 text-slate-500">No data</div>;

  const cards = [
    { label: 'Input Tokens', value: fmt(data.totalInput), color: 'text-blue-600' },
    { label: 'Output Tokens', value: fmt(data.totalOutput), color: 'text-purple-600' },
    { label: 'Total Tokens', value: fmt(data.totalTokens), color: 'text-orange-600' },
    { label: 'Est. Cost', value: '$' + data.estimatedCost.toFixed(4), color: 'text-green-600' },
    { label: 'API Calls', value: fmt(data.totalCalls), color: 'text-cyan-600' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Token Usage</h2>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                days === d ? 'bg-orange-500 text-white' : 'text-slate-500 bg-slate-100 dark:bg-slate-800'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-xs text-slate-500 mb-1">{c.label}</p>
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Service */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">By Service</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                <th className="pb-2 font-medium">Service</th>
                <th className="pb-2 font-medium text-right">Calls</th>
                <th className="pb-2 font-medium text-right">Input</th>
                <th className="pb-2 font-medium text-right">Output</th>
                <th className="pb-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.byService).map(([svc, d]) => (
                <tr key={svc} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 font-medium capitalize text-slate-700 dark:text-slate-300">{svc}</td>
                  <td className="py-2 text-right text-slate-500">{d.count}</td>
                  <td className="py-2 text-right text-slate-500">{fmt(d.input)}</td>
                  <td className="py-2 text-right text-slate-500">{fmt(d.output)}</td>
                  <td className="py-2 text-right font-medium text-slate-700 dark:text-slate-300">{fmt(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* By Model */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">By Model</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                <th className="pb-2 font-medium">Model</th>
                <th className="pb-2 font-medium text-right">Calls</th>
                <th className="pb-2 font-medium text-right">Input</th>
                <th className="pb-2 font-medium text-right">Output</th>
                <th className="pb-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.byModel).map(([mdl, d]) => (
                <tr key={mdl} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 font-medium text-slate-700 dark:text-slate-300">{mdl}</td>
                  <td className="py-2 text-right text-slate-500">{d.count}</td>
                  <td className="py-2 text-right text-slate-500">{fmt(d.input)}</td>
                  <td className="py-2 text-right text-slate-500">{fmt(d.output)}</td>
                  <td className="py-2 text-right font-medium text-slate-700 dark:text-slate-300">{fmt(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TokenUsage;
