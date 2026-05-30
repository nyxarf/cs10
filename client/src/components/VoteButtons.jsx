import { useState } from 'react';
import api from '../api/client';
import { FaArrowUp, FaArrowDown } from 'react-icons/fa';

export default function VoteButtons({ answerId, questionId, initialScore = 0, isOwnAnswer = false, isOwn = false }) {
  const [score, setScore] = useState(initialScore);
  const [voted, setVoted] = useState(false);
  const [error, setError] = useState(null);

  const disabled = isOwn || isOwnAnswer;
  const endpoint = answerId
    ? `/answers/${answerId}/vote`
    : `/questions/${questionId}/vote`;
  const ownLabel = answerId ? "Can't vote on own answer" : "Can't vote on own question";

  const handleVote = async (type) => {
    if (voted || disabled) return;
    setError(null);

    // Optimistic Update
    const previousScore = score;
    const change = type === 'up' ? 1 : -1;
    setScore(score + change);
    setVoted(type); // Store vote type to allow visualizing it

    try {
      const res = await api.post(endpoint, { type });
      setScore(res.data.net_score); // Sync with actual server score
    } catch (err) {
      // Revert on failure
      setScore(previousScore);
      setVoted(false);
      const msg = err.response?.data?.error || 'Vote failed';
      setError(msg);
    }
  };

  return (
    <div>
      <div className="vote-group">
        <button
          className="vote-btn upvote"
          onClick={() => handleVote('up')}
          disabled={voted || disabled}
          title={disabled ? ownLabel : 'Upvote'}
        >
          <FaArrowUp />
        </button>
        <span className="vote-score" style={{
          color: score > 0 ? 'var(--accent-success)' : score < 0 ? 'var(--accent-danger)' : 'var(--text-secondary)'
        }}>
          {score}
        </span>
        <button
          className="vote-btn downvote"
          onClick={() => handleVote('down')}
          disabled={voted || disabled}
          title={disabled ? ownLabel : 'Downvote'}
        >
          <FaArrowDown />
        </button>
      </div>
      {error && <div className="form-error" style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}>{error}</div>}
    </div>
  );
}
