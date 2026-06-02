import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import faqService from '../services/faqService';
import MindMap from '../components/MindMap';
import { FaBook, FaBolt, FaSearch, FaCommentDots, FaMicrophone, FaHistory, FaChevronRight, FaProjectDiagram, FaList, FaThumbtack } from 'react-icons/fa';
import { FiLoader } from 'react-icons/fi';

export default function FAQBrowse() {
  const [faqData, setFaqData] = useState({});
  const [sections, setSections] = useState([]);
  const [activeSection, setActiveSection] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [recentSearches, setRecentSearches] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [isListening, setIsListening] = useState(false);

  // Mind Map state
  const [mindMapSection, setMindMapSection] = useState(null);
  const [mindMapCache, setMindMapCache] = useState({});
  const [mindMapHighlight, setMindMapHighlight] = useState('');

  const startVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support voice search.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
      handleSearchSubmit(transcript);
    };
    
    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };
    
    recognition.onend = () => setIsListening(false);
    
    recognition.start();
  };

  // Load recent searches
  useEffect(() => {
    const saved = localStorage.getItem('samagama_recent_searches');
    if (saved) setRecentSearches(JSON.parse(saved));
  }, []);

  const handleSearchSubmit = (query) => {
    if (!query.trim()) return;
    const updated = [query, ...recentSearches.filter(s => s.toLowerCase() !== query.toLowerCase())].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('samagama_recent_searches', JSON.stringify(updated));
    setShowSearchDropdown(false);
  };

  // Sync search query to URL with debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchQuery) {
        setSearchParams({ q: searchQuery });
        if (searchQuery.length > 2) {
          handleSearchSubmit(searchQuery);
        }
      } else {
        setSearchParams({});
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery, setSearchParams]);

  useEffect(() => {
    document.title = "Browse FAQs | Samagama";
    const fetchData = async () => {
      try {
        const [faqDataResult, secDataResult] = await Promise.all([
          faqService.listFaqs(),
          faqService.listSections(),
        ]);
        setFaqData(faqDataResult.sections || {});
        setTotal(faqDataResult.total || 0);
        setSections(secDataResult.sections || []);
      } catch (err) {
        console.error('Failed to fetch FAQs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const highlightText = (text, highlight) => {
    if (!highlight || !highlight.trim()) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() ? 
            <mark key={i} style={{ backgroundColor: 'var(--accent-primary)', color: '#fff', padding: '0 2px', borderRadius: '2px' }}>{part}</mark> : part
        )}
      </span>
    );
  };

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set();
    Object.values(filteredFaqs).forEach((sec) => {
      sec.faqs.forEach((_, i) => allIds.add(`${sec.sectionId}-${i}`));
    });
    setExpandedIds(allIds);
  };

  const collapseAll = () => setExpandedIds(new Set());

  // Mind map toggle — fetches once and caches per section
  const toggleMindMap = useCallback(async (sectionId) => {
    if (mindMapSection === sectionId) {
      setMindMapSection(null);
      setMindMapHighlight('');
      return;
    }
    setMindMapSection(sectionId);
    setMindMapHighlight('');
    if (mindMapCache[sectionId]?.tree) return;
    setMindMapCache(c => ({ ...c, [sectionId]: { loading: true, tree: null, error: null } }));
    try {
      const tree = await faqService.getMindMap(sectionId);
      setMindMapCache(c => ({ ...c, [sectionId]: { loading: false, tree, error: null } }));
    } catch {
      setMindMapCache(c => ({ ...c, [sectionId]: { loading: false, tree: null, error: 'Could not generate mind map. Please try again.' } }));
    }
  }, [mindMapSection, mindMapCache]);

  // Clicking a mind-map leaf highlights matching FAQs and scrolls to accordion
  const handleMindMapNodeClick = useCallback((label) => {
    setMindMapHighlight(label);
    setSearchQuery(label);
    const allIds = new Set();
    Object.entries(faqData).forEach(([sid, section]) => {
      section.faqs.forEach((faq, i) => {
        if (faq.question.toLowerCase().includes(label.toLowerCase()) ||
            faq.answer.toLowerCase().includes(label.toLowerCase())) {
          allIds.add(`${sid}-${i}`);
        }
      });
    });
    if (allIds.size) setExpandedIds(allIds);
    setTimeout(() => document.getElementById('faq-accordion')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
  }, [faqData]);

  // Build filtered FAQ list
  const filteredFaqs = useMemo(() => {
    const result = {};
    const query = searchQuery.toLowerCase().trim();

    Object.entries(faqData).forEach(([sectionId, section]) => {
      if (activeSection && sectionId !== activeSection) return;

      const filtered = section.faqs.filter((faq) => {
        if (!query) return true;
        return (
          faq.question.toLowerCase().includes(query) ||
          faq.answer.toLowerCase().includes(query)
        );
      });

      if (filtered.length > 0) {
        result[sectionId] = { ...section, faqs: filtered, sectionId };
      }
    });

    return result;
  }, [faqData, activeSection, searchQuery]);

  const filteredTotal = Object.values(filteredFaqs).reduce(
    (sum, sec) => sum + sec.faqs.length,
    0
  );

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <div className="skeleton skeleton-title" style={{ height: '2.5rem', width: '30%', marginBottom: '0.5rem' }}></div>
          <div className="skeleton skeleton-text" style={{ width: '40%', marginBottom: '2rem' }}></div>
          
          <div className="skeleton" style={{ height: '3rem', width: '100%', borderRadius: 'var(--radius-lg)', marginBottom: '1.5rem' }}></div>
          
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton" style={{ height: '2rem', width: '80px', borderRadius: '100px' }}></div>
            ))}
          </div>

          {[1, 2].map(section => (
            <div key={section} style={{ marginBottom: '2rem' }}>
              <div className="skeleton skeleton-title" style={{ width: '20%' }}></div>
              {[1, 2, 3].map(item => (
                <div key={item} className="skeleton-card" style={{ padding: '1rem' }}>
                  <div className="skeleton skeleton-text" style={{ width: '80%', margin: 0 }}></div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <style>{`
        .faq-browse-header {
          margin-bottom: 2rem;
        }
        .faq-search-wrapper {
          position: relative;
          margin-bottom: 1.5rem;
        }
        .faq-search-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          font-size: 1.1rem;
          pointer-events: none;
          opacity: 0.5;
        }
        .faq-search-input {
          width: 100%;
          padding: 0.85rem 1rem 0.85rem 2.75rem;
          font-family: inherit;
          font-size: 1rem;
          color: var(--text-primary);
          background: var(--bg-glass);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          transition: all var(--transition-fast);
          outline: none;
          backdrop-filter: blur(8px);
        }
        .faq-search-input:focus {
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
        }
        .faq-search-input::placeholder {
          color: var(--text-muted);
        }
        .faq-mic-btn {
          position: absolute;
          right: 1rem;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 1.1rem;
          padding: 4px;
          border-radius: 50%;
          transition: all 0.2s;
        }
        .faq-mic-btn:hover {
          color: var(--accent-primary);
          background: rgba(99, 102, 241, 0.1);
        }
        .faq-mic-btn.listening {
          color: #ef4444;
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .faq-section-tabs {
          display: flex;
          gap: 0.4rem;
          overflow-x: auto;
          padding-bottom: 0.5rem;
          margin-bottom: 1.5rem;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.1) transparent;
        }
        .faq-section-tabs::-webkit-scrollbar {
          height: 4px;
        }
        .faq-section-tabs::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
        }
        .faq-tab {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 1rem;
          font-family: inherit;
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text-secondary);
          background: var(--bg-glass);
          border: 1px solid var(--border-color);
          border-radius: 100px;
          cursor: pointer;
          transition: all var(--transition-fast);
          white-space: nowrap;
          flex-shrink: 0;
        }
        .faq-tab:hover {
          color: var(--text-primary);
          border-color: var(--border-active);
          background: var(--bg-glass-hover);
        }
        .faq-tab.active {
          background: var(--gradient-primary);
          color: white;
          border-color: transparent;
        }
        .faq-tab-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 1.4rem;
          height: 1.4rem;
          font-size: 0.7rem;
          font-weight: 700;
          background: rgba(255,255,255,0.15);
          border-radius: 100px;
          padding: 0 0.35rem;
        }
        .faq-tab.active .faq-tab-count {
          background: rgba(255,255,255,0.25);
        }
        .faq-section-group {
          margin-bottom: 2rem;
          animation: slideUp var(--transition-slow) ease forwards;
        }
        .faq-section-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--border-color);
        }
        .faq-section-title h2 {
          font-size: 1.15rem;
          font-weight: 700;
          background: var(--gradient-accent);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .faq-item {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          margin-bottom: 0.5rem;
          overflow: hidden;
          transition: all var(--transition-base);
          backdrop-filter: blur(8px);
        }
        .faq-item:hover {
          border-color: var(--border-active);
          box-shadow: 0 0 20px rgba(99, 102, 241, 0.08);
        }
        .faq-item-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 1.25rem;
          cursor: pointer;
          user-select: none;
          transition: background var(--transition-fast);
        }
        .faq-item-header:hover {
          background: var(--bg-glass-hover);
        }
        .faq-chevron {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          font-size: 0.7rem;
          color: var(--accent-primary-light);
          transition: transform var(--transition-base);
          flex-shrink: 0;
        }
        .faq-chevron.expanded {
          transform: rotate(90deg);
        }
        .faq-item-question {
          flex: 1;
          font-size: 0.95rem;
          font-weight: 500;
          color: var(--text-primary);
          line-height: 1.5;
        }
        .faq-item-body {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1),
                      padding 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .faq-item-body.expanded {
          max-height: 600px;
        }
        .faq-item-answer {
          padding: 0 1.25rem 1.25rem 3.25rem;
          font-size: 0.92rem;
          line-height: 1.8;
          color: var(--text-secondary);
          white-space: pre-line;
        }
        .faq-stats-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .faq-result-count {
          font-size: 0.9rem;
          color: var(--text-muted);
        }
        .faq-actions {
          display: flex;
          gap: 0.5rem;
        }
        @media (max-width: 768px) {
          .faq-item-answer {
            padding-left: 1.25rem;
          }
          .faq-stats-bar {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>

      <div className="container">
        {/* Header */}
        <div className="faq-browse-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{
                fontSize: '2rem',
                fontWeight: 800,
                background: 'var(--gradient-primary)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                marginBottom: '0.25rem',
              }}>
                <FaBook style={{ WebkitTextFillColor: 'var(--accent-primary)', marginRight: '0.5rem', verticalAlign: 'middle' }} />Browse FAQs
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                {total} frequently asked questions across {sections.length} categories
              </p>
            </div>
            <Link to="/faq" className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><FaBolt /> Ask Yaksha</Link>
          </div>

          {/* Search */}
          <div className="faq-search-wrapper" style={{ position: 'relative' }}>
            <span className="faq-search-icon"><FaSearch /></span>
            <input
              type="text"
              className="faq-search-input"
              placeholder="Search FAQs by keyword..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchDropdown(true);
              }}
              onFocus={() => setShowSearchDropdown(true)}
              onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearchSubmit(searchQuery);
              }}
            />
            <button 
              className={`faq-mic-btn ${isListening ? 'listening' : ''}`}
              onClick={startVoiceSearch}
              title={isListening ? "Listening..." : "Search by Voice"}
            >
              <FaMicrophone />
            </button>
            {showSearchDropdown && recentSearches.length > 0 && (
              <div className="card fade-in" style={{
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '0.5rem',
                padding: '0.5rem 0', zIndex: 10, border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-md)'
              }}>
                <div style={{ padding: '0.25rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Recent Searches</div>
                {recentSearches.map(rs => (
                  <div 
                    key={rs} 
                    style={{ padding: '0.5rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--bg-glass-hover)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => {
                      setSearchQuery(rs);
                      setShowSearchDropdown(false);
                    }}
                  >
                    <FaHistory style={{ fontSize: '0.75rem', opacity: 0.6 }} /> {rs}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section Tabs */}
          <div className="faq-section-tabs">
            <button
              className={`faq-tab ${!activeSection ? 'active' : ''}`}
              onClick={() => setActiveSection(null)}
            >
              All
              <span className="faq-tab-count">{total}</span>
            </button>
            {sections.map((sec) => (
              <button
                key={sec.id}
                className={`faq-tab ${activeSection === sec.id ? 'active' : ''}`}
                onClick={() => setActiveSection(sec.id)}
              >
                {sec.label}
                <span className="faq-tab-count">{sec.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="faq-stats-bar">
          <span className="faq-result-count">
            {searchQuery || activeSection
              ? `Showing ${filteredTotal} of ${total} FAQs`
              : `${total} FAQs`}
          </span>
          <div className="faq-actions">
            <button className="btn btn-sm btn-secondary" onClick={expandAll}>
              Expand All
            </button>
            <button className="btn btn-sm btn-secondary" onClick={collapseAll}>
              Collapse All
            </button>
          </div>
        </div>

        {/* FAQ Sections */}
        {Object.keys(filteredFaqs).length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FaSearch style={{ color: 'var(--text-muted)' }} /></div>
            <div className="empty-state-text">No FAQs match your search</div>
            <p style={{ color: 'var(--text-muted)' }}>
              Try different keywords or{' '}
              <Link to="/faq" style={{ color: 'var(--accent-primary-light)' }}>
                ask Yaksha directly
              </Link>
            </p>
          </div>
        ) : (
          <div id="faq-accordion">
            {Object.entries(filteredFaqs).map(([sectionId, section]) => {
              const mmState  = mindMapCache[sectionId] || {};
              const isMMOpen = mindMapSection === sectionId;
              const highlight = mindMapHighlight || searchQuery;

              return (
                <div key={sectionId} className="faq-section-group">

                  {/* ── Section header + Mind Map toggle ── */}
                  <div className="faq-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <h2>{section.label}</h2>
                      <span className="badge badge-info">{section.faqs.length}</span>
                    </div>
                    <button
                      onClick={() => toggleMindMap(sectionId)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '4px 13px', borderRadius: 99, border: 'none',
                        cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                        fontSize: '0.75rem', transition: 'all 0.18s',
                        background: isMMOpen
                          ? 'linear-gradient(135deg,#6366f1,#8b5cf6)'
                          : 'rgba(99,102,241,0.1)',
                        color: isMMOpen ? '#fff' : '#818cf8',
                        boxShadow: isMMOpen ? '0 2px 10px rgba(99,102,241,0.3)' : 'none',
                      }}
                      title={isMMOpen ? 'Back to List' : 'View Mind Map'}
                    >
                      {mmState.loading
                        ? <><FiLoader size={10} style={{ animation: 'spin 0.7s linear infinite' }} /> Generating…</>
                        : isMMOpen
                          ? <><FaList size={10} /> List View</>
                          : <><FaProjectDiagram size={10} /> Mind Map</>
                      }
                    </button>
                  </div>

                  {/* ── Mind Map panel ── */}
                  {isMMOpen && (
                    <div style={{
                      marginBottom: '1.25rem',
                      background: 'var(--bg-glass)',
                      border: '1px solid rgba(99,102,241,0.18)',
                      borderRadius: 16,
                      overflow: 'hidden',
                      animation: 'slideUp 0.28s ease',
                    }}>
                      {/* Panel label bar */}
                      <div style={{
                        padding: '9px 16px',
                        borderBottom: '1px solid rgba(99,102,241,0.1)',
                        background: 'rgba(99,102,241,0.05)',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <FaProjectDiagram size={12} style={{ color: '#818cf8' }} />
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#818cf8' }}>
                          {section.label} — AI Mind Map
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: '0.67rem', color: 'rgba(148,163,184,0.55)' }}>
                          Powered by Groq · llama-3.1-8b-instant
                        </span>
                      </div>

                      {/* Map or error */}
                      {mmState.error ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#f87171', fontSize: '0.85rem' }}>
                          {mmState.error}
                        </div>
                      ) : (
                        <div style={{ padding: 12 }}>
                          <MindMap
                            tree={mmState.tree}
                            loading={mmState.loading}
                            onNodeClick={handleMindMapNodeClick}
                            height={480}
                          />
                        </div>
                      )}

                      {/* Highlight banner */}
                      {mindMapHighlight && (
                        <div style={{
                          padding: '7px 16px',
                          borderTop: '1px solid rgba(99,102,241,0.1)',
                          background: 'rgba(99,102,241,0.05)',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          fontSize: '0.77rem',
                        }}>
                          <span style={{ color: '#94a3b8' }}>
                            Showing results for: <strong style={{ color: '#818cf8' }}>"{mindMapHighlight}"</strong>
                          </span>
                          <button
                            onClick={() => { setMindMapHighlight(''); setSearchQuery(''); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontWeight: 600 }}
                          >
                            Clear ×
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── FAQ Accordion ── */}
                  {section.faqs.map((faq, i) => {
                    const itemId = `${sectionId}-${i}`;
                    const isExpanded = expandedIds.has(itemId);
                    return (
                      <div key={itemId} className="faq-item"
                        style={faq.is_pinned ? { borderColor: 'rgba(245,158,11,0.45)', boxShadow: '0 0 0 1px rgba(245,158,11,0.1)' } : {}}
                      >
                        <div
                          className="faq-item-header"
                          onClick={() => toggleExpand(itemId)}
                        >
                          <span className={`faq-chevron ${isExpanded ? 'expanded' : ''}`}>
                            <FaChevronRight />
                          </span>
                          <span className="faq-item-question">
                            {faq.is_pinned && (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                marginRight: 8,
                                padding: '1px 7px', borderRadius: 999,
                                fontSize: '0.6rem', fontWeight: 800,
                                background: 'rgba(245,158,11,0.15)',
                                color: '#F59E0B',
                                border: '1px solid rgba(245,158,11,0.35)',
                                verticalAlign: 'middle',
                                letterSpacing: '0.06em', textTransform: 'uppercase',
                              }}>
                                <FaThumbtack size={8} /> Pinned
                              </span>
                            )}
                            {highlightText(faq.question, highlight)}
                          </span>
                        </div>
                        <div className={`faq-item-body ${isExpanded ? 'expanded' : ''}`}>
                          <div className="faq-item-answer">{highlightText(faq.answer, highlight)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}


        {/* Bottom CTA */}
        <div style={{
          textAlign: 'center',
          padding: '2.5rem 1rem',
          marginTop: '1rem',
        }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.95rem' }}>
            Can't find what you're looking for?
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <Link to="/faq" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><FaBolt /> Ask Yaksha</Link>
            <Link to="/faq/community" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><FaCommentDots /> Community Board</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
