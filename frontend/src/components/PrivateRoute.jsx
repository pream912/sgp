import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

const PrivateRoute = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
            const token = await currentUser.getIdToken();
            // Set cookie for backend verification (iframe access)
            document.cookie = `access_token=${token}; path=/; max-age=3600`; 
        } catch (e) {
            console.error('Error setting token cookie:', e);
        }
      }
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  return user ? children : <Navigate to="/login" />;
};

export default PrivateRoute;
