import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getCurrentUser } from '../lib/auth';

const PrivateRoute = ({ children }) => {
  const [user] = useState(() => getCurrentUser());
  if (!user) return <Navigate to="/login" />;
  return children;
};

export default PrivateRoute;
