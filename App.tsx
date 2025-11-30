import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import LoginPage from './components/LoginPage';
import DashboardPage from './components/DashboardPage';
import CampaignsList from './components/CampaignsList';
import SubscribersList from './components/SubscribersList';
import TemplatesList from './components/TemplatesList';
import SettingsPage from './components/SettingsPage';
import AdminDashboard from './components/AdminDashboard';
import LandingPage from './components/LandingPage';
import Layout from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isSuperAdmin: boolean;
  paymentStatus: string;
  demoStartedAt?: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        localStorage.removeItem('token');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (token: string, userData: User) => {
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Toaster position="top-right" richColors closeButton />
      <Router>
        <Routes>
          <Route path="/" element={user ? <Navigate to="/dashboard" /> : <LandingPage />} />
          <Route 
            path="/login" 
            element={user ? <Navigate to="/dashboard" /> : <LoginPage onLogin={handleLogin} />} 
          />
          <Route
            path="/dashboard"
            element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <DashboardPage />
                </Layout>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/campaigns"
            element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <CampaignsList />
                </Layout>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/subscribers"
            element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <SubscribersList />
                </Layout>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/templates"
            element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <TemplatesList />
                </Layout>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/settings"
            element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <SettingsPage />
                </Layout>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/admin"
            element={
              user?.isSuperAdmin ? (
                <Layout user={user} onLogout={handleLogout}>
                  <AdminDashboard />
                </Layout>
              ) : (
                <Navigate to="/campaigns" />
              )
            }
          />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
