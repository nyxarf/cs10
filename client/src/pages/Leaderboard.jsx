import { useState, useEffect, useRef } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  FaTrophy, FaMedal, FaStar, FaBolt, FaFire, FaChartLine,
  FaCrown, FaArrowUp, FaArrowDown, FaMinus, FaAward,
  FaHandshake, FaShieldAlt, FaRocket, FaUserShield,
} from 'react-icons/fa';
import {
  FiRefreshCw, FiUsers, FiMessageSquare, FiHelpCircle,
  FiZap, FiChevronsUp,
} from 'react-icons/fi';
import {
  HiSparkles,
} from 'react-icons/hi2';
import {
  MdMilitaryTech,
} from 'react-icons/md';

/* ─── Badge definitions ───────────────────────────────────────────────────── */
const BADGES = [
  { id: 'faq_helper',      label: 'FAQ Helper',      Icon: FaHandshake,   color: '#6366f1', desc: 'Answered 5+ questions',   threshold: 5,    field: 'answers_count' },
  { id: 'top_contributor', label: 'Top Contributor',  Icon: FaStar,        color: '#f59e0b', desc: 'Earned 100+ SP',           threshold: 100,  field: 'xp' },
  { id: 'fast_responder',  label: 'Fast Responder',   Icon: FiBolt,        color: '#22d3ee', desc: 'Answered 10+ questions',   threshold: 10,   field: 'answers_count' },
  { id: 'community_hero',  label: 'Community Hero',   Icon: FaShieldAlt,   color: '#10b981', desc: 'Earned 500+ SP',           threshold: 500,  field: 'xp' },
  { id: 'question_master', label: 'Question Master',  Icon: FiHelpCircle,  color: '#8b5cf6', desc: 'Asked 10+ questions',      threshold: 10,   field: 'questions_count' },
  { id: 'veteran',         label: 'Veteran',          Icon: MdMilitaryTech,color: '#ef4444', desc: 'Earned 1000+ SP',          threshold: 1000, field: 'xp' },
];

// small alias so the badge definition can reference FiBolt without circular issue
function FiBolt(props) { return <FiZap {...props} />; }

const getUserBadges = (user) =>
  BADGES.filter(b => (user[b.field] || 0) >= b.threshold);

/* ─── Rank medal config ───────────────────────────────────────────────────── */
const RANK_STYLES = [
  { bg: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#78350f', shadow: 'rgba(251,191,36,0.4)',  PodiumIcon: FaCrown },
  { bg: 'linear-gradient(135deg, #94a3b8, #64748b)', color: '#1e293b', shadow: 'rgba(148,163,184,0.4)', PodiumIcon: FaMedal },
  { bg: 'linear-gradient(135deg, #fb923c, #ea580c)', color: '#431407', shadow: 'rgba(251,146,60,0.4)',  PodiumIcon: FaMedal },
];

/* ─── Stat Chip ───────────────────────────────────────────────────────────── */
function StatChip({ icon: Icon, value, label, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.25rem 0.6rem', borderRadius: 99,
      background: `${color}18`, color,
      fontSize: '0.75rem', fontWeight: 700,
    }}>
      <Icon size={11} /> {value} <span style={{ opacity: 0.7, fontWeight: 500 }}>{label}</span>
    </div>
  );
}

/* ─── Period toggle ───────────────────────────────────────────────────────── */
function PeriodTab({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '0.4rem 1rem', border: 'none', cursor: 'pointer',
      fontFamily: 'inherit', fontWeight: 600, fontSize: '0.82rem',
      borderRadius: 8,
      background: active ? 'var(--gradient-primary)' : 'transparent',
      color: active ? '#fff' : 'var(--text-muted)',
      transition: 'all 0.15s',
    }}>
      {children}
    </button>
  );
}

