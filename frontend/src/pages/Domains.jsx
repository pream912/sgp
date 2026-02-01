import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { auth } from '../firebase';
import { Link } from 'react-router-dom';

const Domains = () => {
    // State
    const [view, setView] = useState('search'); // 'search' | 'mine'
    const [domain, setDomain] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [myDomains, setMyDomains] = useState([]);
    const [loadingDomains, setLoadingDomains] = useState(true);
    
    // Purchase State
    const [selectedDomain, setSelectedDomain] = useState(null);
    const [purchaseStep, setPurchaseStep] = useState('search'); // 'search', 'form', 'success'
    const [purchasing, setPurchasing] = useState(false);
    const [purchaseError, setPurchaseError] = useState(null);

    // Contact Form Data
    const [contact, setContact] = useState({
        nameFirst: '', nameLast: '', email: '', phone: '',
        addressMailing: { address1: '', city: '', state: '', postalCode: '', country: 'US' }
    });

    useEffect(() => {
        fetchMyDomains();
    }, []);

    const fetchMyDomains = async () => {
        try {
            const token = await auth.currentUser.getIdToken();
            const response = await axios.get('/api/domains', { headers: { Authorization: `Bearer ${token}` } });
            setMyDomains(response.data);
        } catch (error) {
            console.error('Failed to fetch domains:', error);
        } finally {
            setLoadingDomains(false);
        }
    };

    const checkAvailability = async () => {
        if (!domain) return;
        setLoading(true);
        setResult(null);
        setSuggestions([]);
        
        try {
            const token = await auth.currentUser.getIdToken();
            const headers = { Authorization: `Bearer ${token}` };
            const searchDomain = domain.includes('.') ? domain : `${domain}.com`;
            
            const checkPromise = axios.get(`/api/domains/check?domain=${searchDomain}`, { headers });
            const queryTerm = domain.split('.')[0];
            const suggestPromise = axios.get(`/api/domains/suggest?query=${queryTerm}`, { headers });

            const [checkRes, suggestRes] = await Promise.all([checkPromise, suggestPromise]);
            setResult(checkRes.data);
            setSuggestions(suggestRes.data || []);
        } catch (error) {
            console.error(error);
            setResult({ error: 'Failed to check availability' });
        } finally {
            setLoading(false);
        }
    };

    const initPurchase = (domainToBuy) => {
        setSelectedDomain(domainToBuy);
        setPurchaseStep('form');
        setPurchaseError(null);
    };

    const handlePurchase = async (e) => {
        e.preventDefault();
        setPurchasing(true);
        setPurchaseError(null);
        try {
            const token = await auth.currentUser.getIdToken();
            const response = await axios.post('/api/domains/buy', {
                domain: selectedDomain,
                contactInfo: contact
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            setPurchaseStep('success');
            fetchMyDomains();
        } catch (error) {
            console.error(error);
            setPurchaseError(error.response?.data?.error || 'Purchase failed');
        } finally {
            setPurchasing(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setContact(prev => ({ ...prev, [parent]: { ...prev[parent], [child]: value } }));
        } else {
            setContact(prev => ({ ...prev, [name]: value }));
        }
    };

    return (
        <div className="mx-auto max-w-5xl flex flex-col gap-8">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-slate-900 dark:text-white text-3xl md:text-4xl font-black tracking-tight">Domains</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-base max-w-2xl">Manage your custom domains, configure DNS settings, or acquire new digital assets for your project.</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200 dark:border-slate-700">
                <div className="flex gap-8">
                    <button 
                        onClick={() => { setView('search'); setPurchaseStep('search'); }}
                        className={`group flex flex-col items-center justify-center border-b-2 pb-3 pt-2 px-1 ${view === 'search' ? 'border-orange-500' : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'}`}
                    >
                        <span className={`${view === 'search' ? 'text-orange-500' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'} text-sm font-semibold tracking-wide`}>Buy Domain</span>
                    </button>
                    <button 
                        onClick={() => setView('mine')}
                        className={`group flex flex-col items-center justify-center border-b-2 pb-3 pt-2 px-1 ${view === 'mine' ? 'border-orange-500' : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'}`}
                    >
                        <span className={`${view === 'mine' ? 'text-orange-500' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'} text-sm font-semibold tracking-wide`}>My Domains</span>
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex flex-col gap-8 animate-fade-in">
                
                {view === 'search' && purchaseStep === 'search' && (
                    <>
                        {/* Search Box */}
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-1">
                            <div className="flex flex-col md:flex-row gap-2 p-1">
                                <div className="flex-1 relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <span className="material-symbols-outlined text-slate-400">search</span>
                                    </div>
                                    <input 
                                        className="block w-full pl-11 pr-4 py-3.5 bg-transparent border-none text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-0 text-lg" 
                                        placeholder="Find your perfect domain (e.g., nebula-ai.com)..." 
                                        type="text"
                                        value={domain}
                                        onChange={(e) => setDomain(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && checkAvailability()}
                                    />
                                </div>
                                <button 
                                    onClick={checkAvailability}
                                    disabled={loading}
                                    className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold text-base shadow-sm transition-all md:w-auto w-full disabled:opacity-70"
                                >
                                    {loading ? 'Searching...' : 'Search'}
                                </button>
                            </div>
                        </div>

                        {/* Results */}
                        {result && (
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-slate-900 dark:text-white font-bold text-lg flex items-center gap-2">
                                        <span className="material-symbols-outlined text-orange-500">auto_awesome</span>
                                        Results
                                    </h3>
                                </div>
                                
                                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                                    <ul>
                                        {/* Exact Match */}
                                        <li className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className={`rounded p-2 ${result.available ? 'bg-orange-500/10 text-orange-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                    <span className="material-symbols-outlined text-[20px]">{result.available ? 'check_circle' : 'block'}</span>
                                                </div>
                                                <div>
                                                    <p className="font-mono text-slate-900 dark:text-white font-medium">{result.domain}</p>
                                                    <span className={`text-xs ${result.available ? 'text-orange-500' : 'text-slate-400'}`}>{result.available ? 'Available' : 'Taken'}</span>
                                                </div>
                                            </div>
                                            {result.available && (
                                                <div className="flex items-center gap-4">
                                                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                                        {result.priceDisplay ? result.priceDisplay.display : `$${(result.price / 1000000).toFixed(2)}`}
                                                    </span>
                                                    <button 
                                                        onClick={() => initPurchase(result.domain)}
                                                        className="size-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-orange-500 hover:border-orange-500 transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                                                    </button>
                                                </div>
                                            )}
                                        </li>
                                        
                                        {/* Suggestions */}
                                        {suggestions.map((s) => (
                                            <li key={s.domain} className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className={`rounded p-2 ${s.available ? 'bg-orange-500/10 text-orange-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                        <span className="material-symbols-outlined text-[20px]">{s.available ? 'check_circle' : 'block'}</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-mono text-slate-900 dark:text-white font-medium">{s.domain}</p>
                                                        <span className={`text-xs ${s.available ? 'text-orange-500' : 'text-slate-400'}`}>{s.available ? 'Available' : 'Taken'}</span>
                                                    </div>
                                                </div>
                                                {s.available && (
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                                            {s.priceDisplay ? s.priceDisplay.display : '-'}
                                                        </span>
                                                        <button 
                                                            onClick={() => initPurchase(s.domain)}
                                                            className="size-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-orange-500 hover:border-orange-500 transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Purchase Form */}
                {view === 'search' && purchaseStep === 'form' && (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8">
                        <div className="mb-6 pb-6 border-b border-slate-200 dark:border-slate-700">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Complete Registration for {selectedDomain}</h2>
                            <p className="text-sm text-slate-500">Enter the contact information for the domain owner.</p>
                        </div>
                        
                        {purchaseError && (
                            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded mb-6">
                                {purchaseError}
                            </div>
                        )}

                        <form onSubmit={handlePurchase} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">First Name</label>
                                    <input required type="text" name="nameFirst" value={contact.nameFirst} onChange={handleInputChange} 
                                        className="w-full rounded-md border-slate-300 dark:border-slate-600 dark:bg-slate-700 shadow-sm focus:border-orange-500 focus:ring-orange-500 text-slate-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Last Name</label>
                                    <input required type="text" name="nameLast" value={contact.nameLast} onChange={handleInputChange} 
                                        className="w-full rounded-md border-slate-300 dark:border-slate-600 dark:bg-slate-700 shadow-sm focus:border-orange-500 focus:ring-orange-500 text-slate-900 dark:text-white" />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Email</label>
                                <input required type="email" name="email" value={contact.email} onChange={handleInputChange} 
                                    className="w-full rounded-md border-slate-300 dark:border-slate-600 dark:bg-slate-700 shadow-sm focus:border-orange-500 focus:ring-orange-500 text-slate-900 dark:text-white" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Phone (e.g., +1.5555555555)</label>
                                <input required type="text" name="phone" placeholder="+1.5555555555" value={contact.phone} onChange={handleInputChange} 
                                    className="w-full rounded-md border-slate-300 dark:border-slate-600 dark:bg-slate-700 shadow-sm focus:border-orange-500 focus:ring-orange-500 text-slate-900 dark:text-white" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Address</label>
                                <input required type="text" name="addressMailing.address1" value={contact.addressMailing.address1} onChange={handleInputChange} 
                                    className="w-full rounded-md border-slate-300 dark:border-slate-600 dark:bg-slate-700 shadow-sm focus:border-orange-500 focus:ring-orange-500 text-slate-900 dark:text-white" />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">City</label>
                                    <input required type="text" name="addressMailing.city" value={contact.addressMailing.city} onChange={handleInputChange} 
                                        className="w-full rounded-md border-slate-300 dark:border-slate-600 dark:bg-slate-700 shadow-sm focus:border-orange-500 focus:ring-orange-500 text-slate-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">State</label>
                                    <input required type="text" name="addressMailing.state" value={contact.addressMailing.state} onChange={handleInputChange} 
                                        className="w-full rounded-md border-slate-300 dark:border-slate-600 dark:bg-slate-700 shadow-sm focus:border-orange-500 focus:ring-orange-500 text-slate-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Zip/Postal</label>
                                    <input required type="text" name="addressMailing.postalCode" value={contact.addressMailing.postalCode} onChange={handleInputChange} 
                                        className="w-full rounded-md border-slate-300 dark:border-slate-600 dark:bg-slate-700 shadow-sm focus:border-orange-500 focus:ring-orange-500 text-slate-900 dark:text-white" />
                                </div>
                            </div>
                            
                            <div className="pt-4 flex justify-between">
                                <button type="button" onClick={() => setPurchaseStep('search')} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">Cancel</button>
                                <button type="submit" disabled={purchasing} 
                                    className="bg-orange-500 text-white px-6 py-2 rounded-md hover:bg-orange-600 disabled:opacity-50">
                                    {purchasing ? 'Processing...' : 'Complete Purchase'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
                
                {/* Purchase Success */}
                {view === 'search' && purchaseStep === 'success' && (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
                        <div className="mx-auto flex items-center justify-center size-16 rounded-full bg-green-100 dark:bg-green-900 mb-6">
                            <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-3xl">check</span>
                        </div>
                        <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Domain Purchased!</h2>
                        <p className="text-slate-600 dark:text-slate-400 mb-6">
                            You have successfully registered <strong>{selectedDomain}</strong>.
                        </p>
                        <button onClick={() => { setView('mine'); setPurchaseStep('search'); }} className="text-orange-500 hover:text-orange-600 font-medium">
                            View My Domains
                        </button>
                    </div>
                )}

                {/* My Domains */}
                {view === 'mine' && (
                     <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                                        <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Domain Name</th>
                                        <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Status</th>
                                        <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Purchase Date</th>
                                        <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {loadingDomains ? (
                                        <tr><td colSpan="4" className="py-8 text-center text-slate-500">Loading domains...</td></tr>
                                    ) : myDomains.length === 0 ? (
                                        <tr><td colSpan="4" className="py-8 text-center text-slate-500">No domains found.</td></tr>
                                    ) : (
                                        myDomains.map((d) => (
                                            <tr key={d.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="py-4 px-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded text-slate-500">
                                                            <span className="material-symbols-outlined text-[18px]">language</span>
                                                        </div>
                                                        <span className="font-mono text-sm font-medium text-slate-700 dark:text-white">{d.domain}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-800">
                                                        <span className="size-1.5 rounded-full bg-green-500"></span>
                                                        Active
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <span className="text-sm text-slate-700 dark:text-slate-400">
                                                        {d.createdAt && new Date(d.createdAt._seconds * 1000).toLocaleDateString()}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 text-right">
                                                    <button className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
                                                        <span className="material-symbols-outlined text-[16px] mr-2">settings</span>
                                                        DNS Settings
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                     </div>
                )}
            </div>
        </div>
    );
};

export default Domains;