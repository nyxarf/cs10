import { useState, useEffect } from 'react';
import { adminDashboard } from '../services/api';
import { useNavigate } from 'react-router-dom';
import {
  LuCircleHelp, LuTag, LuMessageSquare, LuClock, LuFileQuestion,
  LuTrendingUp, LuActivity, LuCircleCheck, LuCircleX, LuRefreshCw, LuUsers, LuGlobe, LuZap
} from 'react-icons/lu';

function StatCard({ icon: Icon, label, value, color, bgColor, sub, to }) {
  const navigate = useNavigate();
  const clickable = Boolean(to);
  return (
    <div
      className="stat-card fade-in"
      onClick={clickable ? () => navigate(to) : undefined}
      style={{
        cursor: clickable ? 'pointer' : 'default',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={clickable ? (e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = `0 8px 24px ${color}22`;
      } : undefined}
      onMouseLeave={clickable ? (e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '';
      } : undefined}
      title={clickable ? `Go to ${label}` : undefined}
    >
      <div className="stat-card-icon" style={{ background: bgColor }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value" style={{ color }}>{value}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}

function ActionBadge({ action }) {
  const map = {
    answer:  { cls: 'badge-success', label: 'Answered' },
    clarify: { cls: 'badge-warning', label: 'Clarified' },
    reject:  { cls: 'badge-danger',  label: 'Rejected' },
  };
  const { cls, label } = map[action] || { cls: 'badge-gray', label: action };
  return <span className={`badge ${cls}`}>{label}</span>;
}

export default function AdminDashboard() {
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    adminDashboard()
      .then(res => setStats(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const cards = [
    { icon: LuCircleHelp,    label: 'Total FAQs',      value: stats?.faqCount ?? '—',           color: '#4f46e5', bgColor: '#ede9fe', sub: 'in knowledge base',         to: '/faqs' },
    { icon: LuTag,           label: 'Categories',       value: stats?.categoryCount ?? '—',       color: '#0891b2', bgColor: '#cffafe', sub: 'topic groups',               to: '/faqs' },
    { icon: LuUsers,         label: 'Total Users',      value: stats?.userCount ?? '—',           color: '#16a34a', bgColor: '#dcfce7', sub: 'registered members',         to: '/users' },
    { icon: LuGlobe,         label: 'Community Qs',     value: stats?.communityQueryCount ?? '—', color: '#8b5cf6', bgColor: '#ede9fe', sub: 'open + answered (visible)',  to: '/moderation' },
    { icon: LuMessageSquare, label: 'Search Queries',   value: stats?.totalSearchQueries ?? '—',  color: '#059669', bgColor: '#d1fae5', sub: 'total AI cache lookups',      to: '/analytics' },
    { icon: LuClock,         label: 'Pending Answers',  value: stats?.pendingModeration ?? '—',   color: '#d97706', bgColor: '#fef3c7', sub: 'flagged, awaiting review',   to: '/moderation' },
    { icon: LuFileQuestion,  label: 'FAQ Proposals',    value: stats?.pendingFaqProposals ?? '—', color: '#db2777', bgColor: '#fce7f3', sub: 'community answers to absorb', to: '/knowledge' },
    { icon: LuZap,           label: 'Engagement',       value: 'View',                             color: '#8b5cf6', bgColor: '#f3e8ff', sub: 'community analytics',        to: '/engagement' },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>Dashboard</h1>
          <p>Overview of your VINS FAQ system</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <LuRefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 130 }} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          {cards.map(c => <StatCard key={c.label} {...c} />)}

          {/* Spotlight card — clickable, navigates to spotlight page */}
          <div
            className="stat-card fade-in"
            onClick={() => navigate('/spotlight')}
            style={{
              cursor: 'pointer',
              border: '1px solid rgba(251,191,36,0.4)',
              boxShadow: '0 0 0 1px rgba(251,191,36,0.1), 0 4px 20px rgba(251,191,36,0.08)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 0 0 1px rgba(251,191,36,0.25), 0 8px 28px rgba(251,191,36,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 0 0 1px rgba(251,191,36,0.1), 0 4px 20px rgba(251,191,36,0.08)';
            }}
            title="View spotlighted questions"
          >
            <div className="stat-card-icon" style={{ background: 'rgba(251,191,36,0.15)' }}>
              <LuZap size={20} style={{ color: '#FBBF24' }} />
            </div>
            <div className="stat-card-label">Spotlight</div>
            <div className="stat-card-value" style={{ color: '#FBBF24' }}>
              {stats?.spotlightedCount ?? '—'}
            </div>
            <div className="stat-card-sub" style={{ color: 'rgba(251,191,36,0.7)' }}>needs answers</div>
          </div>
        </div>
      )}

      {/* Recent Logs */}
      <div className="card fade-in" style={{ animationDelay: '0.15s' }}>
        <div className="card-header">
          <div className="card-title">
            <LuActivity size={17} style={{ color: 'var(--primary)' }} />
            Recent Query Logs
          </div>
          <span className="badge badge-primary">{stats?.recentLogs?.length ?? 0} entries</span>
        </div>

        {loading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 48 }} />)}
          </div>
        ) : stats?.recentLogs?.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Query</th>
                  <th>Category</th>
                  <th>Action</th>
                  <th>Confidence</th>
                  <th style={{ textAlign: 'right' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentLogs.map(log => (
                  <tr key={log._id}>
                    <td style={{ maxWidth: 280 }}>
                      <span style={{ fontWeight: 500, color: 'var(--text-1)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.originalQuery}
                      </span>
                    </td>
                    <td>
                      {log.category
                        ? <span className="badge badge-violet">{log.category}</span>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td><ActionBadge action={log.actionTaken} /></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress" style={{ width: 60 }}>
                          <div className="progress-fill" style={{
                            width: `${(log.confidence || 0) * 100}%`,
                            background: log.confidence > 0.7 ? 'var(--success)' : log.confidence > 0.4 ? 'var(--warning)' : 'var(--danger)'
                          }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-2)', fontWeight: 600 }}>
                          {((log.confidence || 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                      {new Date(log.createdAt).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"><LuActivity size={24} /></div>
            <h3>No query logs yet</h3>
            <p>Logs will appear when students ask questions.</p>
          </div>
        )}
      </div>
    </div>
  );
}
