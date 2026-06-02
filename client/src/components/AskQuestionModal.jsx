import { useState, useEffect, useRef } from 'react';
import api from '../api/client';
import { useNavigate } from 'react-router-dom';
import {
  RiCloseLine, RiRobot2Line, RiCheckboxCircleLine,
  RiSearchLine, RiInformationLine, RiArrowRightLine,
  RiMicLine, RiMicOffLine, RiSparklingLine, RiErrorWarningLine,
  RiCommunityLine, RiBookOpenLine,
} from 'react-icons/ri';

/* ── tiny debounce hook ────────────────────────────────────────────────────── */
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ── validation state machine ──────────────────────────────────────────────── */
// idle → checking → rejected | clean | similar
const STATE = { IDLE: 'idle', CHECKING: 'checking', REJECTED: 'rejected', CLEAN: 'clean', SIMILAR: 'similar' };

/* ── source badge ───────────────────────────────────────────────────────────── */
function SourceBadge({ source }) {
  const isFaq = source === 'faq';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 10px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700,
      background: isFaq ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)',
      color: isFaq ? '#818cf8' : '#34d399',
      border: `1px solid ${isFaq ? 'rgba(99,102,241,0.3)' : 'rgba(16,185,129,0.3)'}`,
    }}>
      {isFaq ? <RiBookOpenLine size={11} /> : <RiCommunityLine size={11} />}
      {isFaq ? 'Official FAQ' : 'Community'}
    </span>
  );
}

