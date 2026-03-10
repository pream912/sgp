import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { auth } from '../firebase';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState('');
  const [referralCopied, setReferralCopied] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      if (!auth.currentUser) return;
      try {
        const token = await auth.currentUser.getIdToken();
        const { data } = await axios.get('/api/dashboard/stats', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStats(data);
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const generateReferralCode = async () => {
    try {
      const token = await auth.currentUser.getIdToken();
      const { data } = await axios.post('/api/referral/generate', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReferralCode(data.code);
    } catch (err) {
      console.error('Failed to generate referral code:', err);
    }
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}/login?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    setReferralCopied(true);
    setTimeout(() => setReferralCopied(false), 2000);
  };

  const formatNumber = (n) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return (n || 0).toString();
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
  };

  const statCards = [
    { label: 'Total Sites', value: formatNumber(stats?.totalSites), icon: 'web', color: 'blue' },
    { label: 'Published', value: formatNumber(stats?.publishedSites), icon: 'rocket_launch', color: 'green' },
    { label: 'Total Leads', value: formatNumber(stats?.totalLeads), icon: 'contacts', color: 'purple' },
    { label: 'Visitors', value: formatNumber(stats?.totalPageviews), icon: 'visibility', color: 'orange' },
  ];

  const colorMap = {
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400',
    purple: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400',
  };

  const recentPageviews = stats?.recentPageviews || [];
  const maxPageviews = Math.max(...recentPageviews.map(d => d.pageviews), 1);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Dashboard</h2>
          <p className="text-slate-500 dark:text-slate-400">Overview of your sites and traffic.</p>
        </div>
        <Link
          to="/builder"
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-orange-500/20 hover:shadow-orange-500/30"
        >
          <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
          New Project
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-500">Loading dashboard...</div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-10">
            {statCards.map((card) => (
              <div key={card.label} className="bg-white dark:bg-[#1e1c2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[card.color]}`}>
                  <span className="material-symbols-outlined text-[20px]">{card.icon}</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{card.value}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{card.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Traffic Chart + Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 7-day pageview chart */}
            <div className="lg:col-span-2 bg-white dark:bg-[#1e1c2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Visitors (Last 7 Days)</h3>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {formatNumber(recentPageviews.reduce((s, d) => s + d.pageviews, 0))} total
                </span>
              </div>
              {recentPageviews.length === 0 ? (
                <div className="text-center py-12 text-slate-400">No traffic data yet. Publish a site to start tracking.</div>
              ) : (
                <div className="flex items-end gap-2 h-48">
                  {recentPageviews.map((day) => {
                    const height = Math.max((day.pageviews / maxPageviews) * 100, 4);
                    const dateLabel = new Date(day.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' });
                    return (
                      <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{day.pageviews}</span>
                        <div
                          className="w-full bg-orange-500 rounded-t-lg transition-all duration-300 min-h-[4px]"
                          style={{ height: `${height}%` }}
                        />
                        <span className="text-xs text-slate-400">{dateLabel}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Actions + Bandwidth */}
            <div className="flex flex-col gap-6">
              <div className="bg-white dark:bg-[#1e1c2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Quick Actions</h3>
                <div className="flex flex-col gap-3">
                  <Link
                    to="/builder"
                    className="flex items-center gap-3 px-4 py-3 bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20 rounded-xl transition-colors group"
                  >
                    <span className="material-symbols-outlined text-orange-500 text-[20px]">add_circle</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Create New Site</span>
                  </Link>
                  <Link
                    to="/sites"
                    className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors group"
                  >
                    <span className="material-symbols-outlined text-slate-500 text-[20px]">grid_view</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">View All Sites</span>
                  </Link>
                  <Link
                    to="/leads"
                    className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors group"
                  >
                    <span className="material-symbols-outlined text-slate-500 text-[20px]">inbox</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">View Leads</span>
                  </Link>
                </div>
              </div>

              <div className="bg-white dark:bg-[#1e1c2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">Bandwidth</h3>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatBytes(stats?.totalBandwidth)}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Total data served</p>
              </div>

              {/* Referral Card */}
              <div className="bg-white dark:bg-[#1e1c2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">Refer & Earn</h3>
                  <Link to="/referral" className="text-xs text-orange-500 hover:text-orange-600 font-medium">View all referrals &rarr;</Link>
                </div>
                {referralCode ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm font-mono text-slate-700 dark:text-slate-300">{referralCode}</code>
                      <button
                        onClick={copyReferralLink}
                        className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        {referralCopied ? 'Copied!' : 'Copy Link'}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Share your link and earn credits when friends sign up and make their first purchase.</p>
                  </div>
                ) : (
                  <button
                    onClick={generateReferralCode}
                    className="w-full px-4 py-2.5 bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20 text-orange-600 text-sm font-medium rounded-xl transition-colors"
                  >
                    Get Referral Code
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
