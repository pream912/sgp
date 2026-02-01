import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { X, ExternalLink } from 'lucide-react';

const BuyCreditsModal = ({ isOpen, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [creditsToBuy, setCreditsToBuy] = useState(500); // Default value
    const [cost, setCost] = useState(500);

    useEffect(() => {
        // 1 Credit = 1 INR
        setCost(creditsToBuy);
    }, [creditsToBuy]);

    const handleProceed = async () => {
        if (creditsToBuy < 200) {
            alert('Minimum purchase is 200 credits.');
            return;
        }

        setLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) {
                alert('You must be logged in.');
                return;
            }
            
            const token = await user.getIdToken();
            const uid = user.uid;
            
            // Construct Redirect URL
            // Using production domain as requested
            const baseUrl = 'https://genweb.in/buycredits.html'; 
            const url = `${baseUrl}?uid=${uid}&token=${token}&amount=${cost}&credits=${creditsToBuy}`;
            
            // Open in new tab or same tab? "link should open" usually implies new tab for payment flows to avoid losing context, 
            // but "proceed to buy" might mean main flow. 
            // Let's use window.location.href to follow the "redirect" instruction closely, 
            // or window.open if they want to keep the app open.
            // "a link should open" -> usually means new window/tab.
            window.open(url, '_blank');
            
            onClose();
        } catch (error) {
            console.error('Failed to prepare purchase:', error);
            alert('Failed to initiate purchase.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                    <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
                </div>

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="relative z-50 inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                    <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                                Top Up Wallet
                            </h3>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        
                        <div className="mt-4 space-y-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Enter the number of credits you wish to purchase. <br/>
                                <span className="font-semibold">Rate: 1 Credit = ₹1.00</span>
                            </p>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Credits to Buy (Min. 200)
                                </label>
                                <input
                                    type="number"
                                    min="200"
                                    step="100"
                                    value={creditsToBuy}
                                    onChange={(e) => setCreditsToBuy(parseInt(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                                />
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md flex justify-between items-center">
                                <span className="text-gray-700 dark:text-gray-200 font-medium">Total Cost:</span>
                                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">₹{cost}</span>
                            </div>

                            <button
                                onClick={handleProceed}
                                disabled={loading || creditsToBuy < 200}
                                className="w-full flex justify-center items-center px-4 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Processing...' : 'Proceed to Buy'}
                                <ExternalLink className="ml-2 w-4 h-4" />
                            </button>
                            
                            <p className="text-xs text-center text-gray-500 mt-2">
                                A secure payment page will open in a new tab.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BuyCreditsModal;
