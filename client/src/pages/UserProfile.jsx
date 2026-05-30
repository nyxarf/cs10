import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import {
  FaStar, FaCommentDots, FaQuestionCircle, FaEye, FaThumbsUp,
  FaThumbsDown, FaBolt, FaCheckCircle, FaCalendarAlt, FaUserCircle,
} from 'react-icons/fa';

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */
function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const ROLE_COLORS = {
  admin:    { bg: 'rgba(239,68,68,0.15)',   text: '#ef4444' },
  answerer: { bg: 'rgba(16,185,129,0.15)',  text: '#10b981' },
  asker:    { bg: 'rgba(99,102,241,0.15)',  text: '#818cf8' },
};

/* ─────────────────────────────────────────
   Sub-components
───────────────────────────────────────── */
function StatPill({ icon, value, label, color }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: '0.35rem', padding: '1.25rem 1rem',
      background: 'var(--bg-glass)',
      border: '1px solid var(--border-color)',
      borderRadius: '14px',
      minWidth: '90px',
      transition: 'all 0.2s',
    }}>
      <span style={{ fontSize: '1.4rem', color }}>{icon}</span>
      <span style={{ fontSize: '1.6rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
    </div>
  );
}

function TabButton({ active, onClick, children, count }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
        padding: '0.55rem 1.1rem',
        borderRadius: '999px',
        border: active ? '1.5px solid var(--accent-primary)' : '1.5px solid var(--border-color)',
        background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
        color: active ? 'var(--accent-primary-light)' : 'var(--text-secondary)',
        fontWeight: 700,
        fontSize: '0.82rem',
        cursor: 'pointer',
        transition: 'all 0.18s',
      }}
    >
      {children}
      {count !== undefined && (
        <span style={{
          background: active ? 'rgba(99,102,241,0.2)' : 'var(--bg-glass)',
          color: active ? 'var(--accent-primary-light)' : 'var(--text-muted)',
          borderRadius: '999px',
          fontSize: '0.68rem', fontWeight: 800,
          padding: '0.05rem 0.42rem',
          border: '1px solid var(--border-color)',
        }}>{count}</span>
      )}
    </button>
  );
}

