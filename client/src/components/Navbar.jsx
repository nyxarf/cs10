import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { FaBolt, FaStar, FaSun, FaMoon } from 'react-icons/fa';

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const isActive = (path) => location.pathname === path ? 'navbar-link active' : 'navbar-link';

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/" className="navbar-brand"><FaBolt style={{ color: '#FCD34D' }} /> Samagama</Link>
          <button 
            onClick={toggleTheme} 
            className="btn btn-icon btn-secondary" 
            style={{ borderRadius: '50%', padding: '0.4rem', width: '32px', height: '32px' }}
            title="Toggle Theme"
          >
            {theme === 'dark' ? <FaSun style={{ color: '#FCD34D' }} /> : <FaMoon style={{ color: '#6366f1' }} />}
          </button>
        </div>

        <div className="navbar-links">
          <Link to="/faq" className={isActive('/faq')}>Ask Yaksha</Link>
          <Link to="/faq/browse" className={isActive('/faq/browse')}>Browse FAQs</Link>
          <Link to="/faq/community" className={isActive('/faq/community')}>Community</Link>

          {isAuthenticated && (
            <Link to="/answer" className={isActive('/answer')}>Answer</Link>
          )}

          {isAdmin && (
            <a href="http://localhost:5174" className="navbar-link">Admin Panel</a>
          )}

          {isAuthenticated ? (
            <>
              <Link to="/profile" className={isActive('/profile')}>Profile</Link>
              <span className="navbar-xp"><FaStar style={{ color: '#FCD34D', marginBottom: '-2px' }} /> {user?.xp || 0} SP</span>
              <button className="btn btn-sm btn-secondary" onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className={isActive('/login')}>Login</Link>
              <Link to="/register" className="btn btn-sm btn-primary">Sign Up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
