import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendOtp, verifyOtp, getCurrentUser, clearToken } from '../lib/auth';

const Login = () => {
  const [stage, setStage] = useState('email'); // 'email' | 'otp'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const u = getCurrentUser();
    if (u && u.isAdmin) navigate('/', { replace: true });
  }, [navigate]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }
    try {
      await sendOtp(email);
      setStage('otp');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send code.');
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await verifyOtp({ email, code: otp });
      if (!data.user || !data.user.isAdmin) {
        clearToken();
        setError('Access denied. Admin privileges required.');
        return;
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark font-display">
      <div className="w-full max-w-sm p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="size-10 flex items-center justify-center bg-orange-500 text-white rounded-xl">
            <span className="material-symbols-outlined">admin_panel_settings</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Admin Panel</h1>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm border border-red-100 dark:border-red-800">
            {error}
          </div>
        )}

        {stage === 'email' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.trim())}
                placeholder="admin@example.com"
                autoComplete="email"
                className="w-full h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send code'}
            </button>
          </form>
        )}

        {stage === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">6-digit code sent to {email}</label>
                <button type="button" onClick={() => { setStage('email'); setOtp(''); }} className="text-orange-500 text-xs font-semibold hover:text-orange-600">
                  Change email
                </button>
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="XXXXXX"
                maxLength={6}
                className="w-full h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center text-xl font-bold text-slate-900 dark:text-white tracking-[0.4em] focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Verify & sign in'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          Only users with admin privileges can access this panel.
        </p>
      </div>
    </div>
  );
};

export default Login;