/* ─── Badge Pill ──────────────────────────────────────────────────────────── */
function BadgePill({ badge, small }) {
  const { Icon } = badge;
  return (
    <div title={badge.desc} style={{
      display: 'inline-flex', alignItems: 'center', gap: small ? 3 : 5,
      padding: small ? '2px 7px' : '4px 10px',
      background: `${badge.color}18`,
      border: `1px solid ${badge.color}40`,
      borderRadius: 99,
      fontSize: small ? '0.65rem' : '0.72rem',
      fontWeight: 700,
      color: badge.color,
      whiteSpace: 'nowrap',
    }}>
      <Icon size={small ? 9 : 11} />
      {!small && badge.label}
    </div>
  );
}

/* ─── Rank change indicator ───────────────────────────────────────────────── */
function RankChange({ change }) {
  if (!change || change === 0) return <FaMinus size={9} style={{ color: '#64748b' }} />;
  if (change > 0) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: '#10b981', fontSize: '0.65rem', fontWeight: 800 }}>
      <FaArrowUp size={8} /> {change}
    </span>
  );
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: '#ef4444', fontSize: '0.65rem', fontWeight: 800 }}>
      <FaArrowDown size={8} /> {Math.abs(change)}
    </span>
  );
}

/* ─── Podium ──────────────────────────────────────────────────────────────── */
function Podium({ users }) {
  if (users.length < 3) return null;
  const order     = [users[1], users[0], users[2]]; // silver, gold, bronze
  const heights   = [110, 140, 90];
  const positions = [1, 0, 2];

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      gap: '0.75rem', marginBottom: '2.5rem', padding: '1.5rem 0 0',
    }}>
      {order.map((user, i) => {
        const rank = positions[i];
        const s    = RANK_STYLES[rank];
        const { PodiumIcon } = s;
        return (
          <div key={user._id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>

            {/* Avatar + crown icon */}
            <div style={{ position: 'relative' }}>
              {rank === 0 && (
                <div style={{
                  position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)',
                  filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.7))',
                }}>
                  <FaCrown size={20} style={{ color: '#fbbf24' }} />
                </div>
              )}
              <div style={{
                width: rank === 0 ? 72 : 58, height: rank === 0 ? 72 : 58,
                borderRadius: '50%',
                background: s.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: s.color, fontWeight: 900, fontSize: rank === 0 ? '1.6rem' : '1.3rem',
                boxShadow: `0 0 0 3px ${s.shadow}, 0 8px 24px ${s.shadow}`,
                border: '2px solid rgba(255,255,255,0.2)',
                flexShrink: 0,
              }}>
                {(user.name || '?')[0].toUpperCase()}
              </div>
            </div>

            {/* Name + SP */}
            <div style={{ textAlign: 'center', maxWidth: 90 }}>
              <div style={{
                fontWeight: 800, fontSize: rank === 0 ? '0.9rem' : '0.8rem',
                color: 'var(--text-primary)', lineHeight: 1.2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90,
              }}>
                {user.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', marginTop: 3 }}>
                <FaBolt style={{ color: '#fbbf24', fontSize: '0.7rem' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fbbf24' }}>{user.xp} SP</span>
              </div>
            </div>

            {/* Podium block */}
            <div style={{
              width: rank === 0 ? 100 : 80,
              height: heights[i],
              background: s.bg,
              borderRadius: '8px 8px 0 0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 20px ${s.shadow}`,
              flexDirection: 'column', gap: 6,
            }}>
              <PodiumIcon size={rank === 0 ? 32 : 26} style={{ color: s.color, opacity: 0.85 }} />
              <div style={{ fontWeight: 900, fontSize: rank === 0 ? '1.3rem' : '1.1rem', color: s.color }}>
                #{rank + 1}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Leaderboard Row ─────────────────────────────────────────────────────── */
function LeaderRow({ user, rank, isCurrentUser, animate, delay }) {
  const s      = RANK_STYLES[rank - 1];
  const badges = getUserBadges(user);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '50px 1fr auto',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.85rem 1.25rem',
        borderRadius: 12,
        background: isCurrentUser
          ? 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(34,211,238,0.06))'
          : hovered ? 'var(--bg-glass-hover)' : 'var(--bg-glass)',
        border: isCurrentUser
          ? '1px solid rgba(99,102,241,0.3)'
          : `1px solid ${hovered ? 'var(--border-active)' : 'var(--border-color)'}`,
        transition: 'all 0.18s',
        transform: hovered ? 'translateX(4px)' : 'none',
        animation: animate ? `fadeIn 0.4s ease ${delay}s both` : 'none',
      }}
    >
      {/* Rank bubble */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        {rank <= 3 ? (
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: s.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: s.color, fontWeight: 900, fontSize: '0.85rem',
            boxShadow: `0 4px 12px ${s.shadow}`,
          }}>
            #{rank}
          </div>
        ) : (
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)',
          }}>
            {rank}
          </div>
        )}
        <RankChange change={user.rankChange} />
      </div>

      {/* User info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            {user.name}
            {isCurrentUser && (
              <span style={{
                marginLeft: 6, fontSize: '0.6rem', fontWeight: 800,
                background: 'var(--gradient-primary)', color: 'transparent',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>YOU</span>
            )}
          </span>
          {badges.slice(0, 3).map(b => <BadgePill key={b.id} badge={b} small />)}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <StatChip icon={FiMessageSquare} value={user.answers_count || 0} label="ans"    color="#6366f1" />
          <StatChip icon={FiUsers}         value={user.questions_count || 0} label="q"    color="#22d3ee" />
          {user.streak > 0 && (
            <StatChip icon={FaFire}        value={user.streak}  label="streak"            color="#f59e0b" />
          )}
        </div>
      </div>

      {/* SP score */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
          <FaBolt style={{ color: '#fbbf24', fontSize: '0.75rem' }} />
          <span style={{
            fontSize: rank <= 3 ? '1.1rem' : '1rem',
            fontWeight: 900,
            color: rank === 1 ? '#fbbf24' : rank === 2 ? '#94a3b8' : rank === 3 ? '#fb923c' : 'var(--text-primary)',
          }}>
            {user.xp?.toLocaleString() ?? 0}
          </span>
        </div>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>SP earned</div>
      </div>
    </div>
  );
}

