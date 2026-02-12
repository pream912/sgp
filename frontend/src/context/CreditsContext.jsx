import React, { createContext, useState, useContext, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

const CreditsContext = createContext();

export const useCredits = () => useContext(CreditsContext);

export const CreditsProvider = ({ children }) => {
    const [credits, setCredits] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeCredits = null;

        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                // Real-time listener for user credits
                const userRef = doc(db, 'users', user.uid);
                unsubscribeCredits = onSnapshot(userRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setCredits(docSnap.data().credits || 0);
                    } else {
                        setCredits(0);
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Error listening to credits:", error);
                    setLoading(false);
                });
            } else {
                setCredits(0);
                setLoading(false);
                if (unsubscribeCredits) unsubscribeCredits();
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeCredits) unsubscribeCredits();
        };
    }, []);

    // Real-time listener handles updates automatically.
    const fetchCredits = () => {};

    return (
        <CreditsContext.Provider value={{ credits, loading, fetchCredits }}>
            {children}
        </CreditsContext.Provider>
    );
};
