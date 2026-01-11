import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { auth } from '../firebase';
import { Search, ShoppingCart, Check, X, Loader, Globe, Layout, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const Domains = () => {
    const [domain, setDomain] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [purchasing, setPurchasing] = useState(false);
    const [purchaseStep, setPurchaseStep] = useState('search'); // search, form, success, error
    const [purchaseError, setPurchaseError] = useState(null);
    const [orderResult, setOrderResult] = useState(null);
    const [selectedDomain, setSelectedDomain] = useState(null);
    
    // My Domains State
    const [myDomains, setMyDomains] = useState([]);
    const [loadingDomains, setLoadingDomains] = useState(true);
    const [view, setView] = useState('search'); // 'search' or 'mine'

    // Form Data for Purchase
    const [contact, setContact] = useState({
        nameFirst: '',
        nameLast: '',
        email: '',
        phone: '',
        addressMailing: {
            address1: '',
            city: '',
            state: '',
            postalCode: '',
            country: 'US'
        }
    });

    useEffect(() => {
        fetchMyDomains();
    }, []);

    const fetchMyDomains = async () => {
        try {
            const token = await auth.currentUser.getIdToken();
            const response = await axios.get('/api/domains', {
                headers: { Authorization: `Bearer ${token}` }
            });
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

            // Check specific domain
            // If domain doesn't have a TLD, assume .com for the check
            const searchDomain = domain.includes('.') ? domain : `${domain}.com`;
            
            const checkPromise = axios.get(`/api/domains/check?domain=${searchDomain}`, { headers });
            
            // Get suggestions based on the query (without TLD preferred for better suggestions)
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
        setView('search');
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
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setOrderResult(response.data);
            setPurchaseStep('success');
            fetchMyDomains(); // Refresh list
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
            setContact(prev => ({
                ...prev,
                [parent]: {
                    ...prev[parent],
                    [child]: value
                }
            }));
        } else {
            setContact(prev => ({ ...prev, [name]: value }));
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
            <nav className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <Link to="/" className="text-xl font-bold">Site Builder</Link>
                            <span className="mx-2 text-gray-400">/</span>
                            <span className="font-semibold">Domains</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <button 
                                onClick={() => setView('search')}
                                className={`px-3 py-2 rounded-md text-sm font-medium ${view === 'search' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                            >
                                Buy Domains
                            </button>
                            <button 
                                onClick={() => setView('mine')}
                                className={`px-3 py-2 rounded-md text-sm font-medium ${view === 'mine' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                            >
                                My Domains ({myDomains.length})
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                
                {view === 'mine' ? (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-xl font-bold">My Domains</h2>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Domains you have purchased on this platform.</p>
                        </div>
                        
                        {loadingDomains ? (
                            <div className="p-12 text-center text-gray-500">Loading...</div>
                        ) : myDomains.length === 0 ? (
                            <div className="p-12 text-center">
                                <Globe className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">No domains yet</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-6">Search for a domain to get started.</p>
                                <button 
                                    onClick={() => setView('search')}
                                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                                >
                                    Search Domains
                                </button>
                            </div>
                        ) : (
                            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                                {myDomains.map((domain) => (
                                    <li key={domain.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center">
                                                <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full mr-4">
                                                    <Globe className="h-6 w-6 text-green-600 dark:text-green-400" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{domain.domain}</h3>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        Purchased: {domain.createdAt && new Date(domain.createdAt._seconds * 1000).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                                Active
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : (
                    // Search View (Existing Code wrapped)
                    <>
                
                {purchaseStep === 'success' ? (
                     <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 mb-6">
                            <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
                        </div>
                        <h2 className="text-2xl font-bold mb-4">Domain Purchased!</h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            You have successfully registered <strong>{selectedDomain}</strong>.
                        </p>
                        <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded text-left overflow-auto mb-6">
                            <pre className="text-xs">{JSON.stringify(orderResult, null, 2)}</pre>
                        </div>
                        <Link to="/" className="text-indigo-600 hover:text-indigo-500 font-medium">
                            Back to Dashboard
                        </Link>
                    </div>
                ) : purchaseStep === 'form' ? (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
                         <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-xl font-bold">Complete Registration for {selectedDomain}</h2>
                            <p className="text-sm text-gray-500">Enter the contact information for the domain owner.</p>
                        </div>
                        
                        {purchaseError && (
                            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded mb-6">
                                {purchaseError}
                            </div>
                        )}

                        <form onSubmit={handlePurchase} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">First Name</label>
                                    <input required type="text" name="nameFirst" value={contact.nameFirst} onChange={handleInputChange} 
                                        className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Last Name</label>
                                    <input required type="text" name="nameLast" value={contact.nameLast} onChange={handleInputChange} 
                                        className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium mb-1">Email</label>
                                <input required type="email" name="email" value={contact.email} onChange={handleInputChange} 
                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                            </div>

                             <div>
                                <label className="block text-sm font-medium mb-1">Phone (e.g., +1.5555555555)</label>
                                <input required type="text" name="phone" placeholder="+1.5555555555" value={contact.phone} onChange={handleInputChange} 
                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Address</label>
                                <input required type="text" name="addressMailing.address1" value={contact.addressMailing.address1} onChange={handleInputChange} 
                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">City</label>
                                    <input required type="text" name="addressMailing.city" value={contact.addressMailing.city} onChange={handleInputChange} 
                                        className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">State</label>
                                    <input required type="text" name="addressMailing.state" value={contact.addressMailing.state} onChange={handleInputChange} 
                                        className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Zip/Postal</label>
                                    <input required type="text" name="addressMailing.postalCode" value={contact.addressMailing.postalCode} onChange={handleInputChange} 
                                        className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                                </div>
                            </div>
                            
                            <div className="pt-4 flex justify-between">
                                <button type="button" onClick={() => setPurchaseStep('search')} className="text-gray-600 dark:text-gray-400 hover:text-gray-900">Cancel</button>
                                <button type="submit" disabled={purchasing} 
                                    className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50">
                                    {purchasing ? 'Processing...' : 'Complete Purchase'}
                                </button>
                            </div>
                        </form>
                    </div>

                ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                        <div className="p-8 pb-12 text-center border-b border-gray-200 dark:border-gray-700">
                             <Globe className="h-12 w-12 text-indigo-500 mx-auto mb-4" />
                            <h1 className="text-3xl font-bold mb-2">Find your perfect domain</h1>
                            <p className="text-gray-500 dark:text-gray-400 mb-8">Search for available domain names to launch your project.</p>
                            
                            <div className="relative max-w-xl mx-auto">
                                <input 
                                    type="text" 
                                    value={domain}
                                    onChange={(e) => setDomain(e.target.value)}
                                    placeholder="example.com" 
                                    className="w-full pl-4 pr-12 py-3 rounded-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    onKeyDown={(e) => e.key === 'Enter' && checkAvailability()}
                                />
                                <button 
                                    onClick={checkAvailability}
                                    className="absolute right-2 top-2 bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 transition-colors"
                                >
                                    {loading ? <Loader className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        {result && (
                            <div className="p-6 bg-gray-50 dark:bg-gray-900/50">
                                {result.error ? (
                                    <div className="text-center text-red-500 mb-6">
                                        <X className="h-8 w-8 mx-auto mb-2" />
                                        <p>{result.error}</p>
                                    </div>
                                ) : result.available ? (
                                    <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-green-200 dark:border-green-900 mb-6">
                                        <div className="flex items-center">
                                            <div className="bg-green-100 dark:bg-green-900 p-2 rounded-full mr-4">
                                                <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{result.domain}</h3>
                                                <p className="text-green-600 dark:text-green-400 font-medium">Available</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center">
                                             {result.priceDisplay ? (
                                                 <span className="text-xl font-bold mr-4 text-gray-700 dark:text-gray-300">{result.priceDisplay.display}</span>
                                             ) : result.price ? (
                                                 <span className="text-xl font-bold mr-4 text-gray-700 dark:text-gray-300">${(result.price / 1000000).toFixed(2)}</span>
                                             ) : null}
                                            <button 
                                                onClick={() => initPurchase(result.domain)}
                                                className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
                                            >
                                                <ShoppingCart className="h-4 w-4 mr-2" />
                                                Buy Now
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center text-gray-500 dark:text-gray-400 mb-6">
                                        <X className="h-5 w-5 mr-2" />
                                        <span>Sorry, <strong>{result.domain}</strong> is unavailable.</span>
                                    </div>
                                )}

                                {/* Suggestions Section */}
                                {suggestions.length > 0 && (
                                    <div className="mt-8">
                                        <h3 className="text-lg font-semibold mb-4 text-left">Suggested Domains</h3>
                                        <div className="space-y-3">
                                            {suggestions.map((suggestion) => (
                                                <div key={suggestion.domain} className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                                    <div className="text-left">
                                                        <span className="font-medium text-gray-900 dark:text-white block">{suggestion.domain}</span>
                                                        {suggestion.available && suggestion.priceDisplay && (
                                                            <span className="text-sm text-green-600 dark:text-green-400 font-medium">{suggestion.priceDisplay.display}</span>
                                                        )}
                                                    </div>
                                                    <button 
                                                        onClick={() => initPurchase(suggestion.domain)}
                                                        className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm font-medium flex items-center"
                                                    >
                                                        Buy <ShoppingCart className="h-3 w-3 ml-1" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
                    </>
                )}
            </main>
        </div>
    );
};

export default Domains;
