import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { auth } from '../firebase';

const Referral = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [referralCode, setReferralCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchStats = async () => {
    try {
      const token = await auth.currentUser.getIdToken();
      const { data } = await axios.get('/api/referral/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(data);
      if (data.referralCode) setReferralCode(data.referralCode);
    } catch (err) {
      console.error('Failed to fetch referral stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const generateCode = async () => {
    setGenerating(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const { data } = await axios.post('/api/referral/generate', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReferralCode(data.code);
      await fetchStats();
    } catch (err) {
      console.error('Failed to generate referral code:', err);
    } finally {
      setGenerating(false);
    }
  };

  const referralLink = `${window.location.origin}/login?ref=${referralCode}`;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const text = `Join GenWeb and get bonus credits! Sign up with my referral link: ${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const statCards = [
    { label: 'Friends Invited', value: stats?.totalReferred || 0, icon: 'group_add', color: 'blue' },
    { label: 'Completed', value: stats?.totalCompleted || 0, icon: 'check_circle', color: 'green' },
    { label: 'Credits Earned', value: stats?.totalCreditsEarned || 0, icon: 'monetization_on', color: 'orange' },
  ];

  const colorMap = {
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400',
    orange: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400',
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="text-center py-20 text-slate-500">Loading referral data...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-col gap-2 mb-10">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Refer & Earn</h2>
        <p className="text-slate-500 dark:text-slate-400">Invite friends and earn credits when they join.</p>
      </div>

      {/* Referral Code Card */}
      <div className="bg-white dark:bg-[#1e1c2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 mb-6">
        {referralCode ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Your Referral Code</p>
              <div className="flex items-center gap-3 flex-wrap">
                <code className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-lg font-mono font-bold text-slate-900 dark:text-white tracking-wider">{referralCode}</code>
                <button
                  onClick={copyLink}
                  className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">{copied ? 'check' : 'content_copy'}</span>
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
                <button
                  onClick={shareWhatsApp}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">share</span>
                  WhatsApp
                </button>
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Share your link: <span className="font-mono text-xs bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">{referralLink}</span>
            </p>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-slate-500 dark:text-slate-400 mb-4">Generate your unique referral code to start earning credits.</p>
            <button
              onClick={generateCode}
              disabled={generating}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate Referral Code'}
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white dark:bg-[#1e1c2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[card.color]}`}>
              <span className="material-symbols-outlined text-[22px]">{card.icon}</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{card.value}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* How It Works */}
      <div className="bg-white dark:bg-[#1e1c2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 mb-6">
        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">How It Works</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { step: '1', title: 'Share Your Link', desc: 'Send your referral link to friends via WhatsApp, email, or social media.' },
            { step: '2', title: 'Friend Signs Up', desc: `Your friend gets ${stats?.program?.signupBonus || 50} bonus credits when they join using your link.` },
            { step: '3', title: 'You Earn Credits', desc: `You earn ${stats?.program?.referrerReward || 100} credits when they make their first purchase.` },
          ].map((item) => (
            <div key={item.step} className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-lg mb-3">{item.step}</div>
              <h4 className="font-semibold text-slate-900 dark:text-white mb-1">{item.title}</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Referrals Table */}
      {stats?.referrals?.length > 0 && (
        <div className="bg-white dark:bg-[#1e1c2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Your Referrals</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">#</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Signed Up</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Payment</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Credits</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Date</th>
                </tr>
              </thead>
              <tbody>
                {stats.referrals.map((ref, i) => (
                  <tr key={ref.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{i + 1}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-orange-600 text-xs font-bold shrink-0">
                          {ref.referredUserName?.[0]?.toUpperCase() || '?'}
                        </div>
                        <span className="font-medium text-slate-900 dark:text-white">{ref.referredUserName || 'User'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400">
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        Yes
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        ref.hasPaid
                          ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                          : 'bg-slate-50 dark:bg-slate-500/10 text-slate-500 dark:text-slate-400'
                      }`}>
                        <span className="material-symbols-outlined text-[14px]">{ref.hasPaid ? 'paid' : 'schedule'}</span>
                        {ref.hasPaid ? 'Paid' : 'Not yet'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-medium ${ref.status === 'completed' ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'}`}>
                        {ref.status === 'completed' ? `+${ref.rewardAmount}` : '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {ref.createdAt ? new Date(ref.createdAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Referral;
