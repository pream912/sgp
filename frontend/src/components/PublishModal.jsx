import React, { useState } from 'react';
import axios from 'axios';
import { auth } from '../firebase';
import { X, Check, Globe, Lock, AlertCircle } from 'lucide-react';

const PLANS = [
    { id: 'basic', name: 'Basic', cost: 500, features: ['Publish to .genweb.in subdomain', 'Hosting included', 'SSL Certificate'] },
    { id: 'single', name: 'Single Page', cost: 2000, features: ['Connect Custom Domain', 'No Branding', 'Priority Hosting', 'SSL Certificate'] },
    { id: 'multi', name: 'Multi Page', cost: 3000, features: ['Connect Custom Domain', 'Unlimited Pages', 'No Branding', 'Premium Hosting'] }
];

const PublishModal = ({ isOpen, onClose, projectId, currentCredits, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);

    const handlePublish = async () => {
        if (!selectedPlan) return;
        setLoading(true);
        try {
            const token = await auth.currentUser.getIdToken();
            await axios.post(`/api/project/${projectId}/publish`, {
                plan: selectedPlan.id
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            onSuccess();
            onClose();
            alert('Site published successfully!');
        } catch (error) {
            console.error('Publish failed:', error);
            alert(error.response?.data?.error || 'Failed to publish');
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

                <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl w-full">
                    <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Publish Your Site</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Select a plan to launch your website.</p>
                            </div>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            {PLANS.map((plan) => {
                                const isAffordable = currentCredits >= plan.cost;
                                const isSelected = selectedPlan?.id === plan.id;
                                
                                return (
                                    <div 
                                        key={plan.id}
                                        onClick={() => setSelectedPlan(plan)}
                                        className={`relative border-2 rounded-xl p-6 cursor-pointer transition-all ${isSelected ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700'}`}
                                    >
                                        {isSelected && <div className="absolute top-4 right-4 text-indigo-600"><Check className="h-6 w-6" /></div>}
                                        <h4 className="text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h4>
                                        <div className="mt-2 flex items-baseline">
                                            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">{plan.cost}</span>
                                            <span className="ml-1 text-gray-500 dark:text-gray-400">Credits</span>
                                        </div>
                                        <ul className="mt-6 space-y-4">
                                            {plan.features.map((feature, idx) => (
                                                <li key={idx} className="flex items-start">
                                                    <Check className="h-5 w-5 text-green-500 mr-2 shrink-0" />
                                                    <span className="text-sm text-gray-600 dark:text-gray-300">{feature}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex items-center justify-between border-t pt-6 dark:border-gray-700">
                            <div className="flex items-center text-gray-700 dark:text-gray-300">
                                <span className="mr-2">Your Balance:</span>
                                <span className="font-bold">{currentCredits} Credits</span>
                                {selectedPlan && currentCredits < selectedPlan.cost && (
                                    <span className="ml-4 text-red-500 text-sm flex items-center">
                                        <AlertCircle className="w-4 h-4 mr-1" /> Insufficient credits
                                    </span>
                                )}
                            </div>
                            <div className="flex space-x-3">
                                <button onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                                    Cancel
                                </button>
                                <button
                                    onClick={handlePublish}
                                    disabled={loading || !selectedPlan || currentCredits < selectedPlan.cost}
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                >
                                    {loading ? 'Publishing...' : `Unlock with ${selectedPlan ? selectedPlan.cost : ''} Credits`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublishModal;
