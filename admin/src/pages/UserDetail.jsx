import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';

const UserDetail = () => {
  const { uid } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('sites');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditDesc, setCreditDesc] = useState('');
  const [addingCredits, setAddingCredits] = useState(false);

  useEffect(() => {
    api.get(`/users/${uid}`).then(r => setUser(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [uid]);

  const handleAddCredits = async (e) => {
    e.preventDefault();
    if (!creditAmount) return;
    setAddingCredits(true);
    try {
      await api.post(`/users/${uid}/credits`, { amount: parseInt(creditAmount), description: creditDesc });
      const { data } = await api.get(`/users/${uid}`);
      setUser(data);
      setCreditAmount('');
      setCreditDesc('');
    } catch (err) {
      alert('Failed to add credits');
    } finally {
      setAddingCredits(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-slate-500">Loading...</div>;
  if (!user) return <div className="text-center py-20 text-slate-500">User not found</div>;

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={() => navigate('/users')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-orange-500 mb-4 transition-colors">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span> Back to Users
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* User Info */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{user.displayName || 'User'}</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-slate-500">UID:</span><p className="font-mono text-xs mt-1 text-slate-700 dark:text-slate-300">{user.uid}</p></div>
            <div><span className="text-slate-500">Email:</span><p className="mt-1 text-slate-700 dark:text-slate-300">{user.email || '—'}</p></div>
            <div><span className="text-slate-500">Phone:</span><p className="mt-1 text-slate-700 dark:text-slate-300">{user.phoneNumber || '—'}</p></div>
            <div><span className="text-slate-500">Credits:</span><p className="mt-1 font-bold text-orange-500 text-lg">{user.credits}</p></div>
            <div><span className="text-slate-500">Referral Code:</span><p className="mt-1 font-mono text-slate-700 dark:text-slate-300">{user.referralCode || '—'}</p></div>
            <div><span className="text-slate-500">Joined:</span><p className="mt-1 text-slate-700 dark:text-slate-300">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</p></div>
          </div>
        </div>

        {/* Add Credits */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Add Credits</h3>
          <form onSubmit={handleAddCredits} className="space-y-3">
            <input
              type="number"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              placeholder="Amount"
              className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:border-orange-500"
              min="1"
              required
            />
            <input
              type="text"
              value={creditDesc}
              onChange={(e) => setCreditDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:border-orange-500"
            />
            <button
              type="submit"
              disabled={addingCredits}
              className="w-full h-9 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {addingCredits ? 'Adding...' : 'Add Credits'}
            </button>
          </form>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {['sites', 'transactions', 'domains'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${
              tab === t ? 'bg-orange-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {t} ({t === 'sites' ? user.projects?.length : t === 'transactions' ? user.transactions?.length : user.domains?.length || 0})
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {tab === 'sites' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                <th className="px-4 py-3 font-medium">Project ID</th>
                <th className="px-4 py-3 font-medium">Query</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Published</th>
              </tr>
            </thead>
            <tbody>
              {(user.projects || []).map((p) => (
                <tr key={p.projectId} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{p.projectId}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">{p.query || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' :
                      p.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' :
                      'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{p.isPublished ? 'Yes' : 'No'}</td>
                </tr>
              ))}
              {(!user.projects || user.projects.length === 0) && (
                <tr><td colSpan={4} className="text-center py-6 text-slate-500">No sites</td></tr>
              )}
            </tbody>
          </table>
        )}

        {tab === 'transactions' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {(user.transactions || []).map((t) => (
                <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 text-xs text-slate-500">{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.type === 'credit' ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'}`}>
                      {t.type}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${t.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>{t.amount >= 0 ? '+' : ''}{t.amount}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs max-w-[250px] truncate">{t.description}</td>
                </tr>
              ))}
              {(!user.transactions || user.transactions.length === 0) && (
                <tr><td colSpan={4} className="text-center py-6 text-slate-500">No transactions</td></tr>
              )}
            </tbody>
          </table>
        )}

        {tab === 'domains' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                <th className="px-4 py-3 font-medium">Domain</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(user.domains || []).map((d) => (
                <tr key={d.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{d.domain}</td>
                  <td className="px-4 py-3 text-slate-500">{d.provider || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{d.status || '—'}</td>
                </tr>
              ))}
              {(!user.domains || user.domains.length === 0) && (
                <tr><td colSpan={3} className="text-center py-6 text-slate-500">No domains</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default UserDetail;
