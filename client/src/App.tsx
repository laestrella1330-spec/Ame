import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { FeaturesProvider } from './context/FeaturesContext';
import { ThemeProvider } from './context/ThemeContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import AgeGatePage from './pages/AgeGatePage';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminRoute from './components/AdminRoute';
import DOBAgeModal from './components/DOBAgeModal';

export default function App() {
  const [ageVerified, setAgeVerified] = useState(
    () => localStorage.getItem('age_verified') === 'true'
  );

  return (
    <AuthProvider>
      <ThemeProvider>
      <FeaturesProvider>
        {!ageVerified && (
          <DOBAgeModal onVerified={() => setAgeVerified(true)} />
        )}
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/age-gate" element={<AgeGatePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
        </Routes>
      </FeaturesProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
