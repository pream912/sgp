import React, { useState } from 'react';
import axios from 'axios';
import { auth } from '../firebase';

// This should be the Public IP of your Caddy/Proxy VM
const PROXY_IP = "YOUR_PROXY_IP_HERE"; 

const DomainConnectModal = ({ isOpen, onClose, projectId, currentDomain, onDomainUpdated }) => {
    const [domain, setDomain] = useState('');
    const [status, setStatus] = useState('idle'); // idle, verifying, verified, linking, success, error
    const [error, setError] = useState(null);
    const [dnsIp, setDnsIp] = useState(null);

    if (!isOpen) return null;

    const handleVerify = async () => {
        if (!domain) return;
        setStatus('verifying');
        setError(null);
        setDnsIp(null);

        try {
            const token = await auth.currentUser.getIdToken();
            const response = await axios.get(`/api/domains/verify-setup`, {
                params: { domain, expectedIp: PROXY_IP },
                headers: { Authorization: `Bearer ${token}` }
            });

            const { verified, currentIp } = response.data;
            setDnsIp(currentIp);

            if (verified) {
                setStatus('verified');
            } else {
                setStatus('error');
                setError(`DNS not propagated yet. Found IP: ${currentIp || 'None'}`);
            }

        } catch (err) {
            console.error(err);
            setStatus('error');
            setError(err.response?.data?.error || "Verification failed");
        }
    };

    const handleConnect = async () => {
        setStatus('linking');
        try {
            const token = await auth.currentUser.getIdToken();
            await axios.post(`/api/project/${projectId}/domain`, { domain }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setStatus('success');
            if (onDomainUpdated) onDomainUpdated(domain);
            setTimeout(onClose, 2000);
        } catch (err) {
            console.error(err);
            setStatus('error');
            setError(err.response?.data?.error || "Connection failed");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity" onClick={onClose}></div>
            <div className="relative z-50 w-full max-w-[640px] mx-auto animate-fade-in bg-white dark:bg-[#1a192b] rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800/60 max-h-[90vh] flex flex-col">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white">
                                <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
                            </div>
                            <h2 className="text-xl font-bold tracking-tight text-[#333333] dark:text-white">
                                <span className="text-orange-500">Gen</span>Web
                            </h2>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Configure your DNS settings to point to our servers.</p>
                    </div>
                    <button onClick={onClose} className="group flex items-center justify-center w-8 h-8 -mr-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/50">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-900 dark:text-slate-200" htmlFor="domain-input">Domain Name</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                                <span className="material-symbols-outlined text-slate-400 group-focus-within:text-orange-500 transition-colors text-[20px]">language</span>
                            </div>
                            <input 
                                className="block w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121121] text-slate-900 dark:text-white shadow-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 placeholder:text-slate-400 dark:placeholder:text-slate-500 py-3.5 pl-11 pr-10 text-base transition-all" 
                                id="domain-input" 
                                placeholder="example.com" 
                                type="text"
                                value={domain}
                                onChange={(e) => setDomain(e.target.value)}
                                disabled={status === 'success'}
                            />
                            {status === 'verified' && (
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                    <span className="material-symbols-outlined text-green-500 text-[20px]">check_circle</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="relative py-8">
                        <div aria-hidden="true" className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
                        </div>
                        <div className="relative flex justify-center">
                            <span className="px-3 bg-white dark:bg-[#1a192b] text-xs font-semibold text-slate-400 uppercase tracking-wider">Required Configuration</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Add A Record</h3>
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 uppercase">Technical</span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                            Log in to your domain registrar (e.g., GoDaddy, Namecheap) and create a new record with the exact values below.
                        </p>
                        <div className="mt-2 bg-slate-50 dark:bg-[#121121] rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="grid grid-cols-1 sm:grid-cols-12 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-700">
                                <div className="p-4 sm:col-span-3 flex flex-row sm:flex-col items-center sm:items-start justify-between sm:justify-center gap-2">
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Type</span>
                                    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-[#333333] dark:text-slate-200 font-mono shadow-sm">A</span>
                                </div>
                                <div className="p-4 sm:col-span-3 flex flex-row sm:flex-col items-center sm:items-start justify-between sm:justify-center gap-2">
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Host</span>
                                    <span className="text-sm font-bold text-[#333333] dark:text-white font-mono">@</span>
                                </div>
                                <div className="p-4 sm:col-span-6 flex flex-col justify-center gap-2 bg-white dark:bg-slate-800/50 sm:bg-transparent">
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Value / Points to</span>
                                    <div className="flex items-center gap-2 w-full">
                                        <code className="flex-1 bg-white dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-[#333333] dark:text-slate-200 shadow-sm truncate border-l-4 border-l-orange-500">{PROXY_IP}</code>
                                        <button 
                                            onClick={() => navigator.clipboard.writeText(PROXY_IP)}
                                            className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-orange-500/50 text-slate-500 hover:text-orange-500 dark:text-slate-400 dark:hover:text-orange-500 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/20" 
                                            title="Copy to clipboard"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">content_copy</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Status Messages */}
                        {status === 'error' && (
                            <div className="flex gap-3 p-3.5 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-lg mt-4 animate-in slide-in-from-top-2 fade-in duration-300">
                                <span className="material-symbols-outlined text-red-600 dark:text-red-400 shrink-0 mt-0.5 text-[20px]">error</span>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-red-800 dark:text-red-300">Verification Failed</p>
                                    <p className="text-sm text-red-700 dark:text-red-400 mt-0.5 leading-relaxed">
                                        {error}
                                    </p>
                                </div>
                            </div>
                        )}
                         {status === 'verified' && (
                             <div className="flex gap-3 p-3.5 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20 rounded-lg mt-4 animate-in slide-in-from-top-2 fade-in duration-300">
                                <span className="material-symbols-outlined text-green-600 dark:text-green-400 shrink-0 mt-0.5 text-[20px]">check_circle</span>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-green-800 dark:text-green-300">DNS Verified</p>
                                    <p className="text-sm text-green-700 dark:text-green-400 mt-0.5 leading-relaxed">
                                        We successfully detected your A Record. You can now connect your domain.
                                    </p>
                                </div>
                            </div>
                        )}
                        {status === 'success' && (
                             <div className="flex gap-3 p-3.5 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20 rounded-lg mt-4 animate-in slide-in-from-top-2 fade-in duration-300">
                                <span className="material-symbols-outlined text-green-600 dark:text-green-400 shrink-0 mt-0.5 text-[20px]">check_circle</span>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-green-800 dark:text-green-300">Connected!</p>
                                    <p className="text-sm text-green-700 dark:text-green-400 mt-0.5 leading-relaxed">
                                        Your site is now live at {domain}.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 dark:bg-[#151424] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800">
                    <a className="group inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-orange-500 dark:hover:text-orange-500 transition-colors" href="#">
                        <span className="material-symbols-outlined text-slate-400 group-hover:text-orange-500 transition-colors text-[18px]">menu_book</span>
                        Troubleshooting Guide
                    </a>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button onClick={onClose} className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 focus:ring-4 focus:ring-slate-100 dark:focus:ring-slate-800 text-sm font-semibold transition-all shadow-sm">
                            Cancel
                        </button>
                        {status === 'verified' ? (
                            <button 
                                onClick={handleConnect}
                                className="relative w-full sm:w-auto px-6 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all focus:ring-4 focus:ring-orange-500/30 flex items-center justify-center gap-2 overflow-hidden"
                            >
                                <span>Connect Domain</span>
                                <span className="material-symbols-outlined text-[18px]">link</span>
                            </button>
                        ) : (
                            <button 
                                onClick={handleVerify}
                                disabled={status === 'verifying' || !domain || status === 'success'}
                                className="relative w-full sm:w-auto px-6 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all focus:ring-4 focus:ring-orange-500/30 flex items-center justify-center gap-2 overflow-hidden disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                <span>{status === 'verifying' ? 'Verifying...' : 'Verify DNS'}</span>
                                {status !== 'verifying' && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DomainConnectModal;