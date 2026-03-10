import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AdminRoute from './components/AdminRoute';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import UserDetail from './pages/UserDetail';
import Revenue from './pages/Revenue';
import TokenUsage from './pages/TokenUsage';
import Sites from './pages/Sites';
import Settings from './pages/Settings';
import Referrals from './pages/Referrals';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<AdminRoute><AdminLayout><Dashboard /></AdminLayout></AdminRoute>} />
          <Route path="/users" element={<AdminRoute><AdminLayout><Users /></AdminLayout></AdminRoute>} />
          <Route path="/users/:uid" element={<AdminRoute><AdminLayout><UserDetail /></AdminLayout></AdminRoute>} />
          <Route path="/revenue" element={<AdminRoute><AdminLayout><Revenue /></AdminLayout></AdminRoute>} />
          <Route path="/tokens" element={<AdminRoute><AdminLayout><TokenUsage /></AdminLayout></AdminRoute>} />
          <Route path="/sites" element={<AdminRoute><AdminLayout><Sites /></AdminLayout></AdminRoute>} />
          <Route path="/settings" element={<AdminRoute><AdminLayout><Settings /></AdminLayout></AdminRoute>} />
          <Route path="/referrals" element={<AdminRoute><AdminLayout><Referrals /></AdminLayout></AdminRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
