import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { auth } from '../firebase';

const indianStates = {
  'AP': 'Andhra Pradesh', 'AR': 'Arunachal Pradesh', 'AS': 'Assam', 'BR': 'Bihar',
  'CG': 'Chhattisgarh', 'CH': 'Chandigarh', 'DN': 'Dadra and Nagar Haveli',
  'DD': 'Daman and Diu', 'DL': 'Delhi', 'GA': 'Goa', 'GJ': 'Gujarat',
  'HR': 'Haryana', 'HP': 'Himachal Pradesh', 'JK': 'Jammu and Kashmir',
  'JH': 'Jharkhand', 'KA': 'Karnataka', 'KL': 'Kerala', 'LA': 'Ladakh',
  'LD': 'Lakshadweep', 'MP': 'Madhya Pradesh', 'MH': 'Maharashtra',
  'MN': 'Manipur', 'ML': 'Meghalaya', 'MZ': 'Mizoram', 'NL': 'Nagaland',
  'OR': 'Odisha', 'PY': 'Puducherry', 'PB': 'Punjab', 'RJ': 'Rajasthan',
  'SK': 'Sikkim', 'TN': 'Tamil Nadu', 'TS': 'Telangana', 'TR': 'Tripura',
  'UP': 'Uttar Pradesh', 'UK': 'Uttarakhand', 'WB': 'West Bengal'
};

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({ name: '', email: '', phoneNumber: '', emailVerified: false, createdAt: null });
  const [billing, setBilling] = useState({
    firstName: '', lastName: '', email: '', phone: '', address1: '', city: '', state: '', postalCode: '', country: 'IN'
  });

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [billingSaving, setBillingSaving] = useState(false);
  const [billingMsg, setBillingMsg] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');

  // Track original values for dirty detection
  const [origName, setOrigName] = useState('');
  const [origEmail, setOrigEmail] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = await auth.currentUser.getIdToken();
        const { data } = await axios.get('/api/profile', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProfile(data);
        setOrigName(data.name || '');
        setOrigEmail(data.email || '');
        if (data.billingAddress) {
          setBilling(data.billingAddress);
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileMsg('');
    setEmailMsg('');
    try {
      const token = await auth.currentUser.getIdToken();

      // Save name if changed
      if (profile.name !== origName) {
        await axios.put('/api/profile', { name: profile.name }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setOrigName(profile.name);
      }

      // Update email if changed
      if (profile.email !== origEmail) {
        await axios.post('/api/auth/update-email', { email: profile.email }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setOrigEmail(profile.email);
        setProfile(p => ({ ...p, emailVerified: false }));
        setEmailMsg('Verification email sent to new address');
      }

      setProfileMsg('Profile saved');
      setTimeout(() => setProfileMsg(''), 3000);
    } catch (err) {
      setProfileMsg('Failed to save: ' + (err.response?.data?.error || err.message));
    } finally {
      setProfileSaving(false);
    }
  };

  const resendVerification = async () => {
    setEmailSending(true);
    setEmailMsg('');
    try {
      const token = await auth.currentUser.getIdToken();
      await axios.post('/api/auth/update-email', { email: profile.email }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmailMsg('Verification email sent');
      setTimeout(() => setEmailMsg(''), 3000);
    } catch (err) {
      setEmailMsg('Failed to send verification email');
    } finally {
      setEmailSending(false);
    }
  };

  const saveBilling = async () => {
    setBillingSaving(true);
    setBillingMsg('');
    try {
      const token = await auth.currentUser.getIdToken();
      await axios.put('/api/profile/billing-address', billing, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBillingMsg('Billing address saved');
      setTimeout(() => setBillingMsg(''), 3000);
    } catch (err) {
      setBillingMsg('Failed to save: ' + (err.response?.data?.error || err.message));
    } finally {
      setBillingSaving(false);
    }
  };

  const inputClass = "block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121121] text-sm text-slate-900 dark:text-white shadow-sm py-2.5 px-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors";
  const labelClass = "block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5";

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="text-center py-20 text-slate-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-col gap-2 mb-10">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h2>
        <p className="text-slate-500 dark:text-slate-400">Manage your profile and billing information.</p>
      </div>

      {/* Profile Card */}
      <div className="bg-white dark:bg-[#1e1c2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 mb-6">
        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-6">Profile</h3>
        <div className="space-y-5">
          <div>
            <label className={labelClass}>Name</label>
            <input
              type="text"
              value={profile.name}
              onChange={e => setProfile({ ...profile, name: e.target.value })}
              className={inputClass}
              placeholder="Your name"
            />
          </div>
          <div>
            <label className={labelClass}>Phone Number</label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={profile.phoneNumber}
                disabled
                className={`${inputClass} bg-slate-50 dark:bg-slate-800 cursor-not-allowed opacity-70`}
              />
              <span className="text-xs text-slate-400 whitespace-nowrap">Cannot be changed</span>
            </div>
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <div className="flex items-center gap-3">
              <input
                type="email"
                value={profile.email}
                onChange={e => setProfile({ ...profile, email: e.target.value })}
                className={`${inputClass} flex-1`}
                placeholder="your@email.com"
              />
              {profile.emailVerified ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 whitespace-nowrap">
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                  Verified
                </span>
              ) : profile.email ? (
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
                    <span className="material-symbols-outlined text-[14px]">warning</span>
                    Unverified
                  </span>
                  <button
                    onClick={resendVerification}
                    disabled={emailSending}
                    className="text-xs text-orange-500 hover:text-orange-600 font-medium"
                  >
                    {emailSending ? 'Sending...' : 'Resend'}
                  </button>
                </div>
              ) : null}
            </div>
            {emailMsg && <p className="text-xs text-green-600 dark:text-green-400 mt-1">{emailMsg}</p>}
          </div>
          <div>
            <label className={labelClass}>Member Since</label>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {profile.createdAt
                ? new Date(profile.createdAt._seconds ? profile.createdAt._seconds * 1000 : profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
                : '—'}
            </p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={saveProfile}
              disabled={profileSaving || (profile.name === origName && profile.email === origEmail)}
              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {profileSaving ? 'Saving...' : 'Save Profile'}
            </button>
            {profileMsg && (
              <span className={`text-sm font-medium ${profileMsg.includes('Failed') ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>{profileMsg}</span>
            )}
          </div>
        </div>
      </div>

      {/* Billing Address Card */}
      <div className="bg-white dark:bg-[#1e1c2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">Billing Address</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Used to pre-fill domain registration forms.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>First Name</label>
            <input type="text" value={billing.firstName} onChange={e => setBilling({ ...billing, firstName: e.target.value })} className={inputClass} placeholder="John" />
          </div>
          <div>
            <label className={labelClass}>Last Name</label>
            <input type="text" value={billing.lastName} onChange={e => setBilling({ ...billing, lastName: e.target.value })} className={inputClass} placeholder="Doe" />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" value={billing.email} onChange={e => setBilling({ ...billing, email: e.target.value })} className={inputClass} placeholder="john@example.com" />
          </div>
          <div>
            <label className={labelClass}>Phone (with + code)</label>
            <input type="tel" value={billing.phone} onChange={e => setBilling({ ...billing, phone: e.target.value })} className={inputClass} placeholder="+91.9876543210" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Street Address</label>
            <input type="text" value={billing.address1} onChange={e => setBilling({ ...billing, address1: e.target.value })} className={inputClass} placeholder="123 Web Street" />
          </div>
          <div>
            <label className={labelClass}>City</label>
            <input type="text" value={billing.city} onChange={e => setBilling({ ...billing, city: e.target.value })} className={inputClass} placeholder="Mumbai" />
          </div>
          <div>
            <label className={labelClass}>State / Province</label>
            {billing.country === 'IN' ? (
              <select
                value={billing.state}
                onChange={e => setBilling({ ...billing, state: e.target.value })}
                className={inputClass}
              >
                <option value="">Select state</option>
                {Object.entries(indianStates).map(([code, name]) => (
                  <option key={code} value={name}>{name}</option>
                ))}
              </select>
            ) : (
              <input type="text" value={billing.state} onChange={e => setBilling({ ...billing, state: e.target.value })} className={inputClass} placeholder="State" />
            )}
          </div>
          <div>
            <label className={labelClass}>Postal Code</label>
            <input type="text" value={billing.postalCode} onChange={e => setBilling({ ...billing, postalCode: e.target.value })} className={inputClass} placeholder="400001" />
          </div>
          <div>
            <label className={labelClass}>Country (2-letter code)</label>
            <input type="text" value={billing.country} onChange={e => setBilling({ ...billing, country: e.target.value.toUpperCase() })} className={`${inputClass} uppercase`} placeholder="IN" maxLength={2} />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={saveBilling}
            disabled={billingSaving || !billing.firstName || !billing.lastName || !billing.email || !billing.phone || !billing.address1 || !billing.city || !billing.state || !billing.postalCode || !billing.country}
            className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {billingSaving ? 'Saving...' : 'Save Billing Address'}
          </button>
          {billingMsg && (
            <span className={`text-sm font-medium ${billingMsg.includes('Failed') ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>{billingMsg}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
