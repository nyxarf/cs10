import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import FAQPage from './pages/FAQPage';
import FAQBrowse from './pages/FAQBrowse';
import CommunityBoard from './pages/CommunityBoard';
import QuestionDetail from './pages/QuestionDetail';
import AnswererDashboard from './pages/AnswererDashboard';
import UserProfile from './pages/UserProfile';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Footer from './components/Footer';
import './index.css';

import { ThemeProvider } from './context/ThemeContext';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>;
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Navbar />
            <main style={{ flex: 1 }}>
              <Routes>
                <Route path="/" element={<Navigate to="/home" />} />
                <Route path="/home" element={<Home />} />
                <Route path="/faq" element={<FAQPage />} />
                <Route path="/faq/browse" element={<FAQBrowse />} />
                <Route path="/faq/community" element={<CommunityBoard />} />
                <Route path="/faq/community/:id" element={<QuestionDetail />} />
                <Route path="/answer" element={<ProtectedRoute><AnswererDashboard /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
