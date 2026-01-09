import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
// import Builder from './pages/Builder'; // Old Builder
import NewBuilder from './pages/NewBuilder'; // New Builder
import Editor from './pages/Editor';
import PrivateRoute from './components/PrivateRoute';
import { ThemeProvider } from './context/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/builder"
            element={
              <PrivateRoute>
                <NewBuilder />
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
    </ThemeProvider>
  );
}

export default App;