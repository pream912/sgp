import React from 'react';
import { Wallet } from 'lucide-react';
import { useCredits } from '../context/CreditsContext';

const CreditsDisplay = () => {
    const { credits, loading } = useCredits();

    if (loading) return <div className="animate-pulse h-6 w-16 bg-gray-200 rounded"></div>;

    return (
        <div className="flex items-center text-gray-700 dark:text-gray-300 font-medium bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
            <Wallet className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
            <span>{credits} Credits</span>
        </div>
    );
};

export default CreditsDisplay;