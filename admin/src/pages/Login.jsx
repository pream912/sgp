import React, { useState, useEffect } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    };
  }, []);

  const setupRecaptcha = () => {
    // 1. Clear existing verifier instance
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (e) {
        console.warn("Failed to clear existing recaptcha", e);
      }
      window.recaptchaVerifier = null;
    }

    // 2. Clear the DOM container manually to remove iframe artifacts
    const container = document.getElementById('recaptcha-container');
    if (container) {
      container.innerHTML = '';
    }

    // 3. Create fresh instance
    auth.useDeviceLanguage();
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      'size': 'invisible',
      'callback': (response) => {
        console.log("Recaptcha Solved");
      },
      'expired-callback': () => {
        setError('Recaptcha expired, please try again.');
        setLoading(false);
      }
    });
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formattedNumber = `+91${phoneNumber}`;
    if (phoneNumber.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      setLoading(false);
      return;
    }

    try {
      setupRecaptcha();
      const appVerifier = window.recaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, formattedNumber, appVerifier);
      setConfirmationResult(result);
      setShowOtpInput(true);
    } catch (err) {
      console.error('SMS Error:', err);
      setError(err.message || 'Failed to send SMS. Try again.');
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await confirmationResult.confirm(otp);
      const tokenResult = await result.user.getIdTokenResult();

      if (tokenResult.claims.admin !== true) {
        await auth.signOut();
        setError('Access denied. Admin privileges required.');
        setLoading(false);
        return;
      }

      navigate('/');
    } catch (err) {
      console.error('Verify Error:', err);
      setError('Invalid OTP. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark font-display">
      {/* reCAPTCHA container - always in DOM */}
      <div id="recaptcha-container"></div>

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

        {/* Phone Input */}
        {!showOtpInput && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mobile Number</label>
              <div className="flex gap-2">
                <div className="flex items-center justify-center h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-500 shrink-0">
                  🇮🇳 +91
                </div>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="98765 00000"
                  className="w-full h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || phoneNumber.length < 10}
              className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        )}

        {/* OTP Input */}
        {showOtpInput && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Verification Code</label>
                <button type="button" onClick={() => setShowOtpInput(false)} className="text-orange-500 text-xs font-semibold hover:text-orange-600">
                  Change Number
                </button>
              </div>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
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
              {loading ? 'Verifying...' : 'Verify & Sign In'}
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
