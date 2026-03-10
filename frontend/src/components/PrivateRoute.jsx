import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import axios from 'axios';

const PrivateRoute = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [emailStatus, setEmailStatus] = useState(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
            const token = await currentUser.getIdToken();
            document.cookie = `access_token=${token}; path=/; max-age=3600`;

            const res = await axios.get('/api/auth/email-status', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEmailStatus(res.data);

            // Remember dismissal per session
            const dismissed = sessionStorage.getItem('emailBannerDismissed');
            if (dismissed === 'true') setBannerDismissed(true);
        } catch (e) {
            console.error('Error checking auth status:', e);
            setEmailStatus({ emailVerified: true, email: null });
        }
      }
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleResendVerification = async () => {
    setResending(true);
    setResendSuccess(false);
    try {
        const token = await auth.currentUser.getIdToken();
        await axios.post('/api/auth/send-verification-email', {}, {
            headers: { Authorization: `Bearer ${token}` }
        });
        setResendSuccess(true);
        setTimeout(() => setResendSuccess(false), 4000);
    } catch (e) {
        console.error('Resend failed:', e);
    } finally {
        setResending(false);
    }
  };

  const handleDismiss = () => {
    setBannerDismissed(true);
    sessionStorage.setItem('emailBannerDismissed', 'true');
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white dark:bg-[#121121]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;

  // Show a dismissible reminder banner instead of blocking
  const showBanner = emailStatus && !emailStatus.emailVerified && !bannerDismissed;

  return (
    <>
      {showBanner && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[20px] shrink-0">mail</span>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Please verify your email <strong className="font-semibold">{emailStatus.email}</strong> to receive important notifications about your sites.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {resendSuccess ? (
                <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  Sent
                </span>
              ) : (
                <button
                  onClick={handleResendVerification}
                  disabled={resending}
                  className="text-xs font-semibold text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 underline underline-offset-2 disabled:opacity-50"
                >
                  {resending ? 'Sending...' : 'Resend verification email'}
                </button>
              )}
              <button
                onClick={handleDismiss}
                className="p-1 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                title="Dismiss"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {children}
    </>
  );
};

export default PrivateRoute;
