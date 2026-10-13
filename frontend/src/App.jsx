import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import AppShell from './components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import ZoneDetail from './pages/ZoneDetail';
import AlertsHistory from './pages/AlertsHistory';
import LandingPage from './components/landing/LandingPage';

function AppContent() {
  const getInitialPage = () => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (['dashboard', 'zone_detail', 'alerts', 'landing'].includes(hash)) {
        return hash;
      }
      const params = new URLSearchParams(window.location.search);
      const p = params.get('page');
      if (['dashboard', 'zone_detail', 'alerts', 'landing'].includes(p)) {
        return p;
      }
    }
    return 'landing';
  };

  const [currentPage, setCurrentPageState] = useState(getInitialPage);

  const setCurrentPage = (page) => {
    setCurrentPageState(page);
    if (typeof window !== 'undefined') {
      window.location.hash = page;
    }
  };

  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (['dashboard', 'zone_detail', 'alerts', 'landing'].includes(hash)) {
        setCurrentPageState(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // If user is on the Landing Page, render the rich Landing Page
  if (currentPage === 'landing') {
    return (
      <LandingPage
        onNavigateDashboard={() => setCurrentPage('dashboard')}
      />
    );
  }

  return (
    <AppShell currentPage={currentPage} onNavigate={setCurrentPage}>
      {currentPage === 'dashboard' && <Dashboard />}
      {currentPage === 'zone_detail' && <ZoneDetail />}
      {currentPage === 'alerts' && <AlertsHistory />}
    </AppShell>
  );
}


export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
