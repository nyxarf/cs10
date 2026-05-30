import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { FaCheckCircle, FaCommentDots } from 'react-icons/fa';

const CATEGORIES = ['about', 'timing', 'noc', 'selection', 'work', 'conduct', 'certificate', 'interviews', 'general'];

export default function AnswererDashboard() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryCounts, setCategoryCounts] = useState({});

  useEffect(() => {
    const fetchCounts = async () => {
      const counts = {};
      for (const cat of CATEGORIES) {
        try {
          const res = await api.get(`/questions?category=${cat}&status=open&limit=1`);
          counts[cat] = res.data.total;
        } catch { counts[cat] = 0; }
      }
      setCategoryCounts(counts);
    };
    fetchCounts();
  }, []);

  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ status: 'open', sort: 'newest' });
        if (selectedCategory) params.append('category', selectedCategory);
        const res = await api.get(`/questions?${params}`);
        const sorted = res.data.data.sort((a, b) => a.answer_count - b.answer_count);
        setQuestions(sorted);
      } catch (error) { console.error('Fetch failed:', error); }
      finally { setLoading(false); }
    };
    fetchQuestions();
  }, [selectedCategory]);

  return (
    <div className="page">
      <div className="container">
        <h1 style={{ fontSize: '2rem', fontWeight: 800, background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: '1.5rem' }}>
          Answer Dashboard
        </h1>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '2rem' }}>
          <div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Categories</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <button className={`btn btn-sm ${!selectedCategory ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSelectedCategory(null)} style={{ justifyContent: 'space-between' }}>
                <span>All</span><span className="badge badge-info">{Object.values(categoryCounts).reduce((a, b) => a + b, 0)}</span>
              </button>
              {CATEGORIES.map(cat => (
                <button key={cat} className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSelectedCategory(cat)} style={{ justifyContent: 'space-between' }}>
                  <span>{cat.charAt(0).toUpperCase() + cat.slice(1)}</span><span className="badge badge-info">{categoryCounts[cat] || 0}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            {loading ? <div className="loading-center"><div className="spinner spinner-lg" /></div> : questions.length === 0 ? (
              <div className="empty-state"><div className="empty-state-icon"><FaCheckCircle style={{ color: 'var(--accent-success)' }} /></div><div className="empty-state-text">No open questions</div></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {questions.map(q => (
                  <Link key={q._id} to={`/faq/community/${q._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="card" style={{ cursor: 'pointer' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>{q.rephrased_query}</h3>
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-primary">{q.category}</span>
                        {q.answer_count === 0 && <span className="badge badge-danger">Unanswered</span>}
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><FaCommentDots /> {q.answer_count}</span>
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
  );
}
