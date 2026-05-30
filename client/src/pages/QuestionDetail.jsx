import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import AnswerForm from '../components/AnswerForm';
import VoteButtons from '../components/VoteButtons';
import { FaQuestionCircle, FaArrowLeft, FaEye, FaCommentDots, FaStar, FaHourglassHalf, FaCheckCircle } from 'react-icons/fa';

export default function QuestionDetail() {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const [question, setQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await api.get(`/questions/${id}`);
      setQuestion(res.data.question);
      setAnswers(res.data.answers);
      setHiddenCount(res.data.hidden_count);
    } catch (error) {
      console.error('Failed to fetch question:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleAnswered = () => {
    fetchData(); // Refresh answers
  };

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <div className="skeleton-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <div className="skeleton skeleton-title" style={{ width: '80%', height: '2rem' }}></div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <div className="skeleton skeleton-text" style={{ width: '100px' }}></div>
              <div className="skeleton skeleton-text" style={{ width: '100px' }}></div>
            </div>
          </div>
          <div className="skeleton skeleton-title" style={{ width: '30%' }}></div>
          {[1, 2].map(i => (
            <div key={i} className="skeleton-card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
              <div className="skeleton skeleton-text" style={{ width: '100%', height: '4rem' }}></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="page">
        <div className="container">
          <div className="empty-state">
            <div className="empty-state-icon"><FaQuestionCircle /></div>
            <div className="empty-state-text">Question not found</div>
            <Link to="/faq/community" className="btn btn-primary" style={{ marginTop: '1rem' }}>Back to Community</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: '800px' }}>
        <Link to="/faq/community" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', display: 'inline-block' }}>
          <FaArrowLeft style={{ marginRight: '0.4rem' }} /> Back to Community Board
        </Link>

        {/* Question Card */}
        <div className="card fade-in" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <VoteButtons
              questionId={question._id}
              initialScore={question.net_score || 0}
              isOwn={question.posted_by?._id === user?._id}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <span className="badge badge-primary">{question.category}</span>
                <span className={`badge ${question.status === 'open' ? 'badge-warning' : 'badge-success'}`}>
                  {question.status}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  <FaEye style={{ marginRight: '0.2rem' }} /> {question.view_count} views
                </span>
              </div>

              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                {question.rephrased_query}
              </h1>

              {question.original_query !== question.rephrased_query && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  Original: "{question.original_query}"
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Asked by {question.posted_by?.name || 'Anonymous'} · {new Date(question.created_at).toLocaleDateString()}
                </div>
                {isAuthenticated && (
                  <button 
                    onClick={async () => {
                      if(window.confirm('Are you sure you want to report this question as off-topic or spam?')) {
                        try {
                          await api.post(`/questions/${question._id}/report`);
                          alert('Question reported successfully.');
                        } catch (err) {
                          alert(err.response?.data?.error || 'Failed to report question');
                        }
                      }
                    }}
                    className="btn btn-sm"
                    style={{ background: 'transparent', color: 'var(--accent-danger)', border: '1px solid var(--accent-danger)', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                  >
                    Report
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Answers Section */}
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          <FaCommentDots style={{ marginRight: '0.3rem' }} /> {answers.length} Answer{answers.length !== 1 ? 's' : ''}
        </h2>

        {answers.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            No answers yet. Be the first to help!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {answers.map((answer) => (
              <div key={answer._id} className="card">
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <VoteButtons
                    answerId={answer._id}
                    initialScore={answer.net_score}
                    isOwnAnswer={user?._id === answer.answered_by?._id}
                  />
                  <div style={{ flex: 1 }}>
                    <p style={{ lineHeight: 1.7, marginBottom: '0.75rem' }}>
                      {answer.content}
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', flexWrap: 'wrap' }}>
                      <span>by {answer.answered_by?.name || 'Anonymous'}</span>
                      {answer.answered_by?.xp != null && (
                        <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>
                          <FaStar style={{ color: 'var(--accent-warning)', marginRight: '0.2rem' }} /> {answer.answered_by.xp} SP
                        </span>
                      )}
                      <span>{new Date(answer.created_at).toLocaleDateString()}</span>
                      {answer.status === 'flagged' && (
                        <span className="badge badge-warning" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-warning)', fontSize: '0.7rem', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                          <FaHourglassHalf style={{ marginRight: '0.2rem' }} /> Pending Admin Review
                        </span>
                      )}
                      {answer.promoted_to_corpus && (
                        <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><FaCheckCircle /> In FAQ corpus</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Hidden answers notice */}
        {hiddenCount > 0 && (
          <div style={{
            textAlign: 'center',
            padding: '0.75rem',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            marginTop: '1rem',
          }}>
            {hiddenCount} answer{hiddenCount !== 1 ? 's' : ''} hidden due to low score
          </div>
        )}

        {/* Answer Form */}
        {isAuthenticated ? (
          <AnswerForm questionId={id} onAnswered={handleAnswered} />
        ) : (
          <div className="card" style={{ marginTop: '1.5rem', textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Log in to answer this question
            </p>
            <Link to="/login" className="btn btn-primary">Login</Link>
          </div>
        )}
      </div>
    </div>
  );
}
