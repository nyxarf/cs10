import { useState, useEffect, useCallback } from 'react';
import { adminGetSpotlightedQuestions } from '../services/api';
import {
  LuZap, LuRefreshCw, LuExternalLink, LuMessageSquare, LuEye,
  LuClock, LuChevronLeft, LuChevronRight, LuUsers
} from 'react-icons/lu';

const CLIENT_URL = 'http://localhost:5173';

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function SpotlightBadge() {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.3rem',
      background: 'linear-gradient(135deg, rgba(251,191,36,0.2), rgba(245,158,11,0.15))',
      color: '#FBBF24',
      border: '1px solid rgba(251,191,36,0.5)',
      borderRadius: '999px',
      padding: '0.2rem 0.6rem',
      fontSize: '0.7rem',
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    }}>
      <LuZap size={10} />
      Spotlight
    </span>
  );
}

export default function SpotlightedQuestions() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]         = useState(0);
  const LIMIT = 20;

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const res = await adminGetSpotlightedQuestions({ page: p, limit: LIMIT });
      setQuestions(res.data || []);
      setTotal(res.total || 0);
      setTotalPages(res.pages || 1);
    } catch (err) {
      console.error('Failed to load spotlighted questions:', err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    document.title = 'Spotlight | Admin';
    load(page);
  }, [page]);

  const openQuestion = (id) => {
    window.open(`${CLIENT_URL}/faq/community/${id}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(251,191,36,0.25), rgba(245,158,11,0.15))',
              border: '1px solid rgba(251,191,36,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <LuZap size={16} style={{ color: '#FBBF24' }} />
            </div>
            <h1 style={{ margin: 0 }}>Community Spotlight</h1>
          </div>
          <p style={{ margin: 0 }}>
            Open questions with no answers, posted more than 2 minutes ago &mdash; they need attention.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Live count pill */}
          {!loading && (
            <span style={{
              background: 'linear-gradient(135deg, rgba(251,191,36,0.2), rgba(245,158,11,0.12))',
              color: '#FBBF24',
              border: '1px solid rgba(251,191,36,0.4)',
              borderRadius: '999px',
              padding: '0.3rem 0.8rem',
              fontSize: '0.8rem',
              fontWeight: 700,
            }}>
              {total} unanswered
            </span>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => load(page)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <LuRefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="card fade-in">
        <div className="card-header">
          <div className="card-title">
            <LuZap size={17} style={{ color: '#FBBF24' }} />
            Spotlighted Questions
          </div>
          <span className="badge" style={{
            background: 'rgba(251,191,36,0.15)',
            color: '#FBBF24',
            border: '1px solid rgba(251,191,36,0.35)',
          }}>
            {total} total
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton" style={{ height: 72, borderRadius: 10 }} />
            ))}
          </div>
        ) : questions.length === 0 ? (
          <div className="empty-state" style={{ padding: '3rem 1rem' }}>
            <div className="empty-state-icon">
              <LuZap size={28} style={{ color: '#FBBF24' }} />
            </div>
            <h3 style={{ color: 'var(--text-1)', marginBottom: '0.5rem' }}>No spotlight questions!</h3>
            <p style={{ color: 'var(--text-3)' }}>
              All community questions have been answered within 2 minutes. Great job!
            </p>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Question</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'center' }}>
                      <LuEye size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Views
                    </th>
                    <th>
                      <LuUsers size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Asked By
                    </th>
                    <th>
                      <LuClock size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Posted
                    </th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => (
                    <tr key={q._id} style={{ cursor: 'pointer' }} onClick={() => openQuestion(q._id)}>
                      <td style={{ maxWidth: 340 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <SpotlightBadge />
                        </div>
                        <span style={{
                          fontWeight: 500,
                          color: 'var(--text-1)',
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 320,
                        }}>
                          {q.rephrased_query || q.original_query}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-violet">{q.category || '—'}</span>
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--text-2)', fontSize: '0.85rem' }}>
                        {q.view_count ?? 0}
                      </td>
                      <td style={{ color: 'var(--text-2)', fontSize: '0.85rem' }}>
                        {q.posted_by?.name || '—'}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                        {timeAgo(q.created_at)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={(e) => { e.stopPropagation(); openQuestion(q._id); }}
                          title="Open question on community board"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                        >
                          <LuExternalLink size={13} /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '1rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <LuChevronLeft size={14} /> Prev
                </button>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  Next <LuChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
