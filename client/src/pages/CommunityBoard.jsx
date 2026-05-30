import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import VoteButtons from '../components/VoteButtons';
import AskQuestionModal from '../components/AskQuestionModal';
import { FaBolt, FaQuestion, FaCommentDots, FaEye, FaArrowLeft, FaArrowRight } from 'react-icons/fa';

export default function CommunityBoard() {
  const { user } = useAuth();
  const [questions, setQuestions]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [page, setPage]                   = useState(1);
  const [totalPages, setTotalPages]       = useState(1);
  const [total, setTotal]                 = useState(0);
  const [isModalOpen, setIsModalOpen]     = useState(false);
  const [spotlightOnly, setSpotlightOnly] = useState(false);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, sort: 'newest', status: 'open' });
      const res = await api.get(`/questions?${params}`);
      setQuestions(res.data.data);
      setTotalPages(res.data.pages);
      setTotal(res.data.total);
    } catch (error) {
      console.error('Failed to fetch questions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Community Board | Samagama';
    fetchQuestions();
  }, [page]);

  const timeAgo = (date) => {
    const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const spotlightedQuestions = questions.filter((q) => q.is_spotlighted);
  const regularQuestions     = questions.filter((q) => !q.is_spotlighted);
  const displayedQuestions   = spotlightOnly ? spotlightedQuestions : regularQuestions;
  const spotlightCount       = spotlightedQuestions.length;

  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{
              fontSize: '2rem', fontWeight: 800,
              background: 'var(--gradient-primary)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              Community Board
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{total} questions</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link to="/faq" className="btn btn-secondary btn-sm">
              <FaBolt style={{ color: '#FCD34D' }} /> Ask Yaksha First
            </Link>
            {user && (
              <button className="btn btn-primary btn-sm" onClick={() => setIsModalOpen(true)}>
                Ask Question
              </button>
            )}
          </div>
        </div>

        {/* Single Spotlight toggle */}
        <div style={{ marginBottom: '1.5rem' }}>
          <style>{`
            @keyframes spot-pulse {
              0%   { box-shadow: 0 0 0 0   rgba(251,191,36,0.6), 0 0 14px 2px rgba(251,191,36,0.28); }
              60%  { box-shadow: 0 0 0 9px rgba(251,191,36,0),   0 0 24px 7px rgba(251,191,36,0.12); }
              100% { box-shadow: 0 0 0 0   rgba(251,191,36,0),   0 0 14px 2px rgba(251,191,36,0.28); }
            }
            @keyframes spot-idle {
              0%,100% { box-shadow: 0 0 7px 1px rgba(251,191,36,0.22), inset 0 0 0 1.5px rgba(251,191,36,0.45); }
              50%      { box-shadow: 0 0 18px 5px rgba(251,191,36,0.38), inset 0 0 0 1.5px rgba(251,191,36,0.75); }
            }
            #spotlight-toggle {
              animation: ${spotlightOnly ? 'spot-pulse 1.5s ease-out infinite' : 'spot-idle 2.2s ease-in-out infinite'};
              transition: transform 0.15s, filter 0.15s, background 0.18s;
            }
            #spotlight-toggle:hover { transform: scale(1.05); filter: brightness(1.14); }
          `}</style>
          <button
            id="spotlight-toggle"
            onClick={() => { setSpotlightOnly((v) => !v); setPage(1); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 1.15rem',
              borderRadius: '999px',
              border: spotlightOnly
                ? '1.5px solid rgba(251,191,36,0.9)'
                : '1.5px solid rgba(251,191,36,0.55)',
              background: spotlightOnly
                ? 'linear-gradient(135deg, rgba(251,191,36,0.28), rgba(245,158,11,0.15))'
                : 'linear-gradient(135deg, rgba(251,191,36,0.1), rgba(245,158,11,0.05))',
              color: '#FBBF24',
              fontWeight: 700,
              fontSize: '0.82rem',
              letterSpacing: '0.04em',
              cursor: 'pointer',
              textShadow: '0 0 10px rgba(251,191,36,0.55)',
            }}
          >
            <FaBolt style={{
              color: '#FCD34D',
              fontSize: '0.82rem',
              filter: 'drop-shadow(0 0 5px rgba(251,191,36,0.85))',
            }} />
            Spotlight
            {spotlightCount > 0 && (
              <span style={{
                background: spotlightOnly ? 'rgba(251,191,36,0.3)' : 'rgba(251,191,36,0.15)',
                color: '#FDE68A',
                border: '1px solid rgba(251,191,36,0.5)',
                borderRadius: '999px',
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '0.05rem 0.45rem',
                marginLeft: '0.1rem',
                textShadow: 'none',
              }}>
                {spotlightCount}
              </span>
            )}
          </button>
        </div>

        {/* Questions list */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton-card">
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div className="skeleton" style={{ width: '40px', height: '60px', borderRadius: '8px' }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton skeleton-title" style={{ width: '70%' }} />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div className="skeleton skeleton-text" style={{ width: '60px' }} />
                      <div className="skeleton skeleton-text" style={{ width: '60px' }} />
                      <div className="skeleton skeleton-text" style={{ width: '80px' }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : spotlightOnly && spotlightCount === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FaBolt style={{ color: '#FCD34D' }} /></div>
            <div className="empty-state-text">No spotlight questions</div>
            <p style={{ color: 'var(--text-muted)' }}>
              All open questions have been answered within 2 minutes — great job!
            </p>
          </div>
        ) : displayedQuestions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FaQuestion /></div>
            <div className="empty-state-text">No questions found</div>
            <p style={{ color: 'var(--text-muted)' }}>Ask Yaksha first or post a question!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

            {/* Spotlight mode banner */}
            {spotlightOnly && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.85rem',
                background: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(245,158,11,0.06))',
                border: '1px solid rgba(251,191,36,0.3)',
                borderRadius: '10px',
                marginBottom: '0.25rem',
              }}>
                <FaBolt style={{ color: '#FCD34D', fontSize: '0.8rem' }} />
                <span style={{ color: '#FCD34D', fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Community Spotlight — Needs Answers
                </span>
                <span style={{
                  marginLeft: 'auto',
                  background: 'rgba(251,191,36,0.2)', color: '#FBBF24',
                  fontSize: '0.7rem', fontWeight: 700,
                  padding: '0.12rem 0.45rem', borderRadius: '999px',
                  border: '1px solid rgba(251,191,36,0.4)',
                }}>
                  {spotlightCount}
                </span>
              </div>
            )}

            {displayedQuestions.map((q) => (
              <Link
                key={q._id}
                to={`/faq/community/${q._id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div
                  className="card"
                  style={{
                    cursor: 'pointer',
                    ...(q.is_spotlighted ? {
                      border: '1px solid rgba(251,191,36,0.45)',
                      boxShadow: '0 0 0 1px rgba(251,191,36,0.12), 0 2px 14px rgba(251,191,36,0.07)',
                      position: 'relative',
                      overflow: 'visible',
                    } : {}),
                  }}
                >
                  {/* Pulse dot for spotlighted */}
                  {q.is_spotlighted && (
                    <span style={{
                      position: 'absolute', top: '-4px', right: '-4px',
                      width: '9px', height: '9px', borderRadius: '50%',
                      background: '#FCD34D',
                      boxShadow: '0 0 0 3px rgba(252,211,77,0.25)',
                      animation: 'pulse 2s infinite',
                    }} />
                  )}

                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div onClick={(e) => e.preventDefault()} style={{ flexShrink: 0 }}>
                      <VoteButtons
                        questionId={q._id}
                        initialScore={q.net_score || 0}
                        isOwn={q.posted_by?._id === user?._id}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {q.is_spotlighted && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.3rem' }}>
                          <FaBolt style={{ color: '#FCD34D', fontSize: '0.7rem' }} />
                          <span style={{ color: '#FCD34D', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                            SPOTLIGHT
                          </span>
                        </div>
                      )}
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                        {q.rephrased_query}
                      </h3>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="badge badge-primary">{q.category}</span>
                        <span className={`badge ${q.status === 'open' ? 'badge-warning' : 'badge-success'}`}>
                          {q.status}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          <FaCommentDots style={{ marginRight: '0.2rem' }} /> {q.answer_count} answers
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          <FaEye style={{ marginRight: '0.2rem' }} /> {q.view_count} views
                        </span>
                        <span style={{
                          color: q.is_spotlighted ? '#FBBF24' : 'var(--text-muted)',
                          fontSize: '0.8rem',
                          fontWeight: q.is_spotlighted ? 600 : 400,
                        }}>
                          {timeAgo(q.created_at)}
                        </span>
                      </div>
                    </div>
                    {q.posted_by && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        by {q.posted_by.name}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination — hidden in spotlight mode */}
        {!spotlightOnly && totalPages > 1 && (
          <div className="pagination">
            <button
              className="pagination-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <FaArrowLeft style={{ marginRight: '0.3rem' }} /> Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                className={`pagination-btn ${page === p ? 'active' : ''}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button
              className="pagination-btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next <FaArrowRight style={{ marginLeft: '0.3rem' }} />
            </button>
          </div>
        )}

        <AskQuestionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onQuestionPosted={() => fetchQuestions()}
        />
      </div>
    </div>
  );
}
