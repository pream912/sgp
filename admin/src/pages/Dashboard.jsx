import React, { useEffect, useState } from 'react';
import api from '../lib/api';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/stats').then(r => setStats(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const fmt = (n) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return (n || 0).toString();
  };

  const cards = [
    { label: 'Total Users', value: fmt(stats?.totalUsers), icon: 'group', color: 'blue' },
    { label: 'Total Sites', value: fmt(stats?.totalSites), icon: 'web', color: 'purple' },
    { label: 'Published', value: fmt(stats?.publishedSites), icon: 'rocket_launch', color: 'green' },
    { label: 'Revenue', value: '₹' + fmt(stats?.totalRevenue), icon: 'payments', color: 'orange' },
    { label: 'Total Tokens', value: fmt(stats?.totalTokens), icon: 'token', color: 'cyan' },
    { label: 'Avg Tokens/Site', value: fmt(stats?.avgTokensPerSite), icon: 'analytics', color: 'indigo' },
    { label: 'Failure Rate', value: (stats?.failureRate || 0) + '%', icon: 'error', color: 'red' },
  ];

  const colorMap = {
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400',
    purple: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400',
    cyan: 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    indigo: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    red: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
  };

  if (loading) return <div className="text-center py-20 text-slate-500">Loading dashboard...</div>;

  return (
    <div className="max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">Dashboard</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${colorMap[card.color]}`}>
              <span className="material-symbols-outlined text-[18px]">{card.icon}</span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{card.value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
