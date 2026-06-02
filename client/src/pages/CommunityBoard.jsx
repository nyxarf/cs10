import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCategories } from '../hooks/useCategories';
import VoteButtons from '../components/VoteButtons';
import AskQuestionModal from '../components/AskQuestionModal';
import {
  RiFlashlightLine, RiQuestionLine, RiChat3Line, RiEyeLine,
  RiArrowLeftLine, RiArrowRightLine, RiSearchLine, RiFilterLine,
  RiAddLine, RiRobot2Line, RiTimeLine, RiFireLine, RiThumbUpLine,
  RiSparklingLine, RiRefreshLine, RiUserLine, RiStackLine, RiPushpinLine,
} from 'react-icons/ri';

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return `${Math.floor(s / 604800)}w ago`;
}

const SORT_OPTIONS = [
  { value: 'newest',      label: 'Newest',      icon: RiTimeLine },
  { value: 'most_voted',  label: 'Top Voted',   icon: RiThumbUpLine },
  { value: 'most_viewed', label: 'Most Viewed', icon: RiEyeLine },
  { value: 'hybrid',      label: 'Hot',         icon: RiFireLine },
];

const CATEGORIES = [
  'all', 'about', 'timing', 'noc', 'selection',
  'work', 'conduct', 'certificate', 'interviews', 'general',
];

/* ── Status Badge ────────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const map = {
    open:     { bg: 'rgba(251,191,36,0.15)',  color: '#FBBF24', border: 'rgba(251,191,36,0.3)',  label: 'Open' },
    answered: { bg: 'rgba(16,185,129,0.15)',  color: '#34d399', border: 'rgba(16,185,129,0.3)', label: 'Answered' },
    closed:   { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', border: 'rgba(148,163,184,0.3)', label: 'Closed' },
  };
  const s = map[status] || map.open;
  return (
    <span style={{
      padding: '2px 9px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {s.label}
    </span>
  );
}

/* ── Category Chip ───────────────────────────────────────────────────────── */
function CategoryChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 14px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
        background: active ? 'var(--accent-primary)' : 'var(--bg-secondary)',
        color: active ? '#fff' : 'var(--text-secondary)',
        border: active ? '1px solid transparent' : '1px solid var(--border-color)',
      }}
    >
      {label.charAt(0).toUpperCase() + label.slice(1)}
    </button>
  );
}

/* ── Sort Tab ────────────────────────────────────────────────────────────── */
function SortTab({ option, active, onClick }) {
  const Icon = option.icon;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '6px 13px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.15s', border: 'none',
        background: active ? 'var(--accent-primary)' : 'transparent',
        color: active ? '#fff' : 'var(--text-muted)',
      }}
    >
      <Icon size={13} /> {option.label}
    </button>
  );
}

