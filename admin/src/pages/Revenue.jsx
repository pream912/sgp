import React, { useEffect, useState } from 'react';
import api from '../lib/api';

const Revenue = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const params = filter !== 'all' ? { type: filter, limit: 100 } : { limit: 100 };
    api.get('/transactions', { params }).then(r => setTransactions(r.data.transactions)).catch(console.error).finally(() => setLoading(false));
  }, [filter]);

  const credits = transactions.filter(t => t.type === 'credit');
  const debits = transactions.filter(t => t.type === 'debit');
  const totalPurchased = credits.reduce((s, t) => s + (t.amount || 0), 0);
  const totalSpent = Math.abs(debits.reduce((s, t) => s + (t.amount || 0), 0));

  // Extract revenue from purchase descriptions
  let totalRevenue = 0;
  credits.forEach(t => {
    if (t.description && t.description.includes('₹')) {
      const match = t.description.match(/₹(\d+)/);
      if (match) totalRevenue += parseInt(match[1]);
    }
  });

  const summaryCards = [
    { label: 'Total Revenue', value: '₹' + totalRevenue.toLocaleString(), color: 'green' },
    { label: 'Credits Purchased', value: totalPurchased.toLocaleString(), color: 'blue' },
    { label: 'Credits Spent', value: totalSpent.toLocaleString(), color: 'orange' },
    { label: 'Net Circulation', value: (totalPurchased - totalSpent).toLocaleString(), color: 'purple' },
  ];

  const colorMap = {
    green: 'bg-green-50 dark:bg-green-500/10 text-green-600',
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600',
    orange: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600',
    purple: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600',
  };

  return (
    <div className="max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">Revenue</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {summaryCards.map((c) => (
          <div key={c.label} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-xs text-slate-500 mb-1">{c.label}</p>
            <p className={`text-xl font-bold ${colorMap[c.color]?.split(' ').pop()}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {['all', 'credit', 'debit'].map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setLoading(true); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
              filter === f ? 'bg-orange-500 text-white' : 'text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 text-xs text-slate-500">{t.createdAt ? new Date(t.createdAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{t.userId?.slice(0, 10)}...</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.type === 'credit' ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'}`}>
                      {t.type}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${t.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>{t.amount >= 0 ? '+' : ''}{t.amount}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-[300px] truncate">{t.description}</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">No transactions</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Revenue;
