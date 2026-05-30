import { useState } from 'react';
import questionService from '../services/questionService';
import { useAuth } from '../context/AuthContext';
import { FaEdit, FaPaperPlane } from 'react-icons/fa';

const CATEGORIES = ['about', 'timing', 'noc', 'selection', 'work', 'conduct', 'certificate', 'interviews', 'general'];

export default function PostQuestion({ originalQuery, rephrased, suggestedCategory, onPosted }) {
  const { isAuthenticated } = useAuth();
  const [question, setQuestion] = useState(rephrased || originalQuery);
  const [category, setCategory] = useState(suggestedCategory || 'general');
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState(null);

  const handlePost = async () => {
    if (!isAuthenticated) {
      setMessage({ type: 'error', text: 'Please log in to post a question.' });
      return;
    }

    setPosting(true);
    setMessage(null);
    try {
      const data = await questionService.submitQuestion({
        original_query: originalQuery,
        rephrased_query: question,
        category,
      });

      if (data.duplicate) {
        setMessage({ type: 'info', text: data.message });
      } else {
        setMessage({ type: 'success', text: "Your question has been posted! You'll be notified when someone answers." });
        if (onPosted) onPosted(data.question_id);
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to post question.' });
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="card slide-up" style={{ marginTop: '1.5rem' }}>
      <div className="card-header">
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FaEdit /> Post to Community</h3>
      </div>

      <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
        We've rephrased your question for clarity. Feel free to edit it before posting.
      </p>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Your Question</label>
        <textarea
          className="form-textarea"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Category</label>
        <select
          className="form-select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <button
        className="btn btn-primary"
        onClick={handlePost}
        disabled={posting || question.trim().length < 8}
        style={{ width: '100%' }}
      >
        {posting ? <><div className="spinner" /> Posting...</> : <><FaPaperPlane /> Post to Community</>}
      </button>
    </div>
  );
}
