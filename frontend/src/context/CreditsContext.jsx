import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

const CreditsContext = createContext();

export const useCredits = () => useContext(CreditsContext);

export const CreditsProvider = ({ children }) => {
    const [credits, setCredits] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchCredits = useCallback(async () => {
        try {
            const user = auth.currentUser;
            if (!user) {
                return;
            }
            
            const token = await user.getIdToken();
            const response = await axios.get('/api/credits', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCredits(response.data.credits);
        } catch (error) {
            console.error('Error fetching credits:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Listen for auth state changes to trigger initial fetch
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                fetchCredits();
            } else {
                setCredits(0);
                setLoading(false);
            }
        });
        
        // Poll every 30s
        const interval = setInterval(() => {
            if (auth.currentUser) fetchCredits();
        }, 30000);

        return () => {
            unsubscribe();
            clearInterval(interval);
        };
    }, [fetchCredits]);

    return (
        <CreditsContext.Provider value={{ credits, loading, fetchCredits }}>
            {children}
        </CreditsContext.Provider>
    );
};
