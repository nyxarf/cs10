import { useState, useEffect, useCallback } from 'react';
import {
  adminGetModeration, adminApproveSubmission, adminRejectSubmission,
  adminPromoteSubmission, adminAutoModerate,
  adminGetPendingQuestions, adminApproveQuestion, adminRejectQuestion,
  adminGetAllQuestions, adminUpdateQuestionStatus,
  adminGetAllAnswers, adminUpdateAnswerStatus,
  adminDeleteCommunityQuestion, adminPinQuestion,
} from '../services/api';
import {
  LuShieldCheck, LuCircleCheck, LuCircleX, LuRefreshCw,
  LuTriangleAlert, LuFlag, LuUser, LuCalendar, LuMessageSquare,
  LuArrowUpDown, LuEye, LuTrash2, LuChevronLeft, LuChevronRight,
  LuFilter, LuZap, LuPin, LuPinOff,
} from 'react-icons/lu';

/* ── helpers ──────────────────────────────────────────────────────────────── */
function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const Q_STATUSES  = ['all', 'open', 'answered', 'review', 'hidden', 'closed'];
const A_STATUSES  = ['all', 'live', 'flagged', 'hidden'];
const STATUS_COLORS = {
  open:     { bg: 'rgba(16,185,129,0.12)',  text: '#34d399', border: 'rgba(16,185,129,0.3)' },
  answered: { bg: 'rgba(99,102,241,0.12)',  text: '#818cf8', border: 'rgba(99,102,241,0.3)' },
  review:   { bg: 'rgba(245,158,11,0.12)',  text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
  hidden:   { bg: 'rgba(239,68,68,0.12)',   text: '#f87171', border: 'rgba(239,68,68,0.3)'  },
  closed:   { bg: 'rgba(107,114,128,0.15)', text: '#9ca3af', border: 'rgba(107,114,128,0.3)' },
  live:     { bg: 'rgba(16,185,129,0.12)',  text: '#34d399', border: 'rgba(16,185,129,0.3)' },
  flagged:  { bg: 'rgba(245,158,11,0.12)',  text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
};

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.hidden;
  return (
    <span style={{
      padding: '2px 9px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      textTransform: 'capitalize',
    }}>
      {status}
    </span>
  );
}

function TabBtn({ active, onClick, children, count }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
      fontWeight: 600, fontSize: '0.875rem', transition: 'all 0.15s',
      background: active ? 'var(--primary)' : 'transparent',
      color: active ? '#fff' : 'var(--text-2)',
      display: 'flex', alignItems: 'center', gap: 7,
    }}>
      {children}
      {count > 0 && (
        <span style={{
          background: active ? 'rgba(255,255,255,0.25)' : 'var(--danger-light)',
          color: active ? '#fff' : 'var(--danger)',
          borderRadius: 99, padding: '1px 7px', fontSize: '0.6875rem', fontWeight: 700,
        }}>{count}</span>
      )}
    </button>
  );
}

function FilterBar({ statuses, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
      {statuses.map(s => (
        <button
          key={s}
          onClick={() => onChange(s)}
          style={{
            padding: '5px 14px', borderRadius: 999, border: '1px solid',
            fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.12s',
            ...(active === s
              ? { background: 'var(--primary)', borderColor: 'var(--primary)', color: '#fff' }
              : { background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-2)' }),
          }}
        >
          {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
        </button>
      ))}
    </div>
  );
}

function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 20 }}>
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
      >
        <LuChevronLeft size={14} /> Prev
      </button>
      <span style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>
        Page {page} of {pages}
      </span>
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => onPage(page + 1)}
        disabled={page >= pages}
        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
      >
        Next <LuChevronRight size={14} />
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TABS
   ════════════════════════════════════════════════════════════════════════════ */

