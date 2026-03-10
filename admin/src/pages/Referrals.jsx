import React, { useEffect, useState } from 'react';
import api from '../lib/api';

const Referrals = () => {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const params = filter ? { status: filter } : {};
    setLoading(true);
    api.get('/referrals', { params }).then(r => setReferrals(r.data.referrals)).catch(console.error).finally(() => setLoading(false));
  }, [filter]);

  const total = referrals.length;
  const completed = referrals.filter(r => r.status === 'completed').length;
  const pending = referrals.filter(r => r.status === 'pending').length;
  const totalRewards = referrals.filter(r => r.status === 'completed').reduce((s, r) => s + (r.rewardAmount || 0), 0);

  const statCards = [
    { label: 'Total Referrals', value: total, color: 'text-blue-600' },
    { label: 'Completed', value: completed, color: 'text-green-600' },
    { label: 'Pending', value: pending, color: 'text-yellow-600' },
    { label: 'Rewards Given', value: totalRewards, color: 'text-orange-600' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">Referrals</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((c) => (
          <div key={c.label} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-xs text-slate-500 mb-1">{c.label}</p>
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {['', 'pending', 'completed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
              filter === f ? 'bg-orange-500 text-white' : 'text-slate-500 bg-slate-100 dark:bg-slate-800'
            }`}
          >
            {f || 'All'}
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
                <th className="px-4 py-3 font-medium">Referrer</th>
                <th className="px-4 py-3 font-medium">Referred User</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Reward</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{r.referrerUserId?.slice(0, 12)}...</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{r.referredUserId?.slice(0, 12)}...</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.referralCode}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">{r.rewardAmount}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {referrals.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">No referrals</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Referrals;
