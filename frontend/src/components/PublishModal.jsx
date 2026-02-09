import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { auth } from '../firebase';
import { X, Check, Rocket, ShieldCheck, Globe, Zap, Layout } from 'lucide-react';

const PLANS = [
    {
        id: 'basic',
        name: 'Basic',
        cost: 500,
        icon: <Zap className="w-6 h-6 text-orange-500" />,
        features: ['Publish to .genweb.in subdomain', 'Hosting included', 'SSL Certificate', 'Standard Performance']
    },
    {
        id: 'single',
        name: 'Single Page',
        cost: 2000,
        type: 'single',
        icon: <Layout className="w-6 h-6 text-blue-500" />,
        features: ['Connect Custom Domain', 'No Branding', 'Priority Hosting', 'SSL Certificate', 'Global CDN']
    },
    {
        id: 'multi',
        name: 'Multi Page',
        cost: 3000,
        type: 'multi',
        icon: <Globe className="w-6 h-6 text-purple-500" />,
        features: ['Connect Custom Domain', 'Unlimited Pages', 'No Branding', 'Premium Hosting', 'Global CDN']
    }
];

const PublishModal = ({ isOpen, onClose, projectId, currentCredits, onSuccess, project }) => {
    const [loading, setLoading] = useState(false);
    const [pageCheckLoading, setPageCheckLoading] = useState(true);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [isMultiPage, setIsMultiPage] = useState(false);

    // Subdomain State
    const [subdomain, setSubdomain] = useState('');
    const [subdomainStatus, setSubdomainStatus] = useState('idle'); // idle, checking, available, unavailable
    const [subdomainError, setSubdomainError] = useState(null);

    useEffect(() => {
        if (isOpen && projectId) {
            checkProjectType();
            // Pre-fill subdomain
            if (project?.subdomain) {
                setSubdomain(project.subdomain);
                setSubdomainStatus('available'); // Assume current is valid/owned
            } else if (project?.query) {
                 const suggest = project.query.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
                 setSubdomain(suggest);
                 checkAvailability(suggest);
            }
        }
    }, [isOpen, projectId, project]);

    const checkAvailability = async (name) => {
        if (!name || name.length < 3) {
            setSubdomainStatus('idle');
            setSubdomainError(null);
            return;
        }
        
        // If it's the same as the current assigned one, it's valid.
        if (project?.subdomain === name) {
             setSubdomainStatus('available');
             setSubdomainError(null);
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
        } catch (error) {
            setSubdomainStatus('unavailable');
            setSubdomainError('Error checking availability');
        }
    };

    // Debounce wrapper
    useEffect(() => {
        const timer = setTimeout(() => {
            if (subdomain && subdomain !== project?.subdomain) {
                checkAvailability(subdomain);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [subdomain]);

    const checkProjectType = async () => {
        setPageCheckLoading(true);
        try {
            const token = await auth.currentUser.getIdToken();
            const res = await axios.get(`/api/project/${projectId}/pages`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.pages && res.data.pages.length > 1) {
                setIsMultiPage(true);
            } else {
                setIsMultiPage(false);
            }
        } catch (error) {
            console.error("Failed to check project type", error);
            setIsMultiPage(false);
        } finally {
            setPageCheckLoading(false);
        }
    };

    const handlePublish = async () => {
        if (!selectedPlan) return;
        if (subdomainStatus === 'unavailable' || subdomainStatus === 'checking') return;
        
        setLoading(true);
        try {
            const token = await auth.currentUser.getIdToken();
            await axios.post(`/api/project/${projectId}/publish`, {
                plan: selectedPlan.id,
                subdomain: subdomain // Send selected subdomain
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Publish failed:', error);
            alert(error.response?.data?.error || 'Failed to publish');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const availablePlans = PLANS.filter(p => {
        if (p.id === 'basic') return true;
        if (isMultiPage) return p.id === 'multi';
        return p.id === 'single';
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-40 transition-opacity" onClick={onClose}></div>

            {/* Modal Window */}
            <div className="relative z-50 w-full max-w-4xl bg-white dark:bg-[#1e1c2e] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="shrink-0 px-6 pt-6 pb-2 flex justify-between items-start">
                    <div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Rocket className="w-6 h-6 text-orange-500" />
                            Publish Your Site
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">
                            {pageCheckLoading ? 'Checking project details...' : `Choose a plan to launch your ${isMultiPage ? 'multi-page' : 'single-page'} website.`}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 transition-colors">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto px-6 py-4">
                    {pageCheckLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {availablePlans.map((plan) => {
                                    const isSelected = selectedPlan?.id === plan.id;
                                    const canAfford = currentCredits >= plan.cost;
                                    
                                    return (
                                        <div 
                                            key={plan.id}
                                            onClick={() => setSelectedPlan(plan)}
                                            className={`relative border-2 rounded-xl p-6 cursor-pointer transition-all duration-200 flex flex-col h-full
                                                ${isSelected 
                                                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10' 
                                                    : 'border-slate-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-500/50 bg-white dark:bg-[#262438]'
                                                }`}
                                        >
                                            {isSelected && (
                                                <div className="absolute top-4 right-4 bg-orange-500 text-white rounded-full p-1">
                                                    <Check className="h-4 w-4" />
                                                </div>
                                            )}
                                            
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className={`p-3 rounded-lg ${isSelected ? 'bg-orange-200 dark:bg-orange-500/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                                    {plan.icon}
                                                </div>
                                                <div>
                                                    <h4 className="text-lg font-bold text-slate-900 dark:text-white">{plan.name}</h4>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-2xl font-bold text-slate-900 dark:text-white">{plan.cost}</span>
                                                        <span className="text-sm text-slate-500 dark:text-slate-400">Credits</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex-grow">
                                                <ul className="space-y-3">
                                                    {plan.features.map((feature, idx) => (
                                                        <li key={idx} className="flex items-start text-sm text-slate-600 dark:text-slate-300">
                                                            <ShieldCheck className={`h-5 w-5 mr-2 shrink-0 ${isSelected ? 'text-orange-500' : 'text-slate-400'}`} />
                                                            {feature}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            {!canAfford && (
                                                <div className="mt-4 text-xs text-red-500 font-medium flex items-center justify-center bg-red-50 dark:bg-red-900/20 py-2 rounded-lg">
                                                    Insufficient Credits
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Subdomain Input (Visible when plan selected) */}
                            {selectedPlan && (
                                <div className="bg-slate-50 dark:bg-[#151424] rounded-xl p-6 border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                                        Choose your web address
                                    </label>
                                    <div className="relative max-w-md">
                                        <div className="flex items-center">
                                            <input 
                                                type="text" 
                                                value={subdomain}
                                                onChange={(e) => {
                                                    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                                                    setSubdomain(val);
                                                }}
                                                placeholder="your-business-name"
                                                className={`block w-full rounded-l-lg border-y border-l ${
                                                    subdomainStatus === 'unavailable' 
                                                        ? 'border-red-300 dark:border-red-900 focus:ring-red-500 focus:border-red-500' 
                                                        : subdomainStatus === 'available'
                                                            ? 'border-green-300 dark:border-green-900 focus:ring-green-500 focus:border-green-500'
                                                            : 'border-slate-200 dark:border-slate-700 focus:ring-orange-500 focus:border-orange-500'
                                                } bg-white dark:bg-[#1e1c2e] text-slate-900 dark:text-white shadow-sm py-3 px-4 text-base transition-all`}
                                            />
                                            <span className="inline-flex items-center px-4 py-3 rounded-r-lg border border-l-0 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm font-medium">
                                                .genweb.in
                                            </span>
                                        </div>
                                        
                                        {/* Status Indicators */}
                                        <div className="absolute right-[110px] top-3">
                                            {subdomainStatus === 'checking' && <div className="animate-spin w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full"></div>}
                                            {subdomainStatus === 'available' && <Check className="w-5 h-5 text-green-500" />}
                                            {subdomainStatus === 'unavailable' && <X className="w-5 h-5 text-red-500" />}
                                        </div>
                                    </div>
                                    
                                    {subdomainError && (
                                        <p className="mt-2 text-sm text-red-500">{subdomainError}</p>
                                    )}
                                    {subdomainStatus === 'available' && (
                                        <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                                            <span className="font-bold">Success!</span> This address is available.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="shrink-0 px-6 py-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50 dark:bg-[#1e1c2e] rounded-b-2xl">
                    <div className="flex items-center text-slate-700 dark:text-slate-300">
                        <span className="mr-2 text-sm">Balance:</span>
                        <span className="font-bold text-orange-500">{currentCredits || 0} Credits</span>
                    </div>
                    <div className="flex space-x-3 w-full sm:w-auto">
                        <button 
                            onClick={onClose} 
                            className="flex-1 sm:flex-none px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        {(() => {
                            const credits = Number(currentCredits || 0);
                            const cost = selectedPlan ? Number(selectedPlan.cost) : 0;
                            const canAfford = credits >= cost;
                            const isSubdomainValid = subdomainStatus === 'available' || (subdomainStatus === 'idle' && !subdomain); // Block if unavailable
                            // Actually, block if idle too if we require a subdomain? 
                            // Yes, require subdomain.
                            const isReady = selectedPlan && canAfford && subdomainStatus === 'available';

                            let buttonText = "Select a Plan";
                            let isDisabled = true;
                            let buttonClass = "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed";

                            if (loading) {
                                buttonText = "Publishing...";
                                buttonClass = "bg-orange-500 text-white opacity-70 cursor-wait";
                                isDisabled = true;
                            } else if (selectedPlan) {
                                if (!canAfford) {
                                    buttonText = "Insufficient Credits";
                                    isDisabled = true;
                                    buttonClass = "bg-red-100 dark:bg-red-900/30 text-red-500 border border-red-200 dark:border-red-900/50 cursor-not-allowed";
                                } else if (!isReady) {
                                    buttonText = "Choose Domain";
                                    isDisabled = true;
                                } else {
                                    buttonText = (
                                        <>
                                            Unlock & Publish
                                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs ml-1">-{cost}</span>
                                        </>
                                    );
                                    isDisabled = false;
                                    buttonClass = "bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-500/20";
                                }
                            }

                            return (
                                <button
                                    onClick={handlePublish}
                                    disabled={isDisabled}
                                    className={`flex-1 sm:flex-none px-6 py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${buttonClass}`}
                                >
                                    {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                                    {buttonText}
                                </button>
                            );
                        })()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublishModal;