/* ── Tab 1: Flagged Answers (AI-flagged, need manual review) ─────────────── */
function FlaggedAnswersTab({ showToast, onRefreshNeeded }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(null);
  const [xpMap, setXpMap]     = useState({});
  const [autoRunning, setAutoRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGetModeration();
      setItems(res.data || []);
    } catch { showToast('Failed to load flagged answers', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const xpOf   = id => xpMap[id] || { answererXp: 25, askerXp: 15 };
  const setXp  = (id, key, val) => setXpMap(p => ({ ...p, [id]: { ...xpOf(id), [key]: Number(val) } }));

  const approve  = async id => { setBusy(id); try { await adminApproveSubmission(id, xpOf(id));  showToast('Answer approved!');           load(); } catch(e) { showToast(e.response?.data?.error || 'Failed', 'error'); } finally { setBusy(null); }};
  const reject   = async id => { setBusy(id); try { await adminRejectSubmission(id);              showToast('Answer rejected.');           load(); } catch(e) { showToast(e.response?.data?.error || 'Failed', 'error'); } finally { setBusy(null); }};
  const promote  = async id => { setBusy(id); try { await adminPromoteSubmission(id, xpOf(id));  showToast('Promoted to FAQ corpus!');    load(); } catch(e) { showToast(e.response?.data?.error || 'Failed', 'error'); } finally { setBusy(null); }};

  const autoMod = async () => {
    if (!window.confirm('Run AI auto-moderation on all flagged answers?')) return;
    setAutoRunning(true);
    showToast('Auto-moderating…', 'success');
    try { const r = await adminAutoModerate(); showToast(r.message); load(); }
    catch(e) { showToast(e.response?.data?.error || 'Failed', 'error'); }
    finally { setAutoRunning(false); }
  };

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 180 }} />)}</div>;

  if (items.length === 0) return (
    <div className="card">
      <div className="empty-state">
        <div className="empty-state-icon"><LuShieldCheck size={28} style={{ color: 'var(--success)' }} /></div>
        <h3>All clear!</h3>
        <p>No flagged answers to review right now.</p>
      </div>
    </div>
  );

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={autoMod}
          disabled={autoRunning}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {autoRunning ? <LuRefreshCw className="spin" size={14} /> : <LuZap size={14} />}
          {autoRunning ? 'Processing…' : `Auto-Moderate All (${items.length})`}
        </button>
      </div>

      {items.map(a => {
        const xp = xpOf(a._id);
        return (
          <div key={a._id} className="card fade-in" style={{ padding: 24, marginBottom: 16 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <StatusBadge status="flagged" />
                <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
                  {a.question_id?.category_label || a.question_id?.category || 'general'}
                </span>
                {a.flag_reason && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: '#fbbf24', fontWeight: 600 }}>
                    <LuTriangleAlert size={12} /> {a.flag_reason}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-3)', fontSize: '0.78rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><LuUser size={12} /> {a.answered_by?.name || 'Anonymous'}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><LuCalendar size={12} /> {timeAgo(a.created_at)}</span>
                <span style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--surface-2)', fontSize: '0.72rem' }}>
                  {a.upvotes || 0}▲ {a.downvotes || 0}▼ score: {a.net_score || 0}
                </span>
              </div>
            </div>

            {/* Question */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Question</p>
              <p style={{ fontWeight: 600, fontSize: '0.97rem' }}>{a.question_id?.rephrased_query || 'N/A'}</p>
              {a.question_id?.posted_by?.name && <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: 3 }}>Asked by {a.question_id.posted_by.name}</p>}
            </div>

            {/* Answer */}
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Answer</p>
              <div style={{ background: 'var(--surface-2)', padding: '12px 16px', borderRadius: 8, borderLeft: '3px solid var(--primary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                {a.content}
              </div>
            </div>

            {/* XP sliders */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18, background: 'var(--surface-2)', padding: 14, borderRadius: 8 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.82rem' }}>
                  <span style={{ fontWeight: 600 }}>Answerer Reward</span>
                  <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{xp.answererXp} SP</span>
                </div>
                <input type="range" min={0} max={100} step={5} value={xp.answererXp} onChange={e => setXp(a._id, 'answererXp', e.target.value)} style={{ width: '100%' }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.82rem' }}>
                  <span style={{ fontWeight: 600 }}>Asker Reward</span>
                  <span style={{ color: 'var(--success)', fontWeight: 700 }}>{xp.askerXp} SP</span>
                </div>
                <input type="range" min={0} max={100} step={5} value={xp.askerXp} onChange={e => setXp(a._id, 'askerXp', e.target.value)} style={{ width: '100%' }} />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button className="btn btn-danger btn-sm" disabled={busy === a._id} onClick={() => reject(a._id)} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <LuCircleX size={14} /> Reject & Hide
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" disabled={busy === a._id} onClick={() => approve(a._id)} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <LuCircleCheck size={14} /> Approve & Live
                </button>
                <button className="btn btn-primary btn-sm" disabled={busy === a._id} onClick={() => promote(a._id)} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <LuShieldCheck size={14} /> Promote to FAQ
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ── Tab 2: Pending Questions (status='review') ──────────────────────────── */
function PendingQuestionsTab({ showToast }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(null);
  const [xpMap, setXpMap]     = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGetPendingQuestions();
      setItems(res.data || []);
    } catch { showToast('Failed to load pending questions', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const xpOf  = id => xpMap[id] || { askerXp: 15 };
  const setXp = (id, val) => setXpMap(p => ({ ...p, [id]: { askerXp: Number(val) } }));

  const approve = async id => {
    setBusy(id);
    try { await adminApproveQuestion(id, { askerXp: xpOf(id).askerXp }); showToast('Question approved!'); load(); }
    catch(e) { showToast(e.response?.data?.error || 'Failed', 'error'); }
    finally { setBusy(null); }
  };
  const reject = async id => {
    setBusy(id);
    try { await adminRejectQuestion(id); showToast('Question rejected.'); load(); }
    catch(e) { showToast(e.response?.data?.error || 'Failed', 'error'); }
    finally { setBusy(null); }
  };

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 160 }} />)}</div>;

  if (items.length === 0) return (
    <div className="card">
      <div className="empty-state">
        <div className="empty-state-icon"><LuShieldCheck size={28} style={{ color: 'var(--success)' }} /></div>
        <h3>All clear!</h3>
        <p>No questions in review queue.</p>
      </div>
    </div>
  );

  return items.map(q => {
    const xp = xpOf(q._id);
    return (
      <div key={q._id} className="card fade-in" style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <StatusBadge status="review" />
            <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
              {q.category_label || q.category || 'general'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-3)', fontSize: '0.78rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><LuUser size={12} /> {q.posted_by?.name || 'Anonymous'}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><LuCalendar size={12} /> {timeAgo(q.created_at)}</span>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Original Query</p>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-2)' }}>{q.original_query}</p>
        </div>

        <div style={{ marginBottom: 18 }}>
          <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rephrased by AI</p>
          <div style={{ background: 'var(--surface-2)', padding: '12px 16px', borderRadius: 8, borderLeft: '3px solid var(--primary)', fontWeight: 600, fontSize: '1rem' }}>
            {q.rephrased_query}
          </div>
        </div>

        <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 8, marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.82rem' }}>
            <span style={{ fontWeight: 600 }}>Asker Reward (if approved)</span>
            <span style={{ color: 'var(--success)', fontWeight: 700 }}>{xp.askerXp} SP</span>
          </div>
          <input type="range" min={0} max={100} step={5} value={xp.askerXp} onChange={e => setXp(q._id, e.target.value)} style={{ width: '100%' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button className="btn btn-danger btn-sm" disabled={busy === q._id} onClick={() => reject(q._id)} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <LuCircleX size={14} /> Reject & Hide
          </button>
          <button className="btn btn-secondary btn-sm" disabled={busy === q._id} onClick={() => approve(q._id)} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <LuCircleCheck size={14} /> Approve & Publish
          </button>
        </div>
      </div>
    );
  });
}

/* ── Tab 3: All Questions (full status management) ───────────────────────── */
function AllQuestionsTab({ showToast }) {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [busy, setBusy]         = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage]         = useState(1);
  const [pages, setPages]       = useState(1);
  const [total, setTotal]       = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGetAllQuestions({ status: statusFilter, page, limit: 25 });
      setItems(res.data || []);
      setTotal(res.total || 0);
      setPages(res.pages || 1);
    } catch { showToast('Failed to load questions', 'error'); }
    finally { setLoading(false); }
  }, [statusFilter, page]);

  useEffect(() => { setPage(1); }, [statusFilter]);
  useEffect(() => { load(); }, [load]);

  const changeStatus = async (id, newStatus) => {
    setBusy(id);
    try {
      await adminUpdateQuestionStatus(id, newStatus);
      showToast(`Status → ${newStatus}`);
      load();
    } catch(e) { showToast(e.response?.data?.error || 'Failed', 'error'); }
    finally { setBusy(null); }
  };

  const pinQuestion = async (id) => {
    setBusy(id);
    try {
      const res = await adminPinQuestion(id);
      showToast(res.message);
      // Optimistic update — flip local state without full reload
      setItems(prev => prev.map(q => q._id === id ? { ...q, is_pinned: res.is_pinned } : q));
    } catch(e) { showToast(e.response?.data?.error || 'Failed to pin', 'error'); }
    finally { setBusy(null); }
  };

  const deleteQ = async (id, text) => {
    if (!window.confirm(`Delete "${text?.slice(0, 60)}"? This also deletes all its answers.`)) return;
    setBusy(id);
    try { await adminDeleteCommunityQuestion(id); showToast('Question deleted.'); load(); }
    catch(e) { showToast(e.response?.data?.error || 'Failed', 'error'); }
    finally { setBusy(null); }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>{total} question{total !== 1 ? 's' : ''}</span>
        <button className="btn btn-secondary btn-sm" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <LuRefreshCw size={13} /> Refresh
        </button>
      </div>

      <FilterBar statuses={Q_STATUSES} active={statusFilter} onChange={setStatusFilter} />

      {loading
        ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 72 }} />)}</div>
        : items.length === 0
          ? <div className="card"><div className="empty-state"><p>No questions with status "{statusFilter}".</p></div></div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(q => (
                <div key={q._id} className="card" style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {q.rephrased_query}
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <StatusBadge status={q.status} />
                      <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.66rem', fontWeight: 700, background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>
                        {q.category_label || q.category}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-3)', fontSize: '0.73rem' }}>
                        <LuMessageSquare size={11} /> {q.answer_count}
                      </span>
                      <span style={{ color: 'var(--text-3)', fontSize: '0.73rem' }}>{timeAgo(q.created_at)}</span>
                      {q.posted_by?.name && <span style={{ color: 'var(--text-3)', fontSize: '0.73rem' }}>{q.posted_by.name}</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                    {/* Pin toggle */}
                    <button
                      title={q.is_pinned ? 'Unpin question' : 'Pin to top'}
                      disabled={busy === q._id}
                      onClick={() => pinQuestion(q._id)}
                      style={{
                        padding: '4px 8px', borderRadius: 6, border: '1px solid',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.15s',
                        ...(q.is_pinned
                          ? { background: 'rgba(251,191,36,0.18)', borderColor: 'rgba(251,191,36,0.6)', color: '#FBBF24' }
                          : { background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-3)' }),
                      }}
                    >
                      {q.is_pinned ? <LuPin size={13} /> : <LuPinOff size={13} />}
                      {q.is_pinned ? 'Pinned' : 'Pin'}
                    </button>

                    {/* Status quick-change */}
                    <select
                      value={q.status}
                      onChange={e => changeStatus(q._id, e.target.value)}
                      disabled={busy === q._id}
                      style={{
                        padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
                        background: 'var(--surface)', color: 'var(--text-1)',
                        fontSize: '0.78rem', cursor: 'pointer',
                      }}
                    >
                      {['open','answered','review','hidden','closed'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>

                    <button
                      className="btn btn-danger btn-sm"
                      disabled={busy === q._id}
                      onClick={() => deleteQ(q._id, q.rephrased_query)}
                      title="Delete question"
                      style={{ padding: '4px 8px' }}
                    >
                      <LuTrash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
      }
      <Pagination page={page} pages={pages} onPage={setPage} />
    </>
  );
}

/* ── Tab 4: All Answers (full status management) ─────────────────────────── */
function AllAnswersTab({ showToast }) {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [busy, setBusy]         = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage]         = useState(1);
  const [pages, setPages]       = useState(1);
  const [total, setTotal]       = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGetAllAnswers({ status: statusFilter, page, limit: 25 });
      setItems(res.data || []);
      setTotal(res.total || 0);
      setPages(res.pages || 1);
    } catch { showToast('Failed to load answers', 'error'); }
    finally { setLoading(false); }
  }, [statusFilter, page]);

  useEffect(() => { setPage(1); }, [statusFilter]);
  useEffect(() => { load(); }, [load]);

  const changeStatus = async (id, newStatus) => {
    setBusy(id);
    try {
      await adminUpdateAnswerStatus(id, newStatus);
      showToast(`Status → ${newStatus}`);
      load();
    } catch(e) { showToast(e.response?.data?.error || 'Failed', 'error'); }
    finally { setBusy(null); }
  };

  const promote = async (id) => {
    setBusy(id);
    try {
      await adminPromoteSubmission(id, { answererXp: 25, askerXp: 15 });
      showToast('Promoted to FAQ corpus!');
      load();
    } catch(e) { showToast(e.response?.data?.error || 'Failed', 'error'); }
    finally { setBusy(null); }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>{total} answer{total !== 1 ? 's' : ''}</span>
        <button className="btn btn-secondary btn-sm" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <LuRefreshCw size={13} /> Refresh
        </button>
      </div>

      <FilterBar statuses={A_STATUSES} active={statusFilter} onChange={setStatusFilter} />

      {loading
        ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 88 }} />)}</div>
        : items.length === 0
          ? <div className="card"><div className="empty-state"><p>No answers with status "{statusFilter}".</p></div></div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(a => (
                <div key={a._id} className="card" style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Question context */}
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginBottom: 4, fontWeight: 600 }}>
                        ↳ {a.question_id?.rephrased_query?.slice(0, 80) || 'Unknown question'}…
                      </p>
                      {/* Answer preview */}
                      <p style={{ fontSize: '0.88rem', marginBottom: 8, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {a.content}
                      </p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <StatusBadge status={a.status || 'live'} />
                        {a.flag_reason && (
                          <span style={{ fontSize: '0.7rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <LuTriangleAlert size={11} /> {a.flag_reason}
                          </span>
                        )}
                        <span style={{ color: 'var(--text-3)', fontSize: '0.73rem' }}>
                          {a.upvotes || 0}▲ {a.downvotes || 0}▼
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-3)', fontSize: '0.73rem' }}>
                          <LuUser size={11} /> {a.answered_by?.name || 'Anonymous'}
                        </span>
                        <span style={{ color: 'var(--text-3)', fontSize: '0.73rem' }}>{timeAgo(a.created_at)}</span>
                        {a.promoted_to_corpus && (
                          <span style={{ padding: '2px 7px', borderRadius: 999, fontSize: '0.66rem', fontWeight: 700, background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                            In FAQ
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center', flexDirection: 'column' }}>
                      <select
                        value={a.status || 'live'}
                        onChange={e => changeStatus(a._id, e.target.value)}
                        disabled={busy === a._id}
                        style={{
                          padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
                          background: 'var(--surface)', color: 'var(--text-1)',
                          fontSize: '0.78rem', cursor: 'pointer',
                        }}
                      >
                        {['live','flagged','hidden'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>

                      {!a.promoted_to_corpus && (a.status === 'live' || !a.status) && (
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={busy === a._id}
                          onClick={() => promote(a._id)}
                          style={{ fontSize: '0.72rem', padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                          title="Promote to FAQ"
                        >
                          <LuShieldCheck size={11} /> FAQ
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
      }
      <Pagination page={page} pages={pages} onPage={setPage} />
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════════════════════════ */
export default function AdminModeration() {
  const [activeTab, setActiveTab] = useState('all-questions');
  const [toast, setToast]         = useState(null);
  const [counts, setCounts]       = useState({ flagged: 0, pending: 0 });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load counts for tab badges
  useEffect(() => {
    Promise.all([
      adminGetModeration().then(r => r.data?.length || 0).catch(() => 0),
      adminGetPendingQuestions().then(r => r.data?.length || 0).catch(() => 0),
    ]).then(([flagged, pending]) => setCounts({ flagged, pending }));
  }, []);

  const tabs = [
    { id: 'all-questions', label: 'All Questions',    icon: <LuArrowUpDown size={14} />,  count: 0 },
    { id: 'all-answers',   label: 'All Answers',      icon: <LuMessageSquare size={14} />, count: 0 },
    { id: 'flagged',       label: 'Flagged Answers',  icon: <LuFlag size={14} />,          count: counts.flagged },
    { id: 'pending',       label: 'Pending Questions',icon: <LuTriangleAlert size={14} />, count: counts.pending },
  ];

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`alert ${toast.type === 'error' ? 'alert-error' : 'alert-success'} fade-in`}
          style={{ position: 'fixed', top: 76, right: 24, zIndex: 200, width: 340, boxShadow: 'var(--shadow-lg)' }}>
          {toast.type === 'error' ? <LuTriangleAlert size={16} /> : <LuCircleCheck size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Moderation</h1>
          <p>Manage all community questions and answers</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: 5, width: 'fit-content',
        boxShadow: 'var(--shadow-sm)', flexWrap: 'wrap',
      }}>
        {tabs.map(t => (
          <TabBtn key={t.id} active={activeTab === t.id} onClick={() => setActiveTab(t.id)} count={t.count}>
            {t.icon} {t.label}
          </TabBtn>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'flagged'       && <FlaggedAnswersTab   showToast={showToast} />}
      {activeTab === 'pending'       && <PendingQuestionsTab showToast={showToast} />}
      {activeTab === 'all-questions' && <AllQuestionsTab     showToast={showToast} />}
      {activeTab === 'all-answers'   && <AllAnswersTab       showToast={showToast} />}
    </div>
  );
}