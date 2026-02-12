import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { auth } from '../firebase';

// This should be the Public IP of your Caddy/Proxy VM
const PROXY_IP = "34.50.155.64"; 

const DomainConnectModal = ({ isOpen, onClose, projectId, onDomainUpdated }) => {
    const [activeTab, setActiveTab] = useState('subdomain'); // 'subdomain' or 'custom'
    const [projectData, setProjectData] = useState(null);
    const [loadingProject, setLoadingProject] = useState(false);

    // Custom Domain State
    const [domain, setDomain] = useState('');
    const [status, setStatus] = useState('idle'); // idle, verifying, verified, linking, success, error
    const [error, setError] = useState(null);


    // Subdomain State
    const [subdomain, setSubdomain] = useState('');
    const [subdomainStatus, setSubdomainStatus] = useState('idle'); // idle, checking, available, unavailable, success
    const [subdomainError, setSubdomainError] = useState(null);
    const [isSavingSubdomain, setIsSavingSubdomain] = useState(false);

    // Upgrade State
    const [selectedYears, setSelectedYears] = useState(1);
    const [planType, setPlanType] = useState('single'); // 'single' or 'multi'
    const [planCost, setPlanCost] = useState(2000);

    // Claim Free Domain State
    const [view, setView] = useState('setup'); // 'setup' | 'claim'
    const [claimDomain, setClaimDomain] = useState('');
    const [claimStatus, setClaimStatus] = useState('idle'); // idle, checking, available, unavailable, claiming, success
    const [claimError, setClaimError] = useState(null);


    useEffect(() => {
        if (isOpen && projectId) {
            fetchProjectDetails();
            // Reset states
            setStatus('idle');
            setSubdomainStatus('idle');
            setDomain('');
            setSubdomain('');
            setSelectedYears(1);
            setView('setup');
            setClaimDomain('');
            setClaimStatus('idle');
        }
    }, [isOpen, projectId]);

    useEffect(() => {
        if (projectData?.publishedPlan === 'basic') {
            const determinePlan = async () => {
                try {
                    const token = await auth.currentUser.getIdToken();
                    const res = await axios.get(`/api/project/${projectId}/pages`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const pages = res.data.pages || [];
                    if (pages.length > 1) {
                        setPlanType('multi');
                        setPlanCost(3000);
                    } else {
                        setPlanType('single');
                        setPlanCost(2000);
                    }
                } catch (e) {
                    console.error("Failed to fetch pages for plan determination", e);
                }
            };
            determinePlan();
        }
    }, [projectData, projectId]);

    const calculateTotalCost = () => {
        let base = planCost * selectedYears;
        if (selectedYears === 2) base *= 0.95;
        if (selectedYears === 3) base *= 0.90;
        return Math.round(base);
    };

    const handleUpgrade = async () => {
        setLoadingProject(true);
        try {
            const token = await auth.currentUser.getIdToken();
            await axios.post(`/api/project/${projectId}/publish`, { 
                plan: planType,
                years: selectedYears
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchProjectDetails(); // Refresh to unlock
        } catch (err) {
            console.error(err);
            setLoadingProject(false);
            // Ideally handle error
        }
    };

    const fetchProjectDetails = async () => {
        setLoadingProject(true);
        try {
            const token = await auth.currentUser.getIdToken();
            // We don't have a direct "get project" endpoint that returns just one, 
            // but we can filter the list or add one. 
            // For now, let's assume we can get it from the projects list or add a quick endpoint?
            // Actually, we can just use the `api/projects` endpoint and filter client side or add a specific one.
            // Let's rely on the list for now or just fetch it.
            // Since `Dashboard` has the data, ideally we pass it. But fetching is fine.
            // Wait, we don't have a single project GET endpoint in server.js visible in context.
            // Let's assume we pass `currentSubdomain` and `currentCustomDomain` as props or add a fetch.
            // Let's add a lightweight fetch here or assume the Dashboard passes it. 
            // To be robust, let's fetch the list (since we have /api/projects) and find it.
            const res = await axios.get('/api/projects', {
                 headers: { Authorization: `Bearer ${token}` }
            });
            const proj = res.data.find(p => p.projectId === projectId);
            if (proj) {
                setProjectData(proj);
                setSubdomain(proj.subdomain || '');
                setDomain(proj.customDomain || '');
                if (proj.customDomain) setActiveTab('custom');
            }
        } catch (err) {
            console.error("Failed to fetch project", err);
        } finally {
            setLoadingProject(false);
        }
    };

    // --- Subdomain Logic ---
    const checkSubdomain = async (name) => {
        if (!name || name.length < 3) {
            setSubdomainStatus('idle');
            setSubdomainError(null);
            return;
        }
        
        if (projectData?.subdomain === name) {
             setSubdomainStatus('available'); // It's ours
             return;
        }

        setSubdomainStatus('checking');
        try {
            const token = await auth.currentUser.getIdToken();
            const response = await axios.get(`/api/subdomain/check?name=${name}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.available) {
                setSubdomainStatus('available');
                setSubdomainError(null);
            } else {
                setSubdomainStatus('unavailable');
                setSubdomainError('Subdomain is taken');
            }
        } catch {
            setSubdomainStatus('unavailable');
            setSubdomainError('Error checking availability');
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (activeTab === 'subdomain' && subdomain && subdomain !== projectData?.subdomain) {
                checkSubdomain(subdomain);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [subdomain, activeTab]);

    const handleSaveSubdomain = async () => {
        if (subdomainStatus !== 'available' && subdomain !== projectData?.subdomain) return;
        setIsSavingSubdomain(true);
        try {
            const token = await auth.currentUser.getIdToken();
            await axios.post(`/api/project/${projectId}/subdomain`, { subdomain }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSubdomainStatus('success');
            if (onDomainUpdated) onDomainUpdated();
            setTimeout(() => setSubdomainStatus('available'), 2000); // Reset to just "available" (current) state
        } catch (err) {
            setSubdomainError(err.response?.data?.error || 'Failed to update');
            setSubdomainStatus('unavailable');
        } finally {
            setIsSavingSubdomain(false);
        }
    };

    // --- Custom Domain Logic ---
    const handleVerify = async () => {
        if (!domain) return;
        setStatus('verifying');
        setError(null);


        try {
            const token = await auth.currentUser.getIdToken();
            const response = await axios.get(`/api/domains/verify-setup`, {
                params: { domain, expectedIp: PROXY_IP },
                headers: { Authorization: `Bearer ${token}` }
            });

            const { verified, currentIp } = response.data;


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

    // --- Claim Logic ---
    const handleCheckClaim = async () => {
        if (!claimDomain) return;
        
        // Validate TLD
        const allowed = ['.com', '.in'];
        const isValid = allowed.some(tld => claimDomain.toLowerCase().endsWith(tld));
        if (!isValid) {
            setClaimStatus('unavailable');
            setClaimError('Only .in and .com domains are allowed.');
            return;
        }

        setClaimStatus('checking');
        setClaimError(null);


        try {
            const token = await auth.currentUser.getIdToken();
            const response = await axios.get(`/api/domains/check?domain=${claimDomain}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const { available, priceDisplay } = response.data;
            
            if (!available) {
                setClaimStatus('unavailable');
                setClaimError('Domain is already taken.');
                return;
            }

            const price = priceDisplay ? priceDisplay.amount : 99999;


            if (price > 1000) {
                 setClaimStatus('unavailable');
                 setClaimError(`Domain is too expensive for free claim (₹${price}).`);
            } else {
                setClaimStatus('available');
            }

        } catch (err) {
            console.error(err);
            setClaimStatus('unavailable');
            setClaimError('Failed to check availability.');
        }
    };

    const handleClaim = async () => {
        setClaimStatus('claiming');
        try {
            const token = await auth.currentUser.getIdToken();
            await axios.post(`/api/domains/claim`, {
                domain: claimDomain,
                projectId
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            setClaimStatus('success');
            if (onDomainUpdated) onDomainUpdated(claimDomain);
            // Don't close immediately, show success message
        } catch (err) {
            console.error(err);
            setClaimStatus('unavailable'); // Go back to error state
            setClaimError(err.response?.data?.error || 'Claim failed.');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity" onClick={onClose}></div>
            <div className="relative z-50 w-full max-w-[640px] mx-auto animate-fade-in bg-white dark:bg-[#1a192b] rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800/60 max-h-[90vh] flex flex-col">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white">
                                <span className="material-symbols-outlined text-[16px]">language</span>
                            </div>
                            <h2 className="text-xl font-bold tracking-tight text-[#333333] dark:text-white">
                                {view === 'claim' ? 'Claim Free Domain' : 'Domain Settings'}
                            </h2>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                             {view === 'claim' ? 'Find and claim your free domain.' : 'Manage your website\'s address.'}
                        </p>
                    </div>
                    <button onClick={onClose} className="group flex items-center justify-center w-8 h-8 -mr-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/50">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* Tabs (Hidden in Claim Mode) */}
                {view !== 'claim' && (
                    <div className="flex border-b border-slate-100 dark:border-slate-800">
                        <button 
                            onClick={() => setActiveTab('subdomain')}
                            className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
                                activeTab === 'subdomain' 
                                    ? 'border-orange-500 text-orange-500' 
                                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            Free Subdomain
                        </button>
                        <button 
                            onClick={() => setActiveTab('custom')}
                            className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
                                activeTab === 'custom' 
                                    ? 'border-orange-500 text-orange-500' 
                                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            Custom Domain
                        </button>
                    </div>
                )}

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
                    {loadingProject ? (
                        <div className="flex justify-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                        </div>
                    ) : view === 'claim' ? (
                        /* Claim Domain View */
                        <div className="space-y-6">
                            {claimStatus === 'success' ? (
                                <div className="flex flex-col items-center justify-center py-6 text-center animate-in fade-in zoom-in duration-300">
                                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4 text-green-600 dark:text-green-400">
                                        <span className="material-symbols-outlined text-3xl">check_circle</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Domain Claimed!</h3>
                                    <p className="text-slate-600 dark:text-slate-400 max-w-sm mx-auto mb-6">
                                        <strong>{claimDomain}</strong> has been purchased and added to your project. Please wait 5-10 minutes for DNS propagation.
                                    </p>
                                    <button 
                                        onClick={onClose}
                                        className="px-6 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 font-medium"
                                    >
                                        Close
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-900 dark:text-slate-200 mb-2">
                                            Search for a Domain
                                        </label>
                                        <div className="relative flex items-center gap-2">
                                            <input 
                                                type="text" 
                                                value={claimDomain}
                                                onChange={(e) => {
                                                    setClaimDomain(e.target.value.toLowerCase());
                                                    setClaimStatus('idle');
                                                    setClaimError(null);
                                                }}
                                                onKeyDown={(e) => e.key === 'Enter' && handleCheckClaim()}
                                                className="block w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121121] text-slate-900 dark:text-white shadow-sm py-3 px-4 text-base focus:border-orange-500 focus:ring-orange-500"
                                                placeholder="mybusiness.com"
                                                disabled={claimStatus === 'claiming'}
                                            />
                                            <button 
                                                onClick={handleCheckClaim}
                                                disabled={!claimDomain || claimStatus === 'checking' || claimStatus === 'claiming'}
                                                className="px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 font-medium shrink-0"
                                            >
                                                {claimStatus === 'checking' ? 'Checking...' : 'Check'}
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-2">Only .com and .in domains are eligible for free claim.</p>
                                    </div>

                                    {/* Results */}
                                    <div className="min-h-[100px]">
                                        {claimError && (
                                            <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-lg flex items-start gap-3">
                                                <span className="material-symbols-outlined text-red-500 mt-0.5">error</span>
                                                <div>
                                                    <p className="font-semibold text-red-800 dark:text-red-300">Unavailable</p>
                                                    <p className="text-sm text-red-700 dark:text-red-400">{claimError}</p>
                                                </div>
                                            </div>
                                        )}

                                        {claimStatus === 'available' && (
                                            <div className="p-4 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20 rounded-lg">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <span className="material-symbols-outlined text-green-500">check_circle</span>
                                                        <div>
                                                            <p className="font-bold text-slate-900 dark:text-white text-lg">{claimDomain}</p>
                                                            <p className="text-sm text-green-700 dark:text-green-400">Available & Eligible!</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-900/30 flex justify-end">
                                                    <button 
                                                        onClick={handleClaim}
                                                        className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-md shadow-green-500/20 flex items-center gap-2"
                                                    >
                                                        Claim this domain name
                                                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {claimStatus === 'claiming' && (
                                            <div className="text-center py-4">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
                                                <p className="text-slate-600 dark:text-slate-400">Purchasing and configuring domain...</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                        <button 
                                            onClick={() => setView('setup')}
                                            disabled={claimStatus === 'claiming'}
                                            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium flex items-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                                            Back to Settings
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : activeTab === 'subdomain' ? (
                        /* Subdomain Tab Content */
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-900 dark:text-slate-200 mb-2">
                                    Your Web Address
                                </label>
                                <div className="relative flex items-center">
                                    <input 
                                        type="text" 
                                        value={subdomain}
                                        onChange={(e) => {
                                            setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                                            setSubdomainStatus('idle');
                                        }}
                                        className={`block w-full rounded-l-lg border-y border-l ${
                                            subdomainStatus === 'unavailable' 
                                                ? 'border-red-300 dark:border-red-900 focus:ring-red-500 focus:border-red-500' 
                                                : subdomainStatus === 'success'
                                                    ? 'border-green-300 dark:border-green-900 focus:ring-green-500 focus:border-green-500'
                                                    : 'border-slate-200 dark:border-slate-700 focus:ring-orange-500 focus:border-orange-500'
                                        } bg-white dark:bg-[#121121] text-slate-900 dark:text-white shadow-sm py-3 pl-4 pr-10 text-base transition-all`}
                                        placeholder="your-site"
                                    />
                                    <div className="absolute right-[100px] flex items-center pointer-events-none">
                                        {subdomainStatus === 'checking' && <div className="animate-spin w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full"></div>}
                                    </div>
                                    <span className="inline-flex items-center px-4 py-3 rounded-r-lg border border-l-0 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm font-medium">
                                        .genweb.in
                                    </span>
                                </div>
                                
                                <div className="mt-2 min-h-[20px]">
                                    {subdomainError && <p className="text-sm text-red-500">{subdomainError}</p>}
                                    {subdomainStatus === 'available' && subdomain !== projectData?.subdomain && (
                                        <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[16px]">check_circle</span> Available
                                        </p>
                                    )}
                                    {subdomainStatus === 'success' && (
                                        <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[16px]">check_circle</span> Updated successfully!
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                                <button 
                                    onClick={handleSaveSubdomain}
                                    disabled={isSavingSubdomain || (subdomainStatus !== 'available' && subdomain !== projectData?.subdomain) || !subdomain}
                                    className="px-6 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold shadow-lg shadow-orange-500/20 disabled:opacity-70 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                                >
                                    {isSavingSubdomain ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    ) : projectData?.publishedPlan === 'basic' ? (
                        /* Upgrade Prompt for Basic Plan */
                        <div className="flex flex-col items-center justify-center py-10 text-center space-y-6">
                            <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center text-orange-500 mb-2">
                                <span className="material-symbols-outlined text-[32px]">lock</span>
                            </div>
                            <div className="max-w-xs">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Unlock Custom Domains</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Connect your own domain by upgrading to the Standard plan.
                                </p>
                            </div>
                            
                            {/* Years Selector */}
                            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                {[1, 2, 3].map(y => (
                                     <button
                                        key={y}
                                        onClick={() => setSelectedYears(y)}
                                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                                            selectedYears === y 
                                            ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                        }`}
                                     >
                                        {y} Year{y > 1 ? 's' : ''} {y > 1 && <span className="text-xs ml-1 font-bold text-green-600 dark:text-green-400">-{y === 2 ? '5' : '10'}%</span>}
                                     </button>
                                ))}
                            </div>

                            {/* Cost Display */}
                            <div className="text-center">
                                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                                    {calculateTotalCost().toLocaleString()} <span className="text-lg font-normal text-slate-500">Credits</span>
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    For {planType === 'multi' ? 'Multi-Page' : 'Single-Page'} Standard Plan ({selectedYears} Year{selectedYears > 1 ? 's' : ''})
                                </p>
                            </div>

                            <button 
                                onClick={handleUpgrade}
                                className="px-8 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold shadow-lg shadow-orange-500/25 transform hover:-translate-y-0.5 transition-all flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined">star</span>
                                Upgrade & Unlock
                            </button>
                        </div>
                    ) : (
                        /* Custom Domain Tab Content */
                        <div className="space-y-6">
                            
                            {/* Option 1: Claim New */}
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-orange-500 text-[20px]">shopping_cart</span>
                                    Get a New Domain
                                </h3>
                                {/* Add Claim Free Domain Button */}
                                <button 
                                    onClick={() => setView('claim')}
                                    className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-500/10 to-amber-500/10 hover:from-orange-500/20 hover:to-amber-500/20 border border-orange-500/20 rounded-lg transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/30">
                                            <span className="material-symbols-outlined text-[18px]">redeem</span>
                                        </div>
                                        <div className="text-left">
                                            <p className="font-bold text-slate-900 dark:text-white text-sm">Claim Free Domain</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">Get a .com or .in domain on us!</p>
                                        </div>
                                    </div>
                                    <span className="material-symbols-outlined text-orange-500">arrow_forward_ios</span>
                                </button>
                            </div>

                            {/* Divider */}
                            <div className="relative flex items-center py-2">
                                <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                                <span className="flex-shrink-0 mx-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">OR</span>
                                <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                            </div>

                            {/* Option 2: Connect Existing */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-blue-500 text-[20px]">link</span>
                                    Connect Existing Domain
                                </h3>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1" htmlFor="domain-input">Enter your domain name</label>
                                
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

                                <div className="relative py-6">
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
                                                Your site is now live at {domain}. This might take from 10 to 60 mins to take effect.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                                    {status === 'verified' ? (
                                        <button 
                                            onClick={handleConnect}
                                            disabled={status === 'linking'}
                                            className="relative w-full sm:w-auto px-6 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all focus:ring-4 focus:ring-orange-500/30 flex items-center justify-center gap-2 overflow-hidden disabled:opacity-70 disabled:cursor-not-allowed"
                                        >
                                            {status === 'linking' ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                    <span>Connecting...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>Connect Domain</span>
                                                    <span className="material-symbols-outlined text-[18px]">link</span>
                                                </>
                                            )}
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
                    )}
                </div>


            </div>
        </div>
    );
};

export default DomainConnectModal;