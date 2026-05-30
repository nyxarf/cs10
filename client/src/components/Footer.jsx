import { Link } from 'react-router-dom';
import { FaBolt } from 'react-icons/fa';

export default function Footer() {
  return (
    <footer style={{ 
      background: 'var(--bg-card)', 
      borderTop: '1px solid var(--border-color)', 
      padding: '4rem 1rem 2rem',
      marginTop: 'auto'
    }}>
      <div className="container">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3rem', justifyContent: 'space-between', marginBottom: '3rem' }}>
          
          <div style={{ flex: '1 1 300px' }}>
            <Link to="/" className="navbar-brand" style={{ marginBottom: '1rem', display: 'inline-flex' }}>
              <FaBolt style={{ color: '#FCD34D' }} /> Samagama
            </Link>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              The ultimate intelligent FAQ companion and community board for the Samagama Program. Ask, answer, and learn together.
            </p>
          </div>

          <div style={{ flex: '1 1 150px' }}>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: 600 }}>Platform</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li><Link to="/home" style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color var(--transition-fast)' }} onMouseOver={e => e.target.style.color='var(--accent-primary-light)'} onMouseOut={e => e.target.style.color='var(--text-muted)'}>Home</Link></li>
              <li><Link to="/faq/browse" style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color var(--transition-fast)' }} onMouseOver={e => e.target.style.color='var(--accent-primary-light)'} onMouseOut={e => e.target.style.color='var(--text-muted)'}>Browse FAQs</Link></li>
              <li><Link to="/faq" style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color var(--transition-fast)' }} onMouseOver={e => e.target.style.color='var(--accent-primary-light)'} onMouseOut={e => e.target.style.color='var(--text-muted)'}>Ask Yaksha AI</Link></li>
              <li><Link to="/faq/community" style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color var(--transition-fast)' }} onMouseOver={e => e.target.style.color='var(--accent-primary-light)'} onMouseOut={e => e.target.style.color='var(--text-muted)'}>Community</Link></li>
            </ul>
          </div>

          <div style={{ flex: '1 1 150px' }}>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: 600 }}>Legal</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li><Link to="/privacy" style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color var(--transition-fast)' }} onMouseOver={e => e.target.style.color='var(--accent-primary-light)'} onMouseOut={e => e.target.style.color='var(--text-muted)'}>Privacy Policy</Link></li>
              <li><Link to="/terms" style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color var(--transition-fast)' }} onMouseOver={e => e.target.style.color='var(--accent-primary-light)'} onMouseOut={e => e.target.style.color='var(--text-muted)'}>Terms of Service</Link></li>
              <li><Link to="/cookies" style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color var(--transition-fast)' }} onMouseOver={e => e.target.style.color='var(--accent-primary-light)'} onMouseOut={e => e.target.style.color='var(--text-muted)'}>Cookie Policy</Link></li>
            </ul>
          </div>

          <div style={{ flex: '1 1 250px' }}>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: 600 }}>Got Questions?</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Can't find what you're looking for? Join our community or ask our AI assistant for instant help.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Link to="/faq" className="btn btn-primary btn-sm">Ask Yaksha</Link>
              <Link to="/faq/community" className="btn btn-secondary btn-sm">Community</Link>
            </div>
          </div>
        </div>

        <div style={{ 
          borderTop: '1px solid var(--border-color)', 
          paddingTop: '2rem', 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
            &copy; {new Date().getFullYear()} Samagama FAQ Companion. All rights reserved.
          </p>
          <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <span>Powered by Yaksha AI</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