/* ── Question Card ───────────────────────────────────────────────────────── */
function QuestionCard({ q, user }) {
  return (
    <Link to={`/faq/community/${q._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div
        style={{
          background: 'var(--bg-card)',
        border: q.is_pinned
            ? '1px solid rgba(245,158,11,0.6)'
            : q.is_spotlighted
            ? '1px solid rgba(251,191,36,0.45)'
            : '1px solid var(--border-color)',
          borderRadius: 14,
          padding: '16px 18px',
          display: 'flex',
          gap: 14,
          alignItems: 'flex-start',
          position: 'relative',
          overflow: 'visible',
          transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
          boxShadow: q.is_pinned
            ? '0 0 0 1px rgba(245,158,11,0.12), 0 2px 12px rgba(245,158,11,0.08)'
            : q.is_spotlighted
            ? '0 0 0 1px rgba(251,191,36,0.1), 0 2px 12px rgba(251,191,36,0.06)'
            : 'var(--shadow-sm)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = q.is_spotlighted
            ? '0 6px 20px rgba(251,191,36,0.15)'
            : '0 6px 20px rgba(0,0,0,0.15)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = '';
          e.currentTarget.style.boxShadow = q.is_spotlighted
            ? '0 0 0 1px rgba(251,191,36,0.1), 0 2px 12px rgba(251,191,36,0.06)'
            : 'var(--shadow-sm)';
        }}
      >
        {/* Spotlight live dot */}
        {q.is_spotlighted && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            width: 9, height: 9, borderRadius: '50%',
            background: '#FCD34D',
            boxShadow: '0 0 0 3px rgba(252,211,77,0.22)',
            animation: 'pulse 2s infinite',
          }} />
        )}

        {/* Vote column */}
        <div onClick={e => e.preventDefault()} style={{ flexShrink: 0 }}>
          <VoteButtons
            questionId={q._id}
            initialScore={q.net_score || 0}
            isOwn={q.posted_by?._id === user?._id}
          />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
        {/* Pinned label */}
          {q.is_pinned && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
              <RiPushpinLine size={11} style={{ color: '#F59E0B' }} />
              <span style={{ color: '#F59E0B', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                Pinned
              </span>
            </div>
          )}

          {/* Spotlight label */}
          {!q.is_pinned && q.is_spotlighted && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
              <RiFlashlightLine size={11} style={{ color: '#FCD34D' }} />
              <span style={{ color: '#FCD34D', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                Needs Answer
              </span>
            </div>
          )}

          {/* Title */}
          <h3 style={{
            fontSize: '0.985rem', fontWeight: 700, lineHeight: 1.45,
            color: 'var(--text-primary)', marginBottom: 10,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {q.rephrased_query}
          </h3>

          {/* Meta row */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Category */}
            <span style={{
              padding: '2px 9px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700,
              background: 'rgba(99,102,241,0.15)', color: '#818cf8',
              border: '1px solid rgba(99,102,241,0.25)',
            }}>
              {q.category}
            </span>

            <StatusBadge status={q.status} />

            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              <RiChat3Line size={12} /> {q.answer_count} {q.answer_count === 1 ? 'answer' : 'answers'}
            </span>

            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              <RiEyeLine size={12} /> {q.view_count} views
            </span>

            {q.posted_by && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                <RiUserLine size={12} /> {q.posted_by.name}
              </span>
            )}

            <span style={{
              marginLeft: 'auto',
              color: q.is_spotlighted ? '#FBBF24' : 'var(--text-muted)',
              fontSize: '0.75rem',
              fontWeight: q.is_spotlighted ? 600 : 400,
            }}>
              {timeAgo(q.created_at)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── Skeleton Card ───────────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-color)',
      borderRadius: 14, padding: '16px 18px', display: 'flex', gap: 14,
    }}>
      <div style={{ width: 36, borderRadius: 8, background: 'var(--skeleton-base)', flexShrink: 0, height: 80 }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 14, borderRadius: 6, background: 'var(--skeleton-base)', width: '75%', marginBottom: 10 }} />
        <div style={{ height: 14, borderRadius: 6, background: 'var(--skeleton-base)', width: '50%', marginBottom: 14 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          {[60, 55, 70, 55].map((w, i) => (
            <div key={i} style={{ height: 20, width: w, borderRadius: 999, background: 'var(--skeleton-base)' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════════ */
export default function CommunityBoard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { categories: dbCategories } = useCategories();

  // All-option + DB categories
  const allCategories = [{ path: 'all', label: 'All' }, ...dbCategories];
  const [questions, setQuestions]           = useState([]);
  const [loading, setLoading]               = useState(true);
  const [page, setPage]                     = useState(1);
  const [totalPages, setTotalPages]         = useState(1);
  const [total, setTotal]                   = useState(0);
  const [spotlightTotal, setSpotlightTotal] = useState(0);
  const [isModalOpen, setIsModalOpen]       = useState(false);
  const [spotlightOnly, setSpotlightOnly]   = useState(false);
  const [sort, setSort]                     = useState('newest');
  const [category, setCategory]             = useState('all');
  const [search, setSearch]                 = useState('');
  const [searchInput, setSearchInput]       = useState('');

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        sort,
        ...(category !== 'all' ? { category_path: category } : {}),
        ...(search ? { search } : {}),
        ...(spotlightOnly ? { limit: 100 } : {}),
      });
      const res = await api.get(`/questions?${params}`);
      setQuestions(res.data.data || []);
      setTotalPages(res.data.pages || 1);
      setTotal(res.data.total || 0);
      if (res.data.spotlightTotal !== undefined) {
        setSpotlightTotal(res.data.spotlightTotal);
      }
    } catch (err) {
      console.error('Failed to fetch questions:', err);
    } finally {
      setLoading(false);
    }
  }, [page, sort, category, search, spotlightOnly]);

  useEffect(() => {
    document.title = 'Community Board | Samagama';
    fetchQuestions();
  }, [fetchQuestions]);

  // Search on enter
  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const toggleSpotlight = () => {
    setSpotlightOnly(v => !v);
    setPage(1);
  };

  const handleSortChange = (val) => {
    setSort(val);
    setPage(1);
  };

  const handleCategoryChange = (cat) => {
    setCategory(cat);
    setPage(1);
  };

  const clearSearch = () => {
    setSearch('');
    setSearchInput('');
    setPage(1);
  };

  const spotlightedOnPage  = questions.filter(q => q.is_spotlighted);
  const displayedQuestions = spotlightOnly ? spotlightedOnPage : questions;
  const spotlightCount     = spotlightTotal || spotlightedOnPage.length;

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.25); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes spot-idle {
          0%,100% { box-shadow: 0 0 8px 1px rgba(251,191,36,0.25); }
          50% { box-shadow: 0 0 18px 5px rgba(251,191,36,0.4); }
        }
        @keyframes spot-active {
          0% { box-shadow: 0 0 0 0 rgba(251,191,36,0.6); }
          70% { box-shadow: 0 0 0 10px rgba(251,191,36,0); }
          100% { box-shadow: 0 0 0 0 rgba(251,191,36,0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .q-card-enter { animation: fadeUp 0.22s ease both; }
        .page-fade { animation: fadeUp 0.3s ease both; }
      `}</style>

      <div className="page">
        <div className="container" style={{ maxWidth: 820, padding: '0 1rem' }}>

          {/* ── Header ──────────────────────────────────────────────── */}
          <div className="page-fade" style={{ marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 style={{
                  fontSize: '1.9rem', fontWeight: 800, margin: 0,
                  background: 'var(--gradient-primary)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>
                  Community Board
                </h1>
                <p style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: '0.875rem' }}>
                  {loading ? '…' : `${total} open question${total !== 1 ? 's' : ''}`}
                  {spotlightTotal > 0 && (
                    <span style={{ marginLeft: 8, color: '#FBBF24', fontWeight: 600 }}>
                      · {spotlightTotal} need answers
                    </span>
                  )}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {/* Ask Yaksha */}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => navigate('/faq')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <RiRobot2Line size={14} style={{ color: '#FBBF24' }} /> Ask Yaksha First
                </button>

                {/* Ask Question */}
                {user ? (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setIsModalOpen(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <RiAddLine size={15} /> Ask Question
                  </button>
                ) : (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate('/login')}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <RiAddLine size={15} /> Login to Ask
                  </button>
                )}

                {/* Refresh */}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={fetchQuestions}
                  disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                  title="Refresh"
                >
                  <RiRefreshLine size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                </button>
              </div>
            </div>

            {/* ── Search bar ──────────────────────────────────────────── */}
            <form onSubmit={handleSearch} style={{ marginTop: 16, position: 'relative' }}>
              <RiSearchLine size={15} style={{
                position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)', pointerEvents: 'none',
              }} />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search questions…"
                style={{
                  width: '100%', padding: '9px 40px 9px 36px',
                  borderRadius: 10, border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                  fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
                onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
              />
              {search && (
                <button
                  type="button"
                  onClick={clearSearch}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                    fontSize: '1rem', lineHeight: 1,
                  }}
                >×</button>
              )}
            </form>

            {/* ── Controls row ────────────────────────────────────────── */}
            <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Spotlight toggle */}
              <button
                onClick={toggleSpotlight}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 999, fontWeight: 700,
                  fontSize: '0.8rem', cursor: 'pointer', letterSpacing: '0.03em',
                  border: spotlightOnly ? '1.5px solid rgba(251,191,36,0.85)' : '1.5px solid rgba(251,191,36,0.4)',
                  background: spotlightOnly
                    ? 'linear-gradient(135deg, rgba(251,191,36,0.25), rgba(245,158,11,0.12))'
                    : 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(245,158,11,0.03))',
                  color: '#FBBF24',
                  animation: spotlightOnly ? 'spot-active 1.4s ease-out infinite' : 'spot-idle 2.5s ease-in-out infinite',
                  transition: 'background 0.18s, border 0.18s',
                }}
              >
                <RiFlashlightLine size={13} style={{ filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.8))' }} />
                Spotlight
                {spotlightCount > 0 && (
                  <span style={{
                    background: 'rgba(251,191,36,0.25)', color: '#FDE68A',
                    border: '1px solid rgba(251,191,36,0.45)',
                    borderRadius: 999, fontSize: '0.65rem', fontWeight: 800,
                    padding: '0 6px',
                  }}>
                    {spotlightCount}
                  </span>
                )}
              </button>

              {/* Divider */}
              <div style={{ width: 1, height: 22, background: 'var(--border-color)' }} />

              {/* Sort tabs */}
              <div style={{
                display: 'flex', background: 'var(--bg-secondary)',
                borderRadius: 10, padding: 3, gap: 2,
                border: '1px solid var(--border-color)',
              }}>
                {SORT_OPTIONS.map(o => (
                  <SortTab key={o.value} option={o} active={sort === o.value} onClick={() => handleSortChange(o.value)} />
                ))}
              </div>
            </div>

            {/* ── Category chips ────────────────────────────────────── */}
            <div style={{
              marginTop: 12, display: 'flex', gap: 7, flexWrap: 'nowrap',
              overflowX: 'auto', paddingBottom: 4,
            }}>
              {allCategories.map(cat => (
                <CategoryChip
                  key={cat.path}
                  label={cat.label}
                  active={category === cat.path}
                  onClick={() => handleCategoryChange(cat.path)}
                />
              ))}
            </div>
          </div>

          {/* ── Spotlight mode banner ─────────────────────────────── */}
          {spotlightOnly && !loading && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 14px', marginBottom: 14,
              background: 'linear-gradient(135deg, rgba(251,191,36,0.1), rgba(245,158,11,0.05))',
              border: '1px solid rgba(251,191,36,0.28)',
              borderRadius: 10,
            }}>
              <RiFlashlightLine size={14} style={{ color: '#FCD34D', flexShrink: 0 }} />
              <span style={{ color: '#FCD34D', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Community Spotlight — Needs Answers
              </span>
              <span style={{
                marginLeft: 'auto', background: 'rgba(251,191,36,0.2)', color: '#FBBF24',
                fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px',
                borderRadius: 999, border: '1px solid rgba(251,191,36,0.35)',
              }}>
                {spotlightCount} questions
              </span>
            </div>
          )}

          {/* Active search banner */}
          {search && !loading && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', marginBottom: 14,
              background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 10,
            }}>
              <RiSearchLine size={13} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Results for <strong>"{search}"</strong> — {total} found
              </span>
              <button onClick={clearSearch} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                Clear ×
              </button>
            </div>
          )}

          {/* ── Questions list ────────────────────────────────────────── */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)}
            </div>

          ) : spotlightOnly && spotlightCount === 0 ? (
            <div style={{
              textAlign: 'center', padding: '3rem 1rem',
              background: 'var(--bg-card)', borderRadius: 14,
              border: '1px solid rgba(251,191,36,0.2)',
            }}>
              <RiFlashlightLine size={36} style={{ color: '#FCD34D', marginBottom: 12 }} />
              <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 6 }}>No spotlight questions!</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                All open questions have been answered within 2 minutes — great job, community!
              </p>
            </div>

          ) : displayedQuestions.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '3rem 1rem',
              background: 'var(--bg-card)', borderRadius: 14,
              border: '1px solid var(--border-color)',
            }}>
              <RiStackLine size={36} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
              <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 6 }}>No questions found</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 16 }}>
                {search ? `No results for "${search}" — try different keywords.` : 'Be the first to ask a question!'}
              </p>
              {user && (
                <button className="btn btn-primary btn-sm" onClick={() => setIsModalOpen(true)}>
                  <RiAddLine size={14} /> Ask First Question
                </button>
              )}
            </div>

          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {displayedQuestions.map((q, i) => (
                <div key={q._id} className="q-card-enter" style={{ animationDelay: `${i * 0.04}s` }}>
                  <QuestionCard q={q} user={user} />
                </div>
              ))}
            </div>
          )}

          {/* ── Pagination ────────────────────────────────────────────── */}
          {!spotlightOnly && !loading && totalPages > 1 && (
            <div style={{
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              gap: 6, marginTop: 24, flexWrap: 'wrap',
            }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                  color: page === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                  fontSize: '0.82rem', fontWeight: 600, opacity: page === 1 ? 0.5 : 1,
                }}
              >
                <RiArrowLeftLine size={13} /> Prev
              </button>

              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = Math.max(1, Math.min(page - 3, totalPages - 6)) + i;
                if (p < 1 || p > totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    style={{
                      width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
                      background: page === p ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                      border: page === p ? 'none' : '1px solid var(--border-color)',
                      color: page === p ? '#fff' : 'var(--text-primary)',
                      fontSize: '0.82rem', fontWeight: page === p ? 700 : 500,
                    }}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                  color: page === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                  fontSize: '0.82rem', fontWeight: 600,
                  opacity: page === totalPages ? 0.5 : 1,
                }}
              >
                Next <RiArrowRightLine size={13} />
              </button>
            </div>
          )}

          {/* Spacing at bottom */}
          <div style={{ height: 32 }} />
        </div>
      </div>

      <AskQuestionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onQuestionPosted={() => { fetchQuestions(); }}
      />
    </>
  );
}