/* ─── Badge Showcase ──────────────────────────────────────────────────────── */
function BadgeShowcase() {
  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <div className="card-header" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FaAward style={{ color: 'var(--accent-primary)' }} />
          <span className="card-title" style={{ fontSize: '1rem' }}>Badges Guide</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {BADGES.map(b => {
          const { Icon } = b;
          return (
            <div key={b.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.6rem 0.85rem',
              background: `${b.color}08`,
              borderRadius: 10,
              border: `1px solid ${b.color}25`,
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: `${b.color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon size={16} style={{ color: b.color }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: b.color }}>{b.label}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>{b.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Stats Bar ───────────────────────────────────────────────────────────── */
function StatsBar({ stats }) {
  const items = [
    { icon: FiUsers,         value: stats.totalUsers,     label: 'Members',   color: '#6366f1' },
    { icon: FiMessageSquare, value: stats.totalAnswers,   label: 'Answers',   color: '#10b981' },
    { icon: FaChartLine,     value: stats.totalQuestions, label: 'Questions', color: '#22d3ee' },
    { icon: FaBolt,          value: stats.totalSp,        label: 'Total SP',  color: '#f59e0b' },
  ];
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
      gap: '0.75rem',
      marginBottom: '1.5rem',
    }}>
      {items.map(({ icon: Icon, value, label, color }) => (
        <div key={label} style={{
          background: `${color}10`,
          border: `1px solid ${color}25`,
          borderRadius: 12,
          padding: '0.85rem 1rem',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon size={14} style={{ color }} />
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {label}
            </span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color }}>
            {(value ?? 0).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════════ */
export default function Leaderboard() {
  const { user: currentUser } = useAuth();
  const [users, setUsers]           = useState([]);
  const [stats, setStats]           = useState({});
  const [loading, setLoading]       = useState(true);
  const [period, setPeriod]         = useState('all');
  const [activeTab, setActiveTab]   = useState('sp');
  const [refreshing, setRefreshing] = useState(false);
  const animateRef = useRef(true);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    animateRef.current = true;
    try {
      const res  = await api.get('/questions/leaderboard/top', { params: { period } });
      const data = res.data;
      setUsers(data.users || data.data || []);
      setStats(data.stats || {});
    } catch {
      try {
        const qRes = await api.get('/questions', { params: { page: 1, limit: 1 } });
        setStats({ totalUsers: 0, totalAnswers: 0, totalQuestions: qRes.data?.total || 0, totalSp: 0 });
      } catch {}
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    document.title = 'Leaderboard | FAQ Quest';
    load();
  }, [period]);

  const sorted = [...users].sort((a, b) => {
    if (activeTab === 'sp')        return (b.xp || 0) - (a.xp || 0);
    if (activeTab === 'answers')   return (b.answers_count || 0) - (a.answers_count || 0);
    if (activeTab === 'questions') return (b.questions_count || 0) - (a.questions_count || 0);
    return 0;
  });

  const top3 = sorted.slice(0, 3);
  const rest  = sorted.slice(3);

  const currentUserRank = currentUser
    ? sorted.findIndex(u => u._id === currentUser._id) + 1
    : -1;

  /* ── Sort tabs definition ── */
  const SORT_TABS = [
    { key: 'sp',        label: 'SP Earned',  Icon: FaBolt          },
    { key: 'answers',   label: 'Answers',    Icon: FiMessageSquare },
    { key: 'questions', label: 'Questions',  Icon: FiHelpCircle    },
  ];

  return (
    <div className="page">
      <div className="container">

        {/* ── Header ── */}
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h1 style={{
                fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 900,
                background: 'var(--gradient-primary)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <FaTrophy style={{ WebkitTextFillColor: '#fbbf24', color: '#fbbf24' }} />
                Leaderboard
              </h1>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                <HiSparkles style={{ color: '#f59e0b' }} />
                Top contributors who make this community thrive
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{
                display: 'flex', background: 'var(--bg-glass)',
                border: '1px solid var(--border-color)', borderRadius: 10, padding: 4, gap: 2,
              }}>
                {[['all', 'All Time'], ['30d', '30 Days'], ['7d', '7 Days']].map(([val, label]) => (
                  <PeriodTab key={val} active={period === val} onClick={() => setPeriod(val)}>
                    {label}
                  </PeriodTab>
                ))}
              </div>
              <button
                onClick={() => load(true)}
                disabled={refreshing}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <FiRefreshCw size={13} style={{ animation: refreshing ? 'spin 0.6s linear infinite' : 'none' }} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* ── Stats Bar ── */}
        {!loading && <StatsBar stats={stats} />}

        {/* ── Sort Tabs ── */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: '1.25rem',
          background: 'var(--bg-glass)', border: '1px solid var(--border-color)',
          borderRadius: 10, padding: 5, width: 'fit-content',
        }}>
          {SORT_TABS.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)} style={{
              padding: '0.35rem 0.85rem', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 600, fontSize: '0.8rem',
              borderRadius: 7,
              background: activeTab === key ? 'var(--gradient-primary)' : 'transparent',
              color: activeTab === key ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.5rem', alignItems: 'start' }}>

          {/* ── Rankings ── */}
          <div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12 }} />
                ))}
              </div>
            ) : sorted.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><FaTrophy /></div>
                <div className="empty-state-text">No rankings yet</div>
                <p style={{ color: 'var(--text-muted)' }}>
                  Be the first to answer questions and claim the top spot!
                </p>
                <a href="/faq/community" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-flex' }}>
                  Browse Community
                </a>
              </div>
            ) : (
              <>
                {top3.length >= 3 && <Podium users={top3} />}

                {/* Top-3 rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.75rem' }}>
                  {top3.map((u, i) => (
                    <LeaderRow key={u._id} user={u} rank={i + 1}
                      isCurrentUser={u._id === currentUser?._id}
                      animate delay={i * 0.08} />
                  ))}
                </div>

                {/* Divider */}
                {rest.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.85rem 0' }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Honorable Mentions
                    </span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
                  </div>
                )}

                {/* Rest */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {rest.map((u, i) => (
                    <LeaderRow key={u._id} user={u} rank={i + 4}
                      isCurrentUser={u._id === currentUser?._id}
                      animate delay={(i + 3) * 0.06} />
                  ))}
                </div>

                {/* Current-user banner if outside list */}
                {currentUser && currentUserRank > 0 && currentUserRank > sorted.length && (
                  <div style={{ marginTop: '1.25rem' }}>
                    <div style={{
                      padding: '0.6rem 1rem',
                      background: 'rgba(99,102,241,0.06)',
                      border: '1px dashed rgba(99,102,241,0.3)',
                      borderRadius: 10, textAlign: 'center',
                      fontSize: '0.82rem', color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    }}>
                      <FaRocket size={13} style={{ color: 'var(--accent-primary)' }} />
                      You're ranked{' '}
                      <strong style={{ color: 'var(--accent-primary)' }}>#{currentUserRank}</strong>{' '}
                      overall. Keep answering to climb higher!
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: 80 }}>

            {/* Guest CTA */}
            {!currentUser && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(34,211,238,0.1))',
                border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: 16, padding: '1.25rem', textAlign: 'center',
              }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <FaStar size={28} style={{ color: '#fbbf24' }} />
                </div>
                <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Join the Community!</div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Answer questions, earn SP, and climb the leaderboard.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <a href="/register" className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
                    Sign up free
                  </a>
                  <a href="/login" className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
                    Log in
                  </a>
                </div>
              </div>
            )}

            {/* My Standing */}
            {currentUser && currentUserRank > 0 && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(34,211,238,0.07))',
                border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: 16, padding: '1.25rem',
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FiChevronsUp size={15} style={{ color: 'var(--accent-primary)' }} /> Your Standing
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Rank</span>
                  <span style={{ fontWeight: 800, color: 'var(--accent-primary)', fontSize: '1.1rem' }}>#{currentUserRank}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>SP Earned</span>
                  <span style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <FaBolt size={11} /> {(sorted.find(u => u._id === currentUser._id)?.xp || 0).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                  {getUserBadges(sorted.find(u => u._id === currentUser._id) || {}).map(b => (
                    <BadgePill key={b.id} badge={b} small />
                  ))}
                  {getUserBadges(sorted.find(u => u._id === currentUser._id) || {}).length === 0 && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>No badges yet — start answering!</span>
                  )}
                </div>
              </div>
            )}

            {/* How to earn SP */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FaBolt style={{ color: '#fbbf24' }} /> How to earn SP
              </div>
              {[
                { action: 'Post a question',       pts: '+5–15', color: '#6366f1', Icon: FiHelpCircle    },
                { action: 'Submit an answer',      pts: '+10',   color: '#10b981', Icon: FiMessageSquare },
                { action: 'Answer gets approved',  pts: '+25',   color: '#22d3ee', Icon: FaShieldAlt     },
                { action: 'Promoted to FAQ',       pts: '+50',   color: '#f59e0b', Icon: FaRocket        },
                { action: 'Receive upvote',        pts: '+2',    color: '#8b5cf6', Icon: FaArrowUp       },
                { action: 'Best answer selected',  pts: '+15',   color: '#ef4444', Icon: FaTrophy        },
              ].map(({ action, pts, color, Icon }) => (
                <div key={action} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.4rem 0', borderBottom: '1px solid var(--border-color)',
                  fontSize: '0.78rem',
                }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Icon size={11} style={{ color, flexShrink: 0 }} /> {action}
                  </span>
                  <span style={{ fontWeight: 800, color }}>{pts} SP</span>
                </div>
              ))}
            </div>

            <BadgeShowcase />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
