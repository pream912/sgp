import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { sendOtp, verifyOtp, getCurrentUser } from '../lib/auth';
import AnimatedBackdrop from '../components/build/AnimatedBackdrop';

const Login = () => {
  const [stage, setStage] = useState('email'); // 'email' | 'otp' | 'name'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeData, setWelcomeData] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref');

  useEffect(() => {
    if (getCurrentUser()) navigate('/', { replace: true });
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
      setError(err.response?.data?.error || 'Failed to send code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await verifyOtp({ email, code: otp });
      if (data.isNew) {
        // New user — collect name then welcome
        setStage('name');
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (!name.trim()) {
      setError('Name is required.');
      setLoading(false);
      return;
    }
    try {
      await axios.put('/api/profile', { name: name.trim() });

      if (refCode) {
        try {
          await axios.post('/api/referral/apply', { code: refCode });
        } catch (e) {
          console.warn('Referral apply failed:', e.message);
        }
      }

      setWelcomeData({
        name: name.trim(),
        giftCredits: 200,
        hasReferral: !!refCode,
        referralBonusAmount: refCode ? 50 : 0,
        referrerReward: 100,
      });
      setShowWelcome(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-row overflow-hidden group/design-root font-display bg-background-light dark:bg-background-dark text-brand-dark dark:text-white">
      <div className="flex w-full flex-col justify-center overflow-y-auto px-4 py-8 sm:px-6 lg:w-1/2 lg:px-20 xl:px-24 bg-white dark:bg-[#121121] transition-colors duration-300">
        <div className="mx-auto w-full max-w-sm lg:w-[420px]">
          <div className="flex items-center justify-center gap-3">
            <img src="/logo_new.png" alt="GenWeb Logo" className="h-55" />
          </div>

          <div className="mb-8 flex flex-col gap-3 text-center">
            <h1 className="text-brand-dark dark:text-white tracking-tight text-[32px] font-bold leading-tight">
              {stage === 'name' ? 'Complete your profile' : 'Sign in to your account'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-base font-normal leading-normal">
              {stage === 'name'
                ? 'Tell us a bit about yourself to get started.'
                : 'Welcome back to the future of web building.'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium border border-red-100 dark:border-red-800">
              {error}
            </div>
          )}

          <div className="space-y-6">
            {stage === 'email' && (
              <form onSubmit={handleSendOtp}>
                <div>
                  <label className="text-brand-dark dark:text-white text-base font-medium leading-normal pb-2 block">Email address</label>
                  <input
                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-brand-dark dark:text-white focus:outline-0 focus:ring-0 border border-gray-200 dark:border-gray-700 bg-white dark:bg-white/5 focus:border-primary h-14 placeholder:text-gray-400 p-[15px] text-base font-normal leading-normal"
                    placeholder="you@example.com"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value.trim())}
                  />
                </div>

                <button
                  disabled={loading || !email}
                  className="mt-6 flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-5 bg-primary hover:bg-primary-hover transition-colors text-white text-base font-bold leading-normal tracking-[0.015em] shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="truncate">{loading ? 'Sending...' : 'Send code'}</span>
                </button>
              </form>
            )}

            {stage === 'otp' && (
              <form onSubmit={handleVerifyOtp}>
                <div className="pt-2">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-brand-dark dark:text-white text-sm font-medium leading-normal">Enter the 6-digit code sent to {email}</label>
                    <button type="button" onClick={() => { setStage('email'); setOtp(''); }} className="text-primary text-sm font-semibold hover:text-orange-600">Change email</button>
                  </div>
                  <input
                    className="h-14 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-white/5 text-center text-2xl font-bold text-brand-dark dark:text-white focus:border-primary focus:ring-1 focus:ring-primary focus:bg-white dark:focus:bg-white/10 transition-all outline-none tracking-[0.5em]"
                    type="text"
                    inputMode="numeric"
                    placeholder="XXXXXX"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </div>

                <button
                  disabled={loading || otp.length < 6}
                  className="mt-6 flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-5 bg-primary hover:bg-primary-hover transition-colors text-white text-base font-bold leading-normal tracking-[0.015em] shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="truncate">{loading ? 'Verifying...' : 'Verify & sign in'}</span>
                </button>
              </form>
            )}

            {stage === 'name' && (
              <form onSubmit={handleSaveName} className="space-y-4">
                <div>
                  <label className="text-brand-dark dark:text-white text-base font-medium leading-normal pb-2 block">Full Name</label>
                  <input
                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-brand-dark dark:text-white focus:outline-0 focus:ring-0 border border-gray-200 dark:border-gray-700 bg-white dark:bg-white/5 focus:border-primary h-14 placeholder:text-gray-400 px-[15px] text-base font-normal leading-normal"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <button
                  disabled={loading}
                  className="mt-6 flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-5 bg-primary hover:bg-primary-hover transition-colors text-white text-base font-bold leading-normal tracking-[0.015em] shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="truncate">{loading ? 'Saving...' : 'Complete registration'}</span>
                </button>
              </form>
            )}

            <p className="mt-8 text-center text-xs text-gray-500 dark:text-gray-500">
              By proceeding, you agree to our <a className="font-medium text-brand-dark dark:text-white hover:text-primary transition-colors underline decoration-gray-300 underline-offset-2" href="#">Terms of Service</a> and <a className="font-medium text-brand-dark dark:text-white hover:text-primary transition-colors underline decoration-gray-300 underline-offset-2" href="#">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </div>

      <div className="relative hidden w-0 flex-1 lg:block bg-[#0B0F1A] overflow-hidden">
        <AnimatedBackdrop />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F1A]/95 via-transparent to-transparent"></div>
        <div className="absolute bottom-0 left-0 right-0 p-16 z-10">
          <div className="max-w-lg">
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md px-3 py-1 text-sm font-medium text-white mb-6">
              <span className="mr-2 h-2 w-2 rounded-full bg-green-400"></span>
              Genni is online
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl mb-4">Your website, built over a chat.</h2>
            <p className="text-lg text-gray-200">Tell Genni about your business — in Tamil, Telugu, Malayalam, Hindi, or English — and watch your website come to life. Your first home page is free.</p>
          </div>
        </div>
      </div>

      {showWelcome && welcomeData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-white dark:bg-[#1a1924] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden animate-in fade-in zoom-in">
            <div className="h-1.5 bg-gradient-to-r from-orange-400 via-orange-500 to-amber-500"></div>
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <span className="material-symbols-outlined text-3xl text-orange-500">celebration</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Welcome to GenWeb, {welcomeData.name || 'there'}!</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6">
                Your account has been set up and you are all set to start building.
              </p>
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10 border border-orange-200 dark:border-orange-800/50 rounded-xl p-5 mb-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-orange-500 text-[20px]">redeem</span>
                  <span className="text-sm font-semibold text-orange-700 dark:text-orange-300">Welcome Bonus</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                  {welcomeData.giftCredits} <span className="text-base font-medium text-gray-500 dark:text-gray-400">credits</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">These credits have been added to your account to help you get started.</p>
              </div>
              {welcomeData.hasReferral && (
                <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/50 rounded-xl p-4 mb-4">
                  <div className="flex items-start gap-3 text-left">
                    <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-[20px] mt-0.5 shrink-0">card_giftcard</span>
                    <div>
                      <p className="text-sm font-semibold text-green-800 dark:text-green-300 mb-1">Referral Bonus Applied</p>
                      <p className="text-xs text-green-700 dark:text-green-400 leading-relaxed">
                        You have received <strong>{welcomeData.referralBonusAmount} credits</strong> as a signup bonus. Your referrer will earn <strong>{welcomeData.referrerReward} more credits</strong> when you make your first purchase.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <button onClick={() => navigate('/builder', { state: { welcome: true } })} className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-orange-500/20">Create my website</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
