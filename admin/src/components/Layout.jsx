import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LuLayoutDashboard, LuCircleHelp, LuShieldCheck, LuChartBar,
  LuLogOut, LuBell, LuChevronDown, LuZap, LuUsers, LuSparkles
} from 'react-icons/lu';

const navItems = [
  { to: '/dashboard',  label: 'Dashboard',        icon: LuLayoutDashboard },
  { to: '/faqs',       label: 'FAQs',              icon: LuCircleHelp },
  { to: '/moderation', label: 'Moderation',        icon: LuShieldCheck },
  { to: '/knowledge',  label: 'Knowledge Review',  icon: LuSparkles },
  { to: '/users',      label: 'Users',             icon: LuUsers },
  { to: '/analytics',  label: 'Analytics',         icon: LuChartBar },
  { to: '/spotlight',  label: 'Spotlight',         icon: LuZap, highlight: true },
];

const pageTitles = {
  '/dashboard':  'Dashboard',
  '/faqs':       'FAQ Management',
  '/moderation': 'Moderation',
  '/knowledge':  'Knowledge Review',
  '/users':      'User Management',
  '/analytics':  'Analytics',
  '/spotlight':  'Community Spotlight',
};

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const userString = localStorage.getItem('adminUser');
  let user = {};
  try {
    user = (userString && userString !== 'undefined') ? JSON.parse(userString) : {};
  } catch (e) {
    user = {};
  }

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/login');
  };

  const pageTitle = pageTitles[location.pathname] || 'Admin';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <LuZap size={18} />
          </div>
          <div>
            <div className="sidebar-logo-text">Yaksha Mini</div>
            <div className="sidebar-logo-badge">Admin</div>
          </div>
        </div>

        {/* Nav */}
        <div className="sidebar-nav">
          <div className="sidebar-section-label">Main Menu</div>
          {navItems.map(({ to, label, icon: Icon, highlight }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              style={highlight ? { color: 'rgba(251,191,36,0.85)' } : undefined}
            >
              <Icon size={17} style={highlight ? { color: '#FBBF24' } : undefined} />
              {label}
            </NavLink>
          ))}
        </div>

        {/* User footer */}
        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', marginBottom: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0
            }}>
              {(user.email || 'A')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#ffffff', truncate: true }}>
                {user.email?.split('@')[0] || 'Admin'}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.4)' }}>Administrator</div>
            </div>
          </div>
          <button className="sidebar-link" onClick={handleLogout} style={{ color: '#fca5a5', width: '100%' }}>
            <LuLogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="admin-main">
        {/* Top header */}
        <header className="admin-header">
          <div className="admin-header-inner">
            <h1 className="admin-header-title">{pageTitle}</h1>
            <div className="admin-header-right">
              <button className="btn btn-ghost btn-icon" title="Home Dashboard" onClick={() => navigate('/dashboard')}>
                <LuLayoutDashboard size={18} style={{ color: 'var(--text-2)' }} />
              </button>
              <button className="btn btn-ghost btn-icon" title="Public Site" onClick={() => window.location.href = 'http://localhost:5173'}>
                <LuZap size={18} style={{ color: 'var(--text-2)' }} />
              </button>
              <button className="btn btn-ghost btn-icon" title="Notifications">
                <LuBell size={18} style={{ color: 'var(--text-2)' }} />
              </button>
              <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="admin-avatar">
                  {(user.email || 'A')[0].toUpperCase()}
                </div>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-2)' }}>
                  {user.email?.split('@')[0] || 'Admin'}
                </span>
                <LuChevronDown size={14} style={{ color: 'var(--text-3)' }} />
              </div>
            </div>
          </div>
        </header>

        {/* Page */}
        <div className="page-content">
          <div className="page-inner">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
