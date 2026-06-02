import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useCategories } from '../hooks/useCategories';
import {
  RiCheckboxCircleLine, RiChat3Line, RiEyeLine, RiTimeLine,
  RiThumbUpLine, RiGridLine, RiFilterLine, RiRefreshLine,
  RiFlashlightLine, RiUserLine, RiStackLine,
} from 'react-icons/ri';

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function AnswererDashboard() {
  const { categories: dbCategories, loading: catLoading } = useCategories();
  const [questions, setQuestions]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedCat, setSelectedCat]   = useState(null);   // category_path or null = All
  const [categoryCounts, setCategoryCounts] = useState({});
  const [totalCount, setTotalCount]     = useState(0);

  /* ── Fetch per-category counts (single request with all status=open) ── */
  useEffect(() => {
    if (!dbCategories.length) return;
    const fetchCounts = async () => {
      try {
        const res = await api.get('/questions?status=open&limit=1');
        setTotalCount(res.data.total || 0);
      } catch { setTotalCount(0); }

      const counts = {};
      await Promise.all(
        dbCategories.map(async cat => {
          try {
            const res = await api.get(`/questions?status=open&limit=1&category_path=${encodeURIComponent(cat.path)}`);
            counts[cat.path] = res.data.total || 0;
          } catch { counts[cat.path] = 0; }
        })
      );
      setCategoryCounts(counts);
    };
    fetchCounts();
  }, [dbCategories]);

  /* ── Fetch question list ───────────────────────────────────────────── */
  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: 'open', sort: 'newest', limit: 50 });
      if (selectedCat) params.append('category_path', selectedCat);
      const res = await api.get(`/questions?${params}`);
      // Sort unanswered first
      const sorted = (res.data.data || []).sort((a, b) => a.answer_count - b.answer_count);
      setQuestions(sorted);
    } catch { setQuestions([]); }
    finally { setLoading(false); }
  }, [selectedCat]);

  useEffect(() => {
    document.title = 'Answer Dashboard | Samagama';
    fetchQuestions();
  }, [fetchQuestions]);

  const selectedLabel = selectedCat
    ? (dbCategories.find(c => c.path === selectedCat)?.label || selectedCat)
    : 'All Categories';

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ad-card { animation: fadeUp 0.2s ease both; }
        .cat-btn { transition: background 0.15s, color 0.15s, border-color 0.15s; }
        .cat-btn:hover { filter: brightness(1.1); }
        .q-row:hover { background: var(--bg-glass-hover) !important; }
        .q-row { transition: background 0.12s; }
      `}</style>

      <div className="page">
        <div className="container" style={{ maxWidth: 1000 }}>

          {/* ── Header ─────────────────────────────────────────────── */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h1 style={{
              fontSize: '1.9rem', fontWeight: 800, margin: 0,
              background: 'var(--gradient-primary)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              Answer Dashboard
            </h1>
            <p style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: '0.875rem' }}>
              Help the community — {loading ? '…' : `${questions.length} open question${questions.length !== 1 ? 's' : ''}`} waiting for answers
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.5rem', alignItems: 'start' }}>

            {/* ── Sidebar ──────────────────────────────────────────── */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: 14, padding: '14px 10px', position: 'sticky', top: 80,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 6px', marginBottom: 10,
              }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Categories
                </span>
                <button
                  onClick={fetchQuestions}
                  disabled={loading}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
                  title="Refresh"
                >
                  <RiRefreshLine size={13} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* All */}
                <button
                  className="cat-btn"
                  onClick={() => setSelectedCat(null)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: !selectedCat ? 'var(--accent-primary)' : 'transparent',
                    color: !selectedCat ? '#fff' : 'var(--text-secondary)',
                    fontSize: '0.82rem', fontWeight: 600, textAlign: 'left',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <RiGridLine size={13} /> All Categories
                  </span>
                  <span style={{
                    padding: '1px 7px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 800,
                    background: !selectedCat ? 'rgba(255,255,255,0.25)' : 'var(--bg-secondary)',
                    color: !selectedCat ? '#fff' : 'var(--text-muted)',
                  }}>
                    {totalCount}
                  </span>
                </button>

                {/* Per-category */}
                {catLoading
                  ? [1,2,3,4].map(i => (
                    <div key={i} style={{ height: 32, borderRadius: 8, background: 'var(--skeleton-base)', margin: '2px 0' }} />
                  ))
                  : dbCategories.map(cat => (
                    <button
                      key={cat.path}
                      className="cat-btn"
                      onClick={() => setSelectedCat(cat.path)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: selectedCat === cat.path ? 'rgba(99,102,241,0.15)' : 'transparent',
                        color: selectedCat === cat.path ? 'var(--accent-primary-light)' : 'var(--text-secondary)',
                        fontSize: '0.82rem', fontWeight: selectedCat === cat.path ? 700 : 500,
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                        {cat.label}
                      </span>
                      {(categoryCounts[cat.path] || 0) > 0 && (
                        <span style={{
                          padding: '1px 7px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 800,
                          background: selectedCat === cat.path ? 'rgba(99,102,241,0.25)' : 'var(--bg-secondary)',
                          color: selectedCat === cat.path ? 'var(--accent-primary-light)' : 'var(--text-muted)',
                          flexShrink: 0,
                        }}>
                          {categoryCounts[cat.path]}
                        </span>
                      )}
                    </button>
                  ))
                }
              </div>
            </div>

            {/* ── Question list ─────────────────────────────────────── */}
            <div>
              {/* Section header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                padding: '10px 14px',
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                borderRadius: 12,
              }}>
                <RiFilterLine size={14} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {selectedLabel}
                </span>
                {!loading && (
                  <span style={{
                    marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)',
                  }}>
                    {questions.filter(q => q.answer_count === 0).length} unanswered
                    {' · '}
                    {questions.length} total open
                  </span>
                )}
              </div>

              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1,2,3,4,5].map(i => (
                    <div key={i} style={{
                      height: 78, borderRadius: 12, background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                    }} />
                  ))}
                </div>

              ) : questions.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '3rem 1rem',
                  background: 'var(--bg-card)', borderRadius: 14,
                  border: '1px solid var(--border-color)',
                }}>
                  <RiCheckboxCircleLine size={40} style={{ color: 'var(--accent-success)', marginBottom: 12 }} />
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 6 }}>All caught up!</div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    No open questions in this category. Check back later!
                  </p>
                </div>

              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {questions.map((q, i) => (
                    <Link
                      key={q._id}
                      to={`/faq/community/${q._id}`}
                      className="ad-card"
                      style={{ textDecoration: 'none', color: 'inherit', animationDelay: `${i * 0.03}s` }}
                    >
                      <div
                        className="q-row"
                        style={{
                          background: 'var(--bg-card)',
                          border: q.answer_count === 0
                            ? '1px solid rgba(239,68,68,0.25)'
                            : '1px solid var(--border-color)',
                          borderRadius: 12, padding: '12px 16px', cursor: 'pointer',
                          borderLeft: q.answer_count === 0
                            ? '3px solid rgba(239,68,68,0.6)'
                            : '3px solid var(--accent-primary)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          {/* Unanswered badge */}
                          <div style={{ flexShrink: 0, paddingTop: 2 }}>
                            {q.answer_count === 0
                              ? <span style={{
                                  padding: '3px 8px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 800,
                                  background: 'rgba(239,68,68,0.12)', color: '#f87171',
                                  border: '1px solid rgba(239,68,68,0.25)',
                                }}>Unanswered</span>
                              : <span style={{
                                  display: 'flex', alignItems: 'center', gap: 4,
                                  padding: '3px 8px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 700,
                                  background: 'rgba(16,185,129,0.12)', color: '#34d399',
                                  border: '1px solid rgba(16,185,129,0.25)',
                                }}>
                                  <RiChat3Line size={10} /> {q.answer_count}
                                </span>
                            }
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{
                              fontSize: '0.92rem', fontWeight: 600, margin: '0 0 7px',
                              color: 'var(--text-primary)', lineHeight: 1.45,
                              overflow: 'hidden', display: '-webkit-box',
                              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                            }}>
                              {q.rephrased_query}
                            </p>

                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                              {/* Category label (prefer DB label) */}
                              <span style={{
                                padding: '2px 8px', borderRadius: 999, fontSize: '0.67rem', fontWeight: 700,
                                background: 'rgba(99,102,241,0.12)', color: '#818cf8',
                                border: '1px solid rgba(99,102,241,0.22)',
                              }}>
                                {q.category_label || (dbCategories.find(c => c.path === q.category_path)?.label) || q.category}
                              </span>

                              <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                <RiEyeLine size={11} /> {q.view_count}
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                <RiThumbUpLine size={11} /> {q.net_score ?? 0}
                              </span>
                              {q.posted_by && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                  <RiUserLine size={11} /> {q.posted_by.name}
                                </span>
                              )}
                              <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                {timeAgo(q.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
