import { useState, useEffect } from 'react';
import api from '../api/client';
import faqService from '../services/faqService';
import { FaTimes, FaRobot, FaCheckCircle, FaSearch } from 'react-icons/fa';

export default function AskQuestionModal({ isOpen, onClose, onQuestionPosted }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('general');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isListening, setIsListening] = useState(false);
  
  // Phase 9 States
  const [officialFaqs, setOfficialFaqs] = useState([]);
  const [filteredFaqs, setFilteredFaqs] = useState([]);
  const [expandedFaqId, setExpandedFaqId] = useState(null);

  const CATEGORIES = ['about', 'timing', 'noc', 'selection', 'work', 'conduct', 'certificate', 'interviews', 'general'];

  const startVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support voice input.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setQuery(prev => prev ? prev + ' ' + transcript : transcript);
    };
    
    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };
    
    recognition.onend = () => setIsListening(false);
    
    recognition.start();
  };

  // Fetch all official FAQs when modal opens
  useEffect(() => {
    if (isOpen) {
      faqService.listFaqs().then(res => {
        const flatFaqs = [];
        Object.values(res.sections || {}).forEach(sec => {
          flatFaqs.push(...sec.faqs);
        });
        setOfficialFaqs(flatFaqs);
      }).catch(err => console.error('Failed to fetch official FAQs:', err));
    } else {
      setQuery('');
      setFilteredFaqs([]);
      setError('');
      setSuccess('');
    }
  }, [isOpen]);

  // Real-time debounce filter
  useEffect(() => {
    const handler = setTimeout(() => {
      if (query.trim().length > 2) {
        const lowerQuery = query.toLowerCase();
        const matches = officialFaqs.filter(faq => 
          faq.question.toLowerCase().includes(lowerQuery) || 
          faq.answer.toLowerCase().includes(lowerQuery)
        ).slice(0, 4); // Show top 4
        setFilteredFaqs(matches);
      } else {
        setFilteredFaqs([]);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [query, officialFaqs]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (query.trim().length < 10) {
      setError('Please provide a more detailed question (at least 10 characters).');
      return;
    }

    setLoading(true);
    try {
      // 0. AI Category Validation (if user forced a specific category)
      if (category !== 'general') {
        const valRes = await api.post('/questions/validate-category', {
          question: query,
          category: category
        });
        if (!valRes.data.matches) {
          setError('Your question looks off-topic. Please rephrase or choose a better category.');
          setLoading(false);
          return;
        }
      }

      // 1. Prepare/Rephrase
      const prepRes = await api.post('/questions/prepare', { query });
      const { rephrased, category: autoCategory } = prepRes.data;

      // 2. Submit with final category
      const finalCategory = category !== 'general' ? category : autoCategory;
      const submitRes = await api.post('/questions/submit', {
        original_query: query,
        rephrased_query: rephrased,
        category: finalCategory,
      });

      if (submitRes.data.duplicate) {
        setError(submitRes.data.message || 'This question already exists.');
      } else {
        setSuccess('Your question has been posted successfully!');
        setQuery('');
        setTimeout(() => {
          onQuestionPosted();
          onClose();
        }, 2000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to post question. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
      padding: '1rem'
    }}>
      <div className="card fade-in" style={{ 
        width: '100%', 
        maxWidth: filteredFaqs.length > 0 ? '900px' : '500px', 
        position: 'relative',
        transition: 'max-width 0.3s ease',
        display: 'flex',
        flexDirection: 'row',
        gap: '2rem',
        padding: '2rem'
      }}>
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', zIndex: 10 }}
        >
          <FaTimes />
        </button>

        {/* LEFT COLUMN: SIMILAR FAQS (Only visible if matches exist) */}
        {filteredFaqs.length > 0 && (
          <div className="slide-up" style={{ flex: '1 1 50%', borderRight: '1px solid var(--border-color)', paddingRight: '2rem', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)' }}>
              <FaSearch /> Similar Official FAQs
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Your question might already be answered! Check these out before posting.
            </p>
            <div style={{ overflowY: 'auto', maxHeight: '400px', paddingRight: '0.5rem' }}>
              {filteredFaqs.map((faq, idx) => (
                <div key={idx} style={{ marginBottom: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                  <div 
                    onClick={() => setExpandedFaqId(expandedFaqId === idx ? null : idx)}
                    style={{ padding: '0.75rem', background: 'var(--bg-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span>{faq.question}</span>
                    <span style={{ transform: expandedFaqId === idx ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>▸</span>
                  </div>
                  {expandedFaqId === idx && (
                    <div style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}>
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RIGHT COLUMN: ASK FORM */}
        <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FaRobot style={{ color: 'var(--accent-primary)' }} /> Ask the Community
          </h2>

          {success ? (
            <div className="alert alert-success">
              <FaCheckCircle /> {success}
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {error && <div className="alert alert-error">{error}</div>}

              <div className="form-group">
                <label className="form-label">Category</label>
                <select 
                  className="form-select" 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                  ))}
                </select>
                <div className="form-hint">Choose a category, or leave as General and Yaksha will classify it.</div>
              </div>

              <div className="form-group" style={{ flex: 1, position: 'relative' }}>
                <label className="form-label">Your Question</label>
                <textarea 
                  className="form-textarea" 
                  placeholder="What would you like to know?"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{ minHeight: '150px', paddingRight: '40px' }}
                  autoFocus
                />
                <button 
                  type="button"
                  className={`mic-btn ${isListening ? 'listening' : ''}`}
                  onClick={startVoiceSearch}
                  style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                  title={isListening ? "Listening..." : "Dictate your question"}
                >
                  🎤
                </button>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 'auto' }} disabled={loading}>
                {loading ? <span className="spinner" /> : 'Post Question'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
