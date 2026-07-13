import React, { createContext, useContext, useState } from 'react';
import { getCurrentUser } from '../lib/auth';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user] = useState(() => getCurrentUser());
  return (
    <AuthContext.Provider value={{ user, isAdmin: !!user?.isAdmin, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
};
