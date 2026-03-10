import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MySites from './pages/MySites';
import Builder from './pages/Builder'; // Updated Builder Flow
import Editor from './pages/Editor';
import Domains from './pages/Domains';
import Leads from './pages/Leads';
import Credits from './pages/Credits';
import Referral from './pages/Referral';
import Settings from './pages/Settings';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import { ThemeProvider } from './context/ThemeContext';
import { CreditsProvider } from './context/CreditsContext';

function App() {
  return (
    <ThemeProvider>
      <CreditsProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/sites"
              element={
                <PrivateRoute>
                  <Layout>
                    <MySites />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/builder"
              element={
                <PrivateRoute>
                  <Layout>
                    <Builder />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/domains"
              element={
                <PrivateRoute>
                  <Layout>
                    <Domains />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/leads"
              element={
                <PrivateRoute>
                  <Layout>
                    <Leads />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/credits"
              element={
                <PrivateRoute>
                  <Layout>
                    <Credits />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/referral"
              element={
                <PrivateRoute>
                  <Layout>
                    <Referral />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <PrivateRoute>
                  <Layout>
                    <Settings />
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/editor/:projectId"
              element={
                <PrivateRoute>
                  <Editor />
                </PrivateRoute>
              }
            />
          </Routes>
        </Router>
      </CreditsProvider>
    </ThemeProvider>
  );
}

export default App;