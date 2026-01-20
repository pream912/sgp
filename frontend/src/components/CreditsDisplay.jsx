import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { auth } from '../firebase';
import { Wallet } from 'lucide-react';

const CreditsDisplay = ({ refreshTrigger }) => {
    const [credits, setCredits] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchCredits = async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;
            
            const response = await axios.get('/api/credits', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCredits(response.data.credits);
        } catch (error) {
            console.error('Error fetching credits:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCredits();
        // Poll every 30 seconds or listen to refresh trigger
        const interval = setInterval(fetchCredits, 30000);
        return () => clearInterval(interval);
    }, [refreshTrigger]);

    if (loading) return <div className="animate-pulse h-6 w-16 bg-gray-200 rounded"></div>;

    return (
        <div className="flex items-center text-gray-700 dark:text-gray-300 font-medium bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
            <Wallet className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
            <span>{credits} Credits</span>
        </div>
    );
};

export default CreditsDisplay;
