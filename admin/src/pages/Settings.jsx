import React, { useEffect, useState } from 'react';
import api from '../lib/api';

const Settings = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/config').then(r => setConfig(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/config', config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Failed to save config');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  if (loading) return <div className="text-center py-20 text-slate-500">Loading...</div>;
  if (!config) return <div className="text-center py-20 text-slate-500">Failed to load config</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">Platform Settings</h2>

      <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Signup Gift Credits</label>
          <input
            type="number"
            value={config.signupGiftCredits || 0}
            onChange={(e) => updateField('signupGiftCredits', parseInt(e.target.value) || 0)}
            className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:border-orange-500"
          />
          <p className="text-xs text-slate-500 mt-1">Credits given to new users on signup</p>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Referral Program</h3>

          <div className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              checked={config.referralEnabled || false}
              onChange={(e) => updateField('referralEnabled', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
            />
            <label className="text-sm text-slate-700 dark:text-slate-300">Enable Referral Program</label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Referrer Reward</label>
              <input
                type="number"
                value={config.referralRewardAmount || 0}
                onChange={(e) => updateField('referralRewardAmount', parseInt(e.target.value) || 0)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:border-orange-500"
              />
              <p className="text-xs text-slate-500 mt-1">Credits for the referrer after referred user's first purchase</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Referred Bonus</label>
              <input
                type="number"
                value={config.referralBonusAmount || 0}
                onChange={(e) => updateField('referralBonusAmount', parseInt(e.target.value) || 0)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:border-orange-500"
              />
              <p className="text-xs text-slate-500 mt-1">Bonus credits for the referred user on signup</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="submit"
            disabled={saving}
            className="h-10 px-6 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
        </div>
      </form>
    </div>
  );
};

export default Settings;
