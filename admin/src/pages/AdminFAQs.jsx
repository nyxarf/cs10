import { useState, useEffect, useCallback, useRef } from 'react';
import { adminGetFaqs, adminCreateFAQ, adminUpdateFAQ, adminDeleteFAQ, adminDeduplicateFaqs, adminPinFaq } from '../services/api';
import {
  LuPlus, LuPen, LuTrash, LuSearch, LuCircleHelp,
  LuTag, LuEye, LuX, LuCircleCheck, LuTriangleAlert,
  LuScanLine, LuShieldCheck, LuCopy, LuPin, LuPinOff
} from 'react-icons/lu';

const EMPTY_FORM = { question: '', answer: '', category_path: '', tags: '', keywords: '', priority: 0 };

// Simple SHA-256-like fingerprint using a fast client-side hash
function simpleFingerprint(text) {
  const normalized = text.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
    hash |= 0;
  }
  return normalized; // use normalized text for client-side comparison (server does SHA-256)
}

export default function AdminFAQs() {
  const [faqs, setFaqs]           = useState([]);
  const [allFaqs, setAllFaqs]     = useState([]); // All pages cached for dupe check
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [search, setSearch]       = useState('');
  const [toast, setToast]         = useState(null);
  const [saving, setSaving]       = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dupeWarning, setDupeWarning] = useState(null);   // live duplicate warning
  const [deduping, setDeduping]   = useState(false);
  const dupeTimerRef              = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const load = async (pageNum = 1) => {
    setLoading(true);
    try {
      const res = await adminGetFaqs(pageNum);
      setFaqs(res.data || []);
      setPage(res.page || 1);
      setTotalPages(res.pages || 1);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  // Load all FAQs across pages for client-side duplicate detection
  const loadAllForDupeCheck = async () => {
    try {
      const pages = [];
      let p = 1;
      while (true) {
        const res = await adminGetFaqs(p);
        pages.push(...(res.data || []));
        if (p >= (res.pages || 1)) break;
        p++;
      }
      setAllFaqs(pages);
    } catch { /* silent */ }
  };

  useEffect(() => {
    load(1);
    loadAllForDupeCheck();
  }, []);

  const resetForm = () => { setForm(EMPTY_FORM); setEditing(null); setShowForm(false); setDupeWarning(null); };

  const handleEdit = (faq) => {
    setEditing(faq._id);
    setForm({
      question: faq.question || '',
      answer:   faq.answer || '',
      category_path: faq.category_path || faq.category || '',
      tags:     (faq.tags || []).join(', '),
      keywords: (faq.keywords || []).join(', '),
      priority: faq.priority || 0,
    });
    setDupeWarning(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Live duplicate check while typing (debounced 600ms)
  const checkDuplicate = useCallback((questionText) => {
    if (dupeTimerRef.current) clearTimeout(dupeTimerRef.current);
    if (!questionText || questionText.trim().length < 10) { setDupeWarning(null); return; }

    dupeTimerRef.current = setTimeout(() => {
      const normalizedInput = questionText.trim().toLowerCase();
      const match = allFaqs.find(f => {
        if (editing && f._id === editing) return false; // skip self when editing
        return f.question.trim().toLowerCase() === normalizedInput;
      });
      if (match) {
        setDupeWarning(`Exact duplicate found: "${match.question.substring(0, 80)}${match.question.length > 80 ? '...' : ''}"`);
      } else {
        // Fuzzy: check if > 85% words match
        const inputWords = new Set(normalizedInput.split(/\s+/).filter(w => w.length > 3));
        const fuzzyMatch = allFaqs.find(f => {
          if (editing && f._id === editing) return false;
          const faqWords = new Set(f.question.toLowerCase().split(/\s+/).filter(w => w.length > 3));
          if (inputWords.size === 0 || faqWords.size === 0) return false;
          const intersection = [...inputWords].filter(w => faqWords.has(w)).length;
          const similarity = intersection / Math.max(inputWords.size, faqWords.size);
          return similarity >= 0.85;
        });
        if (fuzzyMatch) {
          setDupeWarning(`Very similar question found: "${fuzzyMatch.question.substring(0, 80)}${fuzzyMatch.question.length > 80 ? '...' : ''}"`);
        } else {
          setDupeWarning(null);
        }
      }
    }, 600);
  }, [allFaqs, editing]);

  const handleQuestionChange = (val) => {
    setForm(f => ({ ...f, question: val }));
    checkDuplicate(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (dupeWarning) {
      if (!window.confirm(`Duplicate Warning!\n\n${dupeWarning}\n\nAre you sure you want to save this FAQ anyway?`)) return;
    }
    setSaving(true);
    const body = {
      ...form,
      tags:     form.tags.split(',').map(t => t.trim()).filter(Boolean),
      keywords: form.keywords.split(',').map(t => t.trim()).filter(Boolean),
      priority: Number(form.priority),
    };
    try {
      if (editing) await adminUpdateFAQ(editing, body);
      else         await adminCreateFAQ(body);
      showToast(editing ? 'FAQ updated successfully!' : 'FAQ created successfully!');
      resetForm();
      await load(page);
      await loadAllForDupeCheck();
    } catch (err) {
      const msg = err.response?.data?.error || 'Something went wrong. Try again.';
      showToast(msg, 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id, question) => {
    if (!confirm(`Delete this FAQ?\n\n"${question}"`)) return;
    try {
      await adminDeleteFAQ(id);
      showToast('FAQ deleted.');
      await load(faqs.length === 1 && page > 1 ? page - 1 : page);
      await loadAllForDupeCheck();
    } catch { showToast('Delete failed.', 'error'); }
  };

  const handlePin = async (id) => {
    try {
      const res = await adminPinFaq(id);
      showToast(res.message);
      // Optimistic update — flip local state instantly
      setFaqs(prev => prev.map(f => f._id === id ? { ...f, is_pinned: res.is_pinned } : f));
    } catch { showToast('Pin toggle failed.', 'error'); }
  };

  const handleDeduplicate = async () => {
    if (!window.confirm('This will scan all FAQs and automatically delete exact duplicates (keeping the oldest copy). Continue?')) return;
    setDeduping(true);
    try {
      const res = await adminDeduplicateFaqs();
      showToast(res.message, res.removed > 0 ? 'success' : 'success');
      await load(1);
      await loadAllForDupeCheck();
    } catch (err) {
      showToast(err.response?.data?.error || 'Deduplication failed.', 'error');
    } finally { setDeduping(false); }
  };

  const filtered = faqs.filter(f =>
    !search || f.question?.toLowerCase().includes(search.toLowerCase()) ||
    f.category_path?.toLowerCase().includes(search.toLowerCase()) ||
    f.category?.toLowerCase().includes(search.toLowerCase())
  );

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

      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>FAQ Management</h1>
          <p>Showing {faqs.length} FAQs — Page {page} of {totalPages}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={handleDeduplicate}
            disabled={deduping}
            style={{ display: 'flex', alignItems: 'center', gap: 7 }}
          >
            {deduping ? <LuScanLine size={16} className="spin" /> : <LuScanLine size={16} />}
            {deduping ? 'Scanning...' : 'Scan & Remove Duplicates'}
          </button>
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <LuPlus size={16} /> Add FAQ
          </button>
        </div>
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div className="card fade-in" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div className="card-title">
              {editing ? <><LuPen size={16} style={{ color: 'var(--primary)' }} /> Edit FAQ</> : <><LuPlus size={16} style={{ color: 'var(--primary)' }} /> New FAQ</>}
            </div>
            <button className="btn btn-ghost btn-icon" onClick={resetForm}><LuX size={18} /></button>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Question — full width */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Question *</label>
                <textarea rows={2} className="textarea" required
                  placeholder="What is the VINS internship?"
                  value={form.question}
                  onChange={e => handleQuestionChange(e.target.value)}
                  style={{ borderColor: dupeWarning ? 'var(--warning)' : undefined }}
                />
                {/* Live duplicate warning */}
                {dupeWarning && (
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    background: 'var(--warning-light, #fffbeb)', border: '1px solid var(--warning, #f59e0b)',
                    borderRadius: 8, padding: '10px 12px', marginTop: 8
                  }}>
                    <LuCopy size={15} style={{ color: 'var(--warning, #f59e0b)', flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--warning, #b45309)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <LuTriangleAlert size={13} /> Possible Duplicate Detected
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{dupeWarning}</p>
                    </div>
                  </div>
                )}
              </div>
              {/* Answer — full width */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Answer *</label>
                <textarea rows={4} className="textarea" required
                  placeholder="It is a free, online internship..."
                  value={form.answer} onChange={e => setForm({ ...form, answer: e.target.value })} />
              </div>
              {/* Category Path */}
              <div>
                <label className="form-label">Category Path *</label>
                <input className="input" required placeholder="root.general"
                  value={form.category_path} onChange={e => setForm({ ...form, category_path: e.target.value })} />
              </div>
              {/* Priority */}
              <div>
                <label className="form-label">Priority (0–10)</label>
                <input type="number" className="input" min={0} max={10}
                  value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} />
              </div>
              {/* Tags */}
              <div>
                <label className="form-label">Tags <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(comma-separated)</span></label>
                <input className="input" placeholder="eligibility, enrollment"
                  value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} />
              </div>
              {/* Keywords */}
              <div>
                <label className="form-label">Keywords <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(comma-separated)</span></label>
                <input className="input" placeholder="stipend, certificate"
                  value={form.keywords} onChange={e => setForm({ ...form, keywords: e.target.value })} />
              </div>
              {/* Actions */}
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, paddingTop: 4 }}>
                <button type="submit" disabled={saving} className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create FAQ'}
                </button>
                <button type="button" onClick={resetForm} className="btn btn-secondary">Cancel</button>
                {dupeWarning && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--warning, #b45309)', fontWeight: 600 }}>
                    <LuTriangleAlert size={14} /> Duplicate warning active
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: '12px 16px' }}>
          <div className="search-wrap">
            <LuSearch size={15} />
            <input className="input" placeholder="Search FAQs by question or category…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {/* FAQ List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 100 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><LuCircleHelp size={24} /></div>
            <h3>{search ? 'No results found' : 'No FAQs yet'}</h3>
            <p>{search ? 'Try a different search term.' : 'Click "Add FAQ" to create your first one.'}</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((faq, idx) => (
            <div key={faq._id} className="card fade-in" style={{ animationDelay: `${idx * 0.04}s` }}>
              <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                {/* Number */}
                <div style={{
                  width: 28, height: 28, borderRadius: 8, background: 'var(--primary-light)',
                  color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2
                }}>
                  {idx + 1}
                </div>
                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-1)', marginBottom: 6, lineHeight: 1.4 }}>
                    {faq.question}
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 10,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {faq.answer}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="badge badge-primary"><LuTag size={10} /> {faq.category_path || faq.category}</span>
                    <span className="badge badge-gray">P: {faq.priority || 0}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <LuEye size={12} /> {faq.views || 0} views
                    </span>
                    {faq.fingerprint && (
                      <span title="Fingerprint verified — deduplicated" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.7rem', color: 'var(--success)' }}>
                        <LuShieldCheck size={11} /> Unique
                      </span>
                    )}
                    {(faq.tags || []).slice(0, 3).map(t => (
                      <span key={t} className="badge badge-gray" style={{ background: '#f8fafc', fontSize: '0.625rem' }}>{t}</span>
                    ))}
                  </div>
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  {/* Pin toggle */}
                  <button
                    onClick={() => handlePin(faq._id)}
                    title={faq.is_pinned ? 'Unpin FAQ' : 'Pin FAQ to top'}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 10px', borderRadius: 6, border: '1px solid',
                      cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem', transition: 'all 0.15s',
                      ...(faq.is_pinned
                        ? { background: 'rgba(251,191,36,0.18)', borderColor: 'rgba(251,191,36,0.6)', color: '#FBBF24' }
                        : { background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-3)' }),
                    }}
                  >
                    {faq.is_pinned ? <LuPin size={12} /> : <LuPinOff size={12} />}
                    {faq.is_pinned ? 'Pinned' : 'Pin'}
                  </button>
                  <button onClick={() => handleEdit(faq)} className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <LuPen size={13} /> Edit
                  </button>
                  <button onClick={() => handleDelete(faq._id, faq.question)} className="btn btn-danger btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <LuTrash size={13} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && !loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24 }}>
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => load(page - 1)}>
            ← Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`} onClick={() => load(p)}>
              {p}
            </button>
          ))}
          <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => load(page + 1)}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
