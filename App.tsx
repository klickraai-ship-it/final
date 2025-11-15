import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import CampaignsList from './components/CampaignsList';
import SubscribersList from './components/SubscribersList';
import TemplatesList from './components/TemplatesList';
import SettingsPage from './components/SettingsPage';
import AdminDashboard from './components/AdminDashboard';
import LoginPage from './components/LoginPage';
import LandingPage from './components/LandingPage';
import AIAssistant from './components/AIAssistant';
import AIAssistantFab from './components/AIAssistantFab';
import DemoTimer from './components/DemoTimer';
import ErrorBoundary from './components/ErrorBoundary';
import { DashboardData } from './types';
import { api } from './client/src/lib/api';

console.log('App component loaded');

// Mock data generation
const generateMockData = (): DashboardData => ({
  kpis: [
    { title: 'Delivery Rate', value: '99.2%', change: '+0.1%', changeType: 'increase', period: 'vs last 7d' },
    { title: 'Hard Bounce Rate', value: '0.45%', change: '-0.05%', changeType: 'decrease', period: 'vs last 7d' },
    { title: 'Complaint Rate', value: '0.08%', change: '+0.02%', changeType: 'increase', period: 'vs last 7d' },
    { title: 'Unsubscribe Rate', value: '0.15%', change: '0.00%', changeType: 'neutral', period: 'vs last 7d' },
  ],
  gmailSpamRate: 0.12, // In the "warn" threshold
  domainPerformance: [
    { name: 'Gmail', deliveryRate: 99.1, complaintRate: 0.12, spamRate: 0.12 },
    { name: 'Yahoo', deliveryRate: 99.5, complaintRate: 0.09, spamRate: 0.08 },
    { name: 'Outlook', deliveryRate: 98.8, complaintRate: 0.15, spamRate: 0.18 },
    { name: 'Other', deliveryRate: 97.5, complaintRate: 0.20, spamRate: 0.25 },
  ],
  complianceChecklist: [
    { id: 'spf', name: 'SPF Alignment', status: 'pass', details: 'SPF record is valid and aligned.', fixLink: '#' },
    { id: 'dkim', name: 'DKIM Alignment', status: 'pass', details: 'DKIM signatures are valid and aligned.', fixLink: '#' },
    { id: 'dmarc', name: 'DMARC Policy', status: 'warn', details: 'p=none policy detected. Consider tightening to quarantine/reject.', fixLink: '#' },
    { id: 'list_unsub', name: 'One-Click Unsubscribe', status: 'pass', details: 'List-Unsubscribe headers are correctly implemented.', fixLink: '#' },
    { id: 'tls', name: 'TLS Encryption', status: 'pass', details: '100% of mail sent over TLS.', fixLink: '#' },
    { id: 'fbl', name: 'Feedback Loops', status: 'fail', details: 'Yahoo CFL not configured. Complaints may be missed.', fixLink: '#' },
  ],
});

type PageType = 'dashboard' | 'campaigns' | 'templates' | 'subscribers' | 'settings' | 'admin';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true); // Initial loading state for auth check
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null); // Renamed from 'data' to 'dashboardData' for clarity
  const [error, setError] = useState<string | null>(null); // State for handling errors

  // Simulate demo mode and expiry if needed
  const isDemoMode = user?.paymentStatus === 'demo';
  const demoExpiresAt = user?.demoExpiresAt; // Assuming this is passed in user object

  const handleDemoExpire = () => {
    console.log('Demo expired');
    handleLogout();
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const userData = await api.get('/api/auth/me');
      setUser(userData);
      setIsAuthenticated(true);
      fetchDashboardData();
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      setLoading(false);
    }
  };

  const handleLogin = (token: string, userData: any) => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
    fetchDashboardData();
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    setDashboardData(null); // Reset dashboard data on logout
    setCurrentPage('dashboard'); // Reset to dashboard after logout
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null); // Clear previous errors
    try {
      console.log('Fetching dashboard data...');
      const data = await api.get('/api/dashboard');
      console.log('Dashboard data received:', data);
      setDashboardData(data); // Use the correct state setter
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data'); // Set error message
      setDashboardData(generateMockData()); // Fallback to mock data on error
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (page: PageType) => {
    setCurrentPage(page);
    setMobileMenuOpen(false); // Close mobile menu on navigation
  };

  // Determine if the application is in demo mode based on user data
  const isLoggedIn = isAuthenticated;
  const currentUser = user;

  return (
    <ErrorBoundary>
      <Router>
        {!isLoggedIn ? (
          <Routes>
            <Route path="/" element={<LandingPage onGetStarted={() => window.location.href = '/login'} />} />
            <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        ) : (
          <div className="flex h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onLogout={handleLogout} currentUser={currentUser} />
            <div className="flex-1 flex flex-col overflow-hidden">
              <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} currentUser={currentUser} />
              <main className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 ${currentUser?.paymentStatus === 'demo' ? 'mt-10' : ''}`}>
                {error && (
                  <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
                    {error}
                  </div>
                )}
                {loading && !dashboardData && (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-blue"></div>
                  </div>
                )}
                <Routes>
                  <Route path="/dashboard" element={dashboardData ? <Dashboard data={dashboardData} /> : <div className="text-center text-gray-400 p-8">Loading dashboard...</div>} />
                  <Route path="/campaigns" element={<CampaignsList />} />
                  <Route path="/subscribers" element={<SubscribersList />} />
                  <Route path="/templates" element={<TemplatesList />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  {currentUser?.role === 'super_admin' && (
                    <Route path="/admin" element={<AdminDashboard />} />
                  )}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </main>
            </div>
            <AIAssistantFab onOpen={() => setIsAIOpen(true)} />
            <AIAssistant isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} data={dashboardData} />
            {isDemoMode && <DemoTimer expiresAt={demoExpiresAt} onExpire={handleDemoExpire} />}
          </div>
        )}
      </Router>
    </ErrorBoundary>
  );
};

export default App;