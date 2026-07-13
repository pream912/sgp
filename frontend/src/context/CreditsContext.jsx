import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getCurrentUser } from '../lib/auth';
import { subscribe } from '../lib/sse';

const CreditsContext = createContext();
export const useCredits = () => useContext(CreditsContext);

export const CreditsProvider = ({ children }) => {
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCredits = useCallback(async () => {
    if (!getCurrentUser()) {
      setCredits(0);
      setLoading(false);
      return;
    }
    try {
      const { data } = await axios.get('/api/credits');
      setCredits(data.credits || 0);
    } catch (err) {
      console.error('Failed to fetch credits:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getCurrentUser()) {
      setLoading(false);
      return;
    }
    fetchCredits();
    const off = subscribe('credits', (data) => {
      if (data && typeof data.balance === 'number') setCredits(data.balance);
    });
    return () => off && off();
  }, [fetchCredits]);

  return (
    <CreditsContext.Provider value={{ credits, loading, fetchCredits }}>
      {children}
    </CreditsContext.Provider>
  );
};