function QuestionCard({ q }) {
  const statusColors = {
    open:     { bg: 'rgba(245,158,11,0.15)',  text: '#f59e0b' },
    answered: { bg: 'rgba(16,185,129,0.15)',  text: '#10b981' },
    review:   { bg: 'rgba(99,102,241,0.15)', text: '#818cf8' },
    hidden:   { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8' },
    closed:   { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8' },
  };
  const sc = statusColors[q.status] || statusColors.open;

  return (
    <Link to={`/faq/community/${q._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="card" style={{ cursor: 'pointer', padding: '1.1rem 1.3rem', marginBottom: '0' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          {/* Score column */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            minWidth: '44px', paddingTop: '0.1rem',
          }}>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: q.net_score > 0 ? '#10b981' : q.net_score < 0 ? '#ef4444' : 'var(--text-muted)' }}>
              {q.net_score >= 0 ? `+${q.net_score}` : q.net_score}
            </span>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '1px' }}>votes</span>
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: '0.97rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.45rem', lineHeight: 1.45 }}>
              {q.rephrased_query}
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{
                background: 'rgba(99,102,241,0.12)', color: 'var(--accent-primary-light)',
                borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700,
                padding: '0.15rem 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>{q.category}</span>
              <span style={{
                background: sc.bg, color: sc.text,
                borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700,
                padding: '0.15rem 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>{q.status}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '0.22rem' }}>
                <FaCommentDots style={{ fontSize: '0.7rem' }} /> {q.answer_count}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '0.22rem' }}>
                <FaEye style={{ fontSize: '0.7rem' }} /> {q.view_count}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginLeft: 'auto' }}>
                {timeAgo(q.created_at)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function AnswerCard({ a }) {
  const q = a.question_id;
  const statusColors = {
    live:    { bg: 'rgba(16,185,129,0.12)',  text: '#10b981', label: 'Live' },
    flagged: { bg: 'rgba(245,158,11,0.12)',  text: '#f59e0b', label: 'Under Review' },
    hidden:  { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8', label: 'Hidden' },
  };
  const sc = statusColors[a.status] || statusColors.live;

  return (
    <Link to={q ? `/faq/community/${q._id}` : '#'} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="card" style={{ cursor: 'pointer', padding: '1.1rem 1.3rem' }}>

        {/* Question it answers */}
        {q && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            marginBottom: '0.7rem',
            padding: '0.4rem 0.65rem',
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
          }}>
            <FaQuestionCircle style={{ color: 'var(--text-muted)', fontSize: '0.72rem', flexShrink: 0 }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {q.rephrased_query}
            </span>
            <span style={{
              marginLeft: 'auto', flexShrink: 0,
              background: 'rgba(99,102,241,0.1)', color: 'var(--accent-primary-light)',
              borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700,
              padding: '0.1rem 0.4rem', textTransform: 'uppercase',
            }}>{q.category}</span>
          </div>
        )}

        {/* Answer content */}
        <p style={{
          fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6,
          marginBottom: '0.75rem',
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {a.content}
        </p>

        {/* Footer meta */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ background: sc.bg, color: sc.text, borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {sc.label}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.22rem', color: a.net_score > 0 ? '#10b981' : a.net_score < 0 ? '#ef4444' : 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700 }}>
            <FaThumbsUp style={{ fontSize: '0.7rem' }} /> {a.upvotes}
            <FaThumbsDown style={{ fontSize: '0.7rem', marginLeft: '0.4rem' }} /> {a.downvotes}
          </span>
          {a.promoted_to_corpus && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#FCD34D', fontSize: '0.72rem', fontWeight: 700 }}>
              <FaBolt style={{ fontSize: '0.65rem' }} /> Promoted to FAQ
            </span>
          )}
          <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginLeft: 'auto' }}>
            {timeAgo(a.created_at)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function EmptyState({ icon, text, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{icon}</div>
      <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>{text}</div>
      <p style={{ fontSize: '0.85rem' }}>{sub}</p>
    </div>
  );
}

/* ─────────────────────────────────────────
   Main Page
───────────────────────────────────────── */
export default function UserProfile() {
  const { user: authUser } = useAuth();
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('questions');

  useEffect(() => {
    document.title = 'My Profile | Samagama';
    if (!authUser) return;
    api.get('/auth/me')
      .then((res) => setProfile(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authUser]);

  if (!authUser) return (
    <div className="page">
      <div className="container" style={{ maxWidth: '480px', textAlign: 'center', paddingTop: '4rem' }}>
        <FaUserCircle style={{ fontSize: '4rem', color: 'var(--text-muted)', marginBottom: '1rem' }} />
        <h2 style={{ marginBottom: '0.5rem' }}>Not logged in</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Please log in to view your profile.</p>
        <Link to="/login" className="btn btn-primary">Login</Link>
      </div>
    </div>
  );

  const user       = profile?.user ?? authUser;
  const questions  = profile?.questions ?? [];
  const answers    = profile?.answers   ?? [];
  const roleStyle  = ROLE_COLORS[user.role] ?? ROLE_COLORS.asker;

  const promotedCount  = answers.filter((a) => a.promoted_to_corpus).length;
  const liveAnswers    = answers.filter((a) => a.status === 'live').length;
  const openQuestions  = questions.filter((q) => q.status === 'open').length;
  const answeredQs     = questions.filter((q) => q.status === 'answered').length;

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: '820px' }}>

        {/* ── Hero Card ── */}
        <div className="card fade-in" style={{
          padding: '2rem',
          background: 'linear-gradient(135deg, var(--bg-card) 60%, rgba(99,102,241,0.06))',
          marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>

            {/* Avatar */}
            <div style={{
              width: '76px', height: '76px', flexShrink: 0,
              borderRadius: '50%',
              background: 'var(--gradient-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2rem', fontWeight: 800, color: 'white',
              boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
            }}>
              {user.name?.charAt(0).toUpperCase()}
            </div>

            {/* Info */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                <h1 style={{ fontSize: '1.55rem', fontWeight: 800, margin: 0 }}>{user.name}</h1>
                <span style={{
                  background: roleStyle.bg, color: roleStyle.text,
                  borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700,
                  padding: '0.2rem 0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>{user.role}</span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.6rem' }}>{user.email}</p>
              {user.created_at && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <FaCalendarAlt style={{ fontSize: '0.7rem' }} />
                  Member since {new Date(user.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </span>
              )}
            </div>

            {/* XP Badge */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: '14px', padding: '0.9rem 1.3rem',
            }}>
              <FaStar style={{ color: '#f59e0b', fontSize: '1.3rem' }} />
              <span style={{ fontSize: '1.8rem', fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>{user.xp ?? 0}</span>
              <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700, letterSpacing: '0.06em' }}>SP</span>
            </div>
          </div>

          {/* Stats row */}
          {!loading && (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
              <StatPill icon={<FaQuestionCircle />} value={questions.length}  label="Questions"  color="var(--accent-primary-light)" />
              <StatPill icon={<FaCommentDots />}    value={answers.length}    label="Answers"    color="var(--accent-success)" />
              <StatPill icon={<FaCheckCircle />}     value={liveAnswers}       label="Live"       color="#10b981" />
              <StatPill icon={<FaBolt />}            value={promotedCount}     label="Promoted"   color="#FCD34D" />
              <StatPill icon={<FaEye />}             value={answeredQs}        label="Answered"   color="var(--accent-secondary)" />
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <TabButton active={tab === 'questions'} onClick={() => setTab('questions')} count={questions.length}>
            <FaQuestionCircle /> Questions
          </TabButton>
          <TabButton active={tab === 'answers'} onClick={() => setTab('answers')} count={answers.length}>
            <FaCommentDots /> Answers
          </TabButton>
        </div>

        {/* ── Tab Content ── */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[1,2,3].map((i) => (
              <div key={i} className="skeleton" style={{ height: '88px', borderRadius: '14px' }} />
            ))}
          </div>
        ) : tab === 'questions' ? (
          questions.length === 0 ? (
            <EmptyState
              icon={<FaQuestionCircle style={{ color: 'var(--accent-primary-light)' }} />}
              text="No questions yet"
              sub="Questions you post on the Community Board will appear here."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Mini-filter strip */}
              <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.25rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                <span>{openQuestions} open</span>
                <span>·</span>
                <span>{answeredQs} answered</span>
                <span>·</span>
                <span>{questions.length - openQuestions - answeredQs} other</span>
              </div>
              {questions.map((q) => <QuestionCard key={q._id} q={q} />)}
            </div>
          )
        ) : (
          answers.length === 0 ? (
            <EmptyState
              icon={<FaCommentDots style={{ color: 'var(--accent-success)' }} />}
              text="No answers yet"
              sub="Answers you submit to community questions will appear here."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Mini-filter strip */}
              <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.25rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                <span>{liveAnswers} live</span>
                <span>·</span>
                <span>{answers.filter(a => a.status === 'flagged').length} under review</span>
                {promotedCount > 0 && <><span>·</span><span style={{ color: '#FCD34D', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>{promotedCount} promoted <FaBolt style={{ fontSize: '0.75rem' }} /></span></>}
              </div>
              {answers.map((a) => <AnswerCard key={a._id} a={a} />)}
            </div>
          )
        )}

      </div>
    </div>
  );
}
