import React, { useState, useEffect } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const Login = () => {
  // State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);

  // Profile State
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // Welcome Modal State
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeData, setWelcomeData] = useState(null);

  // Common State
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref');

  // Recaptcha Cleanup
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
    auth.useDeviceLanguage(); // Ensure language is set
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      'size': 'invisible',
      'callback': (response) => {
        // reCAPTCHA solved - response is the token
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
      const user = result.user;
      
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        navigate('/');
      } else {
        setShowProfileForm(true);
      }
    } catch (err) {
      console.error('Verify Error:', err);
      setError('Invalid OTP. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!name.trim() || !email.trim()) {
      setError('Name and Email are required.');
      setLoading(false);
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No authenticated user found.');

      await updateProfile(user, { displayName: name, email: email });

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: name,
        email: email,
        phoneNumber: user.phoneNumber,
        createdAt: new Date().toISOString()
      });

      // Apply referral code if present
      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };

      if (refCode) {
        try {
          await axios.post('/api/referral/apply', { code: refCode }, { headers });
        } catch (refErr) {
          console.warn('Referral apply failed:', refErr.message);
        }
      }

      // Setup new user (gift credits + referral bonus)
      let setupResult = null;
      try {
        const { data } = await axios.post('/api/auth/setup-new-user', {}, { headers });
        setupResult = data;
      } catch (setupErr) {
        console.warn('Setup new user failed:', setupErr.message);
      }

      // Send verification email
      try {
        await axios.post('/api/auth/send-verification-email', { email }, { headers });
      } catch (emailErr) {
        console.warn('Send verification email failed:', emailErr.message);
      }

      // Show welcome modal with bonus info
      setWelcomeData({
        name: name.trim(),
        giftCredits: setupResult?.giftCredits || 200,
        hasReferral: setupResult?.hasReferral || false,
        referralBonusAmount: setupResult?.referralBonusAmount || 0,
        referrerReward: setupResult?.referrerReward || 100,
      });
      setShowWelcome(true);
    } catch (err) {
      console.error('Profile Save Error:', err);
      setError('Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-row overflow-hidden group/design-root font-display bg-background-light dark:bg-background-dark text-brand-dark dark:text-white">
      {/* Left Column: Form */}
      <div className="flex w-full flex-col justify-center overflow-y-auto px-4 py-8 sm:px-6 lg:w-1/2 lg:px-20 xl:px-24 bg-white dark:bg-[#121121] transition-colors duration-300">
        <div className="mx-auto w-full max-w-sm lg:w-[420px]">
          
          {/* Logo & Header */}
          <div className=" flex items-center justify-center gap-3">
            <img src="/logo_new.png" alt="GenWeb Logo" className="h-55" />
          </div>

          <div className="mb-8 flex flex-col gap-3 text-center">
            <h1 className="text-brand-dark dark:text-white tracking-tight text-[32px] font-bold leading-tight">
              {showProfileForm ? 'Complete your profile' : 'Sign in to your account'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-base font-normal leading-normal">
              {showProfileForm ? 'Tell us a bit about yourself to get started.' : 'Welcome back to the future of web building.'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium border border-red-100 dark:border-red-800">
              {error}
            </div>
          )}

          <div className="space-y-6">
            
            {/* STAGE 1: Phone Input */}
            {!showOtpInput && !showProfileForm && (
              <form onSubmit={handleSendOtp}>
                <div>
                  <label className="text-brand-dark dark:text-white text-base font-medium leading-normal pb-2 block">Mobile Number</label>
                  <div className="flex gap-3">
                    <div className="relative w-[110px]">
                      <select className="form-select flex w-full appearance-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-white/5 h-14 px-4 py-3 text-base font-normal text-brand-dark dark:text-white focus:border-primary focus:ring-0 cursor-pointer">
                        <option value="+91">🇮🇳 +91</option>
                        {/* <option value="+1">🇺🇸 +1</option> */}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                        <span className="material-symbols-outlined text-sm">expand_more</span>
                      </div>
                    </div>
                    <div className="relative flex-1">
                      <input 
                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-brand-dark dark:text-white focus:outline-0 focus:ring-0 border border-gray-200 dark:border-gray-700 bg-white dark:bg-white/5 focus:border-primary h-14 placeholder:text-gray-400 p-[15px] text-base font-normal leading-normal" 
                        placeholder="98765 00000" 
                        type="tel" 
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      />
                    </div>
                  </div>
                </div>

                <div id="recaptcha-container"></div>

                <button 
                  disabled={loading || phoneNumber.length < 10}
                  className="mt-6 flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-5 bg-primary hover:bg-primary-hover transition-colors text-white text-base font-bold leading-normal tracking-[0.015em] shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="truncate">{loading ? 'Sending...' : 'Send OTP'}</span>
                </button>
              </form>
            )}

            {/* STAGE 2: OTP Input */}
            {showOtpInput && !showProfileForm && (
              <form onSubmit={handleVerifyOtp}>
                <div className="pt-2">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-brand-dark dark:text-white text-sm font-medium leading-normal">Enter Verification Code</label>
                    <button type="button" onClick={() => setShowOtpInput(false)} className="text-primary text-sm font-semibold hover:text-orange-600">Change Number</button>
                  </div>
                  <div className="">
                    <input 
                      className="h-14 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-background-light dark:bg-white/5 text-center text-2xl font-bold text-brand-dark dark:text-white focus:border-primary focus:ring-1 focus:ring-primary focus:bg-white dark:focus:bg-white/10 transition-all outline-none tracking-[0.5em]" 
                      type="text" 
                      placeholder="XXXXXX"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                    />
                  </div>
                </div>

                <button 
                  disabled={loading || otp.length < 6}
                  className="mt-6 flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-5 bg-primary hover:bg-primary-hover transition-colors text-white text-base font-bold leading-normal tracking-[0.015em] shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="truncate">{loading ? 'Verifying...' : 'Verify & Sign In'}</span>
                </button>
              </form>
            )}

            {/* STAGE 3: Profile */}
            {showProfileForm && (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                 <div>
                  <label className="text-brand-dark dark:text-white text-base font-medium leading-normal pb-2 block">Full Name</label>
                  <input 
                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-brand-dark dark:text-white focus:outline-0 focus:ring-0 border border-gray-200 dark:border-gray-700 bg-white dark:bg-white/5 focus:border-primary h-14 placeholder:text-gray-400 px-[15px] text-base font-normal leading-normal" 
                    placeholder="John Doe" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-brand-dark dark:text-white text-base font-medium leading-normal pb-2 block">Email</label>
                  <input 
                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-brand-dark dark:text-white focus:outline-0 focus:ring-0 border border-gray-200 dark:border-gray-700 bg-white dark:bg-white/5 focus:border-primary h-14 placeholder:text-gray-400 px-[15px] text-base font-normal leading-normal" 
                    placeholder="john@example.com" 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <button 
                  disabled={loading}
                  className="mt-6 flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-5 bg-primary hover:bg-primary-hover transition-colors text-white text-base font-bold leading-normal tracking-[0.015em] shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="truncate">{loading ? 'Saving...' : 'Complete Registration'}</span>
                </button>
              </form>
            )}

            {/* Footer Links */}
            <p className="mt-8 text-center text-xs text-gray-500 dark:text-gray-500">
              By proceeding, you agree to our <a className="font-medium text-brand-dark dark:text-white hover:text-primary transition-colors underline decoration-gray-300 underline-offset-2" href="#">Terms of Service</a> and <a className="font-medium text-brand-dark dark:text-white hover:text-primary transition-colors underline decoration-gray-300 underline-offset-2" href="#">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </div>

      {/* Right Column: Hero Image */}
      <div className="relative hidden w-0 flex-1 lg:block bg-background-light dark:bg-gray-900">
        <div className="absolute inset-0 h-full w-full bg-cover bg-center" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuD4iQuOII2vTlaS2Bfxg-iMwe-p4cf3AJdbvC-d9Ieh2H6WqeGA_VyVfKikBmLxrWwTNmKQep1Z0im-zTYlorQJllK57s3xCk0lLphQ2WTuMgkFiZTXjbFCLM-ccwDEGmdeLWzcpfQDn2XOvno17tkJmUc5kp_LNHEjKxDR6TGhFNaj-ngD-r9fP4KRTl0rHJJmD1AeRkCXTpk5OjQj3JUcXyu6uKHIwIIBb6Ssb1CcPBtv-XCM9xuon7AksdMliFYAxqb58RvpaYo')" }}>
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent"></div>
          <div className="absolute inset-0 bg-primary/20 mix-blend-overlay"></div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-16 z-10">
          <div className="max-w-lg">
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md px-3 py-1 text-sm font-medium text-white mb-6">
              <span className="mr-2 h-2 w-2 rounded-full bg-green-400"></span>
              AI Engine Online
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl mb-4">Build faster with intelligent design.</h2>
            <p className="text-lg text-gray-200">
              Experience the power of headless architecture combined with generative AI. Create, scale, and deploy in minutes.
            </p>
          </div>
        </div>
      </div>

      {/* Welcome Modal */}
      {showWelcome && welcomeData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-white dark:bg-[#1a1924] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden animate-in fade-in zoom-in">
            {/* Header accent */}
            <div className="h-1.5 bg-gradient-to-r from-orange-400 via-orange-500 to-amber-500"></div>

            <div className="p-8 text-center">
              {/* Welcome icon */}
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <span className="material-symbols-outlined text-3xl text-orange-500">celebration</span>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Welcome to GenWeb, {welcomeData.name || 'there'}!
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6">
                We are delighted to have you on board. Your account has been set up successfully and you are all set to start building.
              </p>

              {/* Bonus card */}
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10 border border-orange-200 dark:border-orange-800/50 rounded-xl p-5 mb-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-orange-500 text-[20px]">redeem</span>
                  <span className="text-sm font-semibold text-orange-700 dark:text-orange-300">Welcome Bonus</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                  {welcomeData.giftCredits} <span className="text-base font-medium text-gray-500 dark:text-gray-400">credits</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  These credits have been added to your account to help you get started.
                </p>
              </div>

              {/* Referral bonus info */}
              {welcomeData.hasReferral && (
                <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/50 rounded-xl p-4 mb-4">
                  <div className="flex items-start gap-3 text-left">
                    <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-[20px] mt-0.5 shrink-0">card_giftcard</span>
                    <div>
                      <p className="text-sm font-semibold text-green-800 dark:text-green-300 mb-1">Referral Bonus Applied</p>
                      <p className="text-xs text-green-700 dark:text-green-400 leading-relaxed">
                        You have received an additional <strong>{welcomeData.referralBonusAmount} credits</strong> as a signup bonus from your referral.
                        You are also eligible to earn <strong>{welcomeData.referrerReward} more credits</strong> for your referrer when you make your first purchase.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => navigate('/')}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-orange-500/20"
              >
                Get Started
              </button>

              <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
                A verification email has been sent to your address. Please verify it to receive notifications about your sites.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;