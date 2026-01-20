import React, { useState } from 'react';
import axios from 'axios';
import { auth } from '../firebase';
import { X, Check } from 'lucide-react';

const PACKAGES = [
    { credits: 500, price: 500, name: 'Starter' },
    { credits: 1000, price: 900, name: 'Pro (Save 10%)' },
    { credits: 3000, price: 2500, name: 'Agency (Save 16%)' }
];

const BuyCreditsModal = ({ isOpen, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);

    const handleBuy = async (pkg) => {
        setLoading(true);
        try {
            const token = await auth.currentUser.getIdToken();
            
            // 1. Create Order
            const orderRes = await axios.post('/api/credits/buy', 
                { amount: pkg.price, credits: pkg.credits },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            const { order } = orderRes.data;

            // 2. Open Razorpay
            const options = {
                key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY_ID', // Use env var
                amount: order.amount,
                currency: order.currency,
                name: "Site Builder Credits",
                description: `Purchase ${pkg.credits} Credits`,
                order_id: order.id,
                handler: async function (response) {
                    try {
                        // 3. Verify Payment
                        await axios.post('/api/credits/verify', {
                            orderId: response.razorpay_order_id,
                            paymentId: response.razorpay_payment_id,
                            signature: response.razorpay_signature,
                            credits: pkg.credits,
                            amount: pkg.price
                        }, { headers: { Authorization: `Bearer ${token}` } });
                        
                        onSuccess();
                        onClose();
                        alert('Credits added successfully!');
                    } catch (err) {
                        console.error('Verification failed', err);
                        alert('Payment verification failed.');
                    }
                },
                prefill: {
                    name: auth.currentUser.displayName || '',
                    email: auth.currentUser.email || '',
                },
                theme: {
                    color: "#4f46e5"
                }
            };
            
            const rzp = new window.Razorpay(options);
            rzp.open();
            
        } catch (error) {
            console.error('Purchase failed:', error);
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

                <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                    <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="flex justify-between items-start">
                            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                                Top Up Wallet
                            </h3>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="mt-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                Use credits to generate sites, redesign sections, and publish your work.
                            </p>
                            
                            <div className="space-y-3">
                                {PACKAGES.map((pkg) => (
                                    <button
                                        key={pkg.credits}
                                        onClick={() => handleBuy(pkg)}
                                        disabled={loading}
                                        className="w-full flex justify-between items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all group"
                                    >
                                        <div className="text-left">
                                            <div className="font-semibold text-gray-900 dark:text-white">
                                                {pkg.credits} Credits
                                            </div>
                                            <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                                                {pkg.name}
                                            </div>
                                        </div>
                                        <div className="flex items-center font-bold text-gray-900 dark:text-white">
                                            ₹{pkg.price}
                                            {loading && <div className="ml-2 animate-spin h-4 w-4 border-2 border-indigo-600 rounded-full border-t-transparent"></div>}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BuyCreditsModal;