/* ── Similar match card ─────────────────────────────────────────────────────── */
function SimilarCard({ similar, onDismiss, onNavigate }) {
  const [expanded, setExpanded] = useState(false);
  const hasFaqAnswer = similar.source === 'faq' && similar.answer;

  return (
    <div style={{
      borderRadius: 12, overflow: 'hidden',
      border: '1px solid rgba(251,191,36,0.35)',
      background: 'linear-gradient(135deg, rgba(251,191,36,0.06), rgba(245,158,11,0.03))',
      marginBottom: 12, animation: 'slideDown 0.25s ease',
    }}>
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <RiErrorWarningLine size={15} style={{ color: '#FBBF24', flexShrink: 0 }} />
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#FBBF24', flex: 1 }}>
          Similar question already exists
        </span>
        <SourceBadge source={similar.source} />
      </div>

      <div style={{ padding: '0 14px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Matched question */}
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '8px 12px', cursor: 'pointer', textAlign: 'left',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
            color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 600,
            transition: 'background 0.15s',
          }}
        >
          <span>{similar.question}</span>
          <RiArrowRightLine size={13} style={{
            color: 'var(--text-muted)', flexShrink: 0,
            transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s',
          }} />
        </button>

        {/* Answer or community link */}
        {expanded && (
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8, padding: '10px 12px', fontSize: '0.83rem',
            color: 'var(--text-secondary)', lineHeight: 1.6,
            animation: 'fadeIn 0.2s ease',
          }}>
            {hasFaqAnswer ? (
              similar.answer
            ) : (
              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                This community question has been asked — check it for answers.
              </span>
            )}
          </div>
        )}

        {/* Reason */}
        {similar.reason && (
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {similar.reason}
          </p>
        )}

        {/* Action row */}
        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          {similar.source === 'community' && similar.id && (
            <button
              onClick={() => onNavigate(similar.id)}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
            >
              View Question <RiArrowRightLine size={11} />
            </button>
          )}
          <button
            onClick={onDismiss}
            style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: '0.75rem',
            }}
          >
            Post Anyway
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN MODAL
═══════════════════════════════════════════════════════════════════════════ */
export default function AskQuestionModal({ isOpen, onClose, onQuestionPosted }) {
  const navigate = useNavigate();
  const textareaRef = useRef(null);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('general');
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Validation state
  const [valState, setValState] = useState(STATE.IDLE);
  const [rejectionReason, setRejectionReason] = useState('');
  const [cleanedQuery, setCleanedQuery] = useState('');
  const [similarMatch, setSimilarMatch] = useState(null);
  const [similarDismissed, setSimilarDismissed] = useState(false);

  const debouncedQuery = useDebounce(query, 600);

  const CATEGORIES = [
    'general', 'about', 'timing', 'noc', 'selection',
    'work', 'conduct', 'certificate', 'interviews',
  ];

  /* ── Auto-validate on debounced input ────────────────────────────────── */
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.trim().length < 6) {
      setValState(STATE.IDLE);
      setRejectionReason('');
      setCleanedQuery('');
      setSimilarMatch(null);
      setSimilarDismissed(false);
      return;
    }

    let cancelled = false;
    setValState(STATE.CHECKING);

    api.post('/questions/validate', { question: debouncedQuery })
      .then(res => {
        if (cancelled) return;
        const { valid, reason, cleaned, similar } = res.data;
        setCleanedQuery(cleaned || debouncedQuery);

        if (!valid) {
          setValState(STATE.REJECTED);
          setRejectionReason(reason || 'Please refine your question.');
          setSimilarMatch(null);
        } else if (similar) {
          setValState(STATE.SIMILAR);
          setSimilarMatch(similar);
          setSimilarDismissed(false);
        } else {
          setValState(STATE.CLEAN);
          setSimilarMatch(null);
        }
      })
      .catch(() => {
        if (!cancelled) setValState(STATE.IDLE);
      });

    return () => { cancelled = true; };
  }, [debouncedQuery]);

  /* ── Reset on close ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!isOpen) {
      setQuery(''); setCategory('general'); setLoading(false);
      setSubmitError(''); setSuccess(false);
      setValState(STATE.IDLE); setRejectionReason('');
      setCleanedQuery(''); setSimilarMatch(null); setSimilarDismissed(false);
    } else {
      setTimeout(() => textareaRef.current?.focus(), 80);
    }
  }, [isOpen]);

  /* ── Voice input ─────────────────────────────────────────────────────── */
  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert('Voice input is not supported in this browser.');
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.onstart = () => setIsListening(true);
    rec.onresult = (e) => setQuery(p => (p ? p + ' ' : '') + e.results[0][0].transcript);
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    rec.start();
  };

  /* ── Submit ──────────────────────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (valState === STATE.REJECTED) {
      setSubmitError(rejectionReason);
      return;
    }
    if (valState === STATE.CHECKING) {
      setSubmitError('Please wait while we validate your question.');
      return;
    }

    const finalQuery = cleanedQuery || query.trim();
    if (finalQuery.length < 10) {
      setSubmitError('Please provide a more detailed question.');
      return;
    }

    setLoading(true);
    try {
      // Prepare (rephrase + auto-categorize)
      const prepRes = await api.post('/questions/prepare', { query: finalQuery });
      const { rephrased, category: autoCategory } = prepRes.data;
      const finalCategory = category !== 'general' ? category : autoCategory;

      // Submit
      const submitRes = await api.post('/questions/submit', {
        original_query: finalQuery,
        rephrased_query: rephrased,
        category: finalCategory,
      });

      if (submitRes.data.duplicate) {
        setSubmitError(submitRes.data.message || 'This question already exists in the community.');
      } else {
        setSuccess(true);
        setTimeout(() => { onQuestionPosted(); onClose(); }, 2200);
      }
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Failed to post question. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  /* ── Status indicator ────────────────────────────────────────────────── */
  const renderStatusBar = () => {
    if (valState === STATE.CHECKING) return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: '0.78rem', marginTop: 6 }}>
        <span className="spinner" style={{ width: 12, height: 12 }} />
        Checking for duplicates and validating…
      </div>
    );
    if (valState === STATE.REJECTED) return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f87171', fontSize: '0.78rem', marginTop: 6 }}>
        <RiErrorWarningLine size={13} /> {rejectionReason}
      </div>
    );
    if (valState === STATE.CLEAN) return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#34d399', fontSize: '0.78rem', marginTop: 6 }}>
        <RiCheckboxCircleLine size={13} /> Looks good — ready to post!
      </div>
    );
    return null;
  };

  return (
    <>
      <style>{`
        @keyframes slideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn    { from { opacity:0; } to { opacity:1; } }
        @keyframes modalIn   { from { opacity:0; transform:scale(0.96) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(6px)', zIndex: 1000,
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1001,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        pointerEvents: 'none',
      }}>
        <div
          className="card"
          style={{
            width: '100%', maxWidth: 560, pointerEvents: 'all',
            animation: 'modalIn 0.28s cubic-bezier(0.34,1.56,0.64,1)',
            padding: '1.75rem',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))',
                border: '1px solid rgba(99,102,241,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <RiRobot2Line size={18} style={{ color: '#818cf8' }} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Ask the Community</h2>
                <p style={{ margin: 0, fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                  AI-validated · Duplicate-checked · Instantly posted
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, width: 32, height: 32, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', transition: 'background 0.15s',
              }}
            >
              <RiCloseLine size={18} />
            </button>
          </div>

          {/* Success state */}
          {success ? (
            <div style={{
              textAlign: 'center', padding: '2.5rem 1rem',
              animation: 'fadeIn 0.3s ease',
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>
                <RiCheckboxCircleLine style={{ color: '#34d399' }} />
              </div>
              <h3 style={{ color: '#34d399', marginBottom: '0.5rem' }}>Question Posted!</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                The community will be notified. You'll get a response soon.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Global submit error */}
              {submitError && (
                <div style={{
                  padding: '10px 14px', borderRadius: 10, fontSize: '0.83rem',
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  color: '#fca5a5', display: 'flex', alignItems: 'flex-start', gap: 8,
                }}>
                  <RiErrorWarningLine size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  {submitError}
                </div>
              )}

              {/* Similar match warning */}
              {valState === STATE.SIMILAR && similarMatch && !similarDismissed && (
                <SimilarCard
                  similar={similarMatch}
                  onDismiss={() => setSimilarDismissed(true)}
                  onNavigate={(id) => { onClose(); navigate(`/faq/community/${id}`); }}
                />
              )}

              {/* Category */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Category</label>
                <select
                  className="form-select"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  style={{ fontSize: '0.85rem' }}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
                <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Leave as General and Yaksha will auto-classify.
                </p>
              </div>

              {/* Question textarea */}
              <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>
                  Your Question
                  {cleanedQuery && cleanedQuery !== query.trim() && (
                    <span style={{
                      marginLeft: 8, fontSize: '0.68rem', color: '#818cf8',
                      background: 'rgba(99,102,241,0.12)', padding: '1px 7px',
                      borderRadius: 999, fontWeight: 600,
                    }}>
                      <RiSparklingLine size={10} style={{ marginRight: 3 }} />
                      greeting stripped
                    </span>
                  )}
                </label>

                <textarea
                  ref={textareaRef}
                  className="form-textarea"
                  placeholder="e.g. What are the eligibility criteria for the VINS internship?"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  style={{
                    minHeight: 110, paddingRight: 44, resize: 'vertical',
                    borderColor: valState === STATE.REJECTED
                      ? 'rgba(239,68,68,0.5)'
                      : valState === STATE.CLEAN
                      ? 'rgba(52,211,153,0.4)'
                      : valState === STATE.SIMILAR
                      ? 'rgba(251,191,36,0.4)'
                      : undefined,
                    transition: 'border-color 0.2s',
                  }}
                />

                {/* Mic button */}
                <button
                  type="button"
                  onClick={startVoice}
                  style={{
                    position: 'absolute', bottom: 38, right: 10,
                    background: isListening ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${isListening ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 7, width: 28, height: 28,
                    cursor: 'pointer', color: isListening ? '#f87171' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}
                  title={isListening ? 'Listening…' : 'Dictate your question'}
                >
                  {isListening ? <RiMicOffLine size={13} /> : <RiMicLine size={13} />}
                </button>

                {/* Inline validation status */}
                {renderStatusBar()}

                {/* Cleaned preview */}
                {cleanedQuery && cleanedQuery !== query.trim() && valState !== STATE.REJECTED && (
                  <div style={{
                    marginTop: 6, padding: '7px 10px', borderRadius: 8, fontSize: '0.78rem',
                    background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                    color: '#a5b4fc',
                  }}>
                    <RiInformationLine size={11} style={{ marginRight: 4 }} />
                    Will post as: <em>"{cleanedQuery}"</em>
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || valState === STATE.CHECKING || valState === STATE.REJECTED}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {loading ? (
                  <><span className="spinner" /> Posting…</>
                ) : valState === STATE.SIMILAR && !similarDismissed ? (
                  <><RiSearchLine size={14} /> Post Anyway</>
                ) : (
                  <><RiRobot2Line size={14} /> Post Question</>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
