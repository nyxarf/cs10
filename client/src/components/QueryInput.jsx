import { useState } from 'react';
import { FaSearch } from 'react-icons/fa';

export default function QueryInput({ onSubmit, loading }) {
  const [query, setQuery] = useState('');

  const cleanedLength = query.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().length;
  const isValid = cleanedLength >= 8 && cleanedLength <= 500;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid || loading) return;
    const cleaned = query.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    onSubmit(cleaned);
  };

  return (
    <form onSubmit={handleSubmit} className="query-input-form">
      <div className="form-group">
        <textarea
          className="form-textarea"
          placeholder="Ask anything about Samagama…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={500}
          rows={4}
          style={{ fontSize: '1.05rem' }}
        />
        <div className="form-hint" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{cleanedLength < 8 ? `At least ${8 - cleanedLength} more characters needed` : 'Ready to search'}</span>
          <span style={{ color: cleanedLength > 450 ? 'var(--accent-warning)' : undefined }}>
            {cleanedLength} / 500
          </span>
        </div>
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={!isValid || loading}
        style={{ width: '100%', padding: '1rem' }}
      >
        {loading ? (
          <><div className="spinner" /> Searching...</>
        ) : (
          <><FaSearch /> Ask Yaksha</>
        )}
      </button>
    </form>
  );
}
