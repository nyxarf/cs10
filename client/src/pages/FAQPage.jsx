import { useState, useEffect, useRef } from 'react';
import faqService from '../services/faqService';
import questionService from '../services/questionService';
import PostQuestion from '../components/PostQuestion';
import { useAuth } from '../context/AuthContext';
import { FaUser, FaRobot, FaBolt, FaBrain, FaExclamationTriangle, FaLightbulb, FaCheckCircle, FaThumbsUp, FaThumbsDown, FaPaperPlane, FaUpload, FaHeart, FaMagic, FaArrowLeft } from 'react-icons/fa';

export default function FAQPage() {
  const { isAuthenticated } = useAuth();
  const [messages, setMessages] = useState([
    {
      id: 'greeting',
      sender: 'yaksha',
      text: "Hello! I am Yaksha, your AI assistant for Samagama. Ask me anything about registration, certificates, NOC, selection, timings, or policies. Let's chat!",
      source: 'system'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Community posting states
  const [phase, setPhase] = useState('chat'); // chat | posting | thanked
  const [postData, setPostData] = useState({ originalQuery: '', rephrased: '', suggestedCategory: 'general' });

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const cleanedLength = input.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().length;
  const isValidInput = cleanedLength >= 8 && cleanedLength <= 500;

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!isValidInput || loading) return;

    const userQuery = input.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    setInput('');
    setError(null);

    // 1. Append User Message
    const userMessageId = `msg-${Date.now()}`;
    const newMessages = [
      ...messages,
      {
        id: userMessageId,
        sender: 'user',
        text: userQuery
      }
    ];
    setMessages(newMessages);
    setLoading(true);

    try {
      // 2. Validate query
      const validateData = await faqService.validateQuery(userQuery);

      if (!validateData.valid) {
        // Validation failed -> Yaksha directly responds with validation warning
        setMessages(prev => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            sender: 'yaksha',
            text: <><FaExclamationTriangle style={{ color: 'var(--accent-warning)', marginRight: '0.4rem' }} /> {validateData.reason || 'Please provide a valid question.'}</>,
            source: 'system'
          }
        ]);
        setLoading(false);
        return;
      }

      const cleanedQuery = validateData.cleaned_query;

      // 3. Format history array to send to /ask
      // We pass the user/assistant messages (excluding system messages)
      const chatHistory = newMessages
        .filter(m => m.source !== 'system')
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text
        }));

      // 4. Send request to Yaksha pipeline (including history)
      const askData = await faqService.askYaksha(
        cleanedQuery,
        chatHistory.slice(0, -1) // pass all previous turns except the latest one we just appended
      );

      const { answer, sentiment, source, escalate, cacheId } = askData;

      // 5. Append Yaksha response
      setMessages(prev => [
        ...prev,
        {
          id: `yaksha-${Date.now()}`,
          sender: 'yaksha',
          text: answer,
          sentiment,
          source,
          escalate,
          cacheId
        }
      ]);

    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
      setMessages(prev => [
        ...prev,
        {
          id: `error-reply-${Date.now()}`,
          sender: 'yaksha',
          text: <><FaExclamationTriangle style={{ color: 'var(--accent-warning)', marginRight: '0.4rem' }} /> I'm having trouble processing your question right now. Please try again in a moment.</>,
          source: 'system'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleNotHelpful = async (queryText) => {
    // Prep community post
    setLoading(true);
    try {
      const data = await questionService.prepareQuestion(queryText);
      setPostData({
        originalQuery: queryText,
        rephrased: data.rephrased,
        suggestedCategory: data.category
      });
      setPhase('posting');
    } catch {
      setPostData({
        originalQuery: queryText,
        rephrased: queryText,
        suggestedCategory: 'general'
      });
      setPhase('posting');
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (id, cacheId, helpful) => {
    setMessages(prev =>
      prev.map(m => (m.id === id ? { ...m, feedbackSubmitted: true, wasHelpful: helpful } : m))
    );
    try {
      if (cacheId) {
        await faqService.submitFeedback(cacheId, helpful);
      }
    } catch (err) {
      console.error('Failed to submit feedback');
    }
  };

  const [isListening, setIsListening] = useState(false);

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
      setInput(prev => prev ? prev + ' ' + transcript : transcript);
    };
    
    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };
    
    recognition.onend = () => setIsListening(false);
    
    recognition.start();
  };

  // Custom rich-text Markdown renderer inside the chat
  const renderFormattedAnswer = (text) => {
    if (!text) return null;
    if (typeof text !== 'string') return text;

    const lines = text.split('\n');
    let inList = false;
    let listItems = [];
    const elements = [];

    const flushList = (key) => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${key}`} style={{
            paddingLeft: '1.5rem',
            margin: '0.5rem 0 1rem 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem'
          }}>
            {listItems}
          </ul>
        );
        listItems = [];
        inList = false;
      }
    };

    const parseInlineStyles = (lineText) => {
      const parts = [];
      let lastIndex = 0;
      const regex = /\*\*(.*?)\*\*/g;
      let match;

      while ((match = regex.exec(lineText)) !== null) {
        const matchIndex = match.index;
        if (matchIndex > lastIndex) {
          parts.push(lineText.substring(lastIndex, matchIndex));
        }
        parts.push(
          <strong key={`bold-${matchIndex}`} style={{
            color: 'var(--accent-primary-light)',
            fontWeight: 700
          }}>
            {match[1]}
          </strong>
        );
        lastIndex = regex.lastIndex;
      }

      if (lastIndex < lineText.length) {
        parts.push(lineText.substring(lastIndex));
      }

      return parts.length > 0 ? parts : lineText;
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('###')) {
        flushList(index);
        const headingText = trimmedLine.replace(/^###\s*/, '');
        elements.push(
          <h4 key={`heading-${index}`} style={{
            fontSize: '1.1rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginTop: '1.25rem',
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            paddingBottom: '0.3rem'
          }}>
            <span style={{ color: 'var(--accent-secondary)' }}><FaMagic /></span>
            {parseInlineStyles(headingText)}
          </h4>
        );
      }
      else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        inList = true;
        const itemText = trimmedLine.replace(/^[-*]\s*/, '');
        listItems.push(
          <li key={`li-${index}`} style={{
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            listStyleType: 'disc',
            fontSize: '0.95rem'
          }}>
            {parseInlineStyles(itemText)}
          </li>
        );
      }
      else if (/^\d+\.\s+/.test(trimmedLine)) {
        inList = true;
        const itemText = trimmedLine.replace(/^\d+\.\s+/, '');
        listItems.push(
          <li key={`li-${index}`} style={{
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            listStyleType: 'decimal',
            fontSize: '0.95rem'
          }}>
            {parseInlineStyles(itemText)}
          </li>
        );
      }
      else {
        if (trimmedLine === '') {
          flushList(index);
        } else {
          if (inList) {
            flushList(index);
          }
          elements.push(
            <p key={`p-${index}`} style={{
              marginBottom: '0.75rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              fontSize: '0.95rem'
            }}>
              {parseInlineStyles(trimmedLine)}
            </p>
          );
        }
      }
    });

    flushList('final');
    return elements;
  };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: '800px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }} className="fade-in">
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            background: 'var(--gradient-primary)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}>
            Ask Yaksha <FaBolt style={{ color: 'var(--accent-warning)' }} />
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
            Continuous AI FAQ Companion for Samagama Program
          </p>
        </div>

        {error && (
          <div className="alert alert-error fade-in" style={{ marginBottom: '1rem' }}>
            <FaExclamationTriangle /> {error}
          </div>
        )}

        {phase === 'chat' && (
          <>
            {/* Chat Board */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              height: '520px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.2rem',
              marginBottom: '1.5rem',
              boxShadow: 'var(--shadow-lg)'
            }}>
              {messages.map((m) => {
                const isUser = m.sender === 'user';
                const showEmpathy = m.sentiment === 'frustrated' || m.sentiment === 'confused';

                return (
                  <div
                    key={m.id}
                    className="fade-in"
                    style={{
                      display: 'flex',
                      justifyContent: isUser ? 'flex-end' : 'flex-start',
                      width: '100%'
                    }}
                  >
                    <div style={{
                      maxWidth: '85%',
                      minWidth: '250px',
                      background: isUser ? 'var(--gradient-primary)' : 'var(--bg-glass)',
                      border: isUser ? 'none' : '1px solid var(--border-color)',
                      padding: '1.25rem',
                      borderRadius: isUser 
                        ? 'var(--radius-md) var(--radius-md) 0 var(--radius-md)' 
                        : 'var(--radius-md) var(--radius-md) var(--radius-md) 0',
                      boxShadow: isUser ? 'none' : 'var(--shadow-sm)',
                      color: 'var(--text-primary)',
                      position: 'relative'
                    }}>
                      
                      {/* Avatar / Sender */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.5rem',
                        fontSize: '0.8rem',
                        opacity: 0.8,
                        fontWeight: 600
                      }}>
                        <span>{isUser ? <><FaUser style={{ marginRight: '0.3rem' }} /> You</> : <><FaRobot style={{ marginRight: '0.3rem' }} /> Yaksha</>}</span>
                        {!isUser && m.source && m.source !== 'system' && (
                          <span className="badge badge-info" style={{ fontSize: '0.6rem', padding: '0.15rem 0.4rem' }}>
                            {m.source === 'cache' ? <><FaBolt /> Cache</> : <><FaBrain /> AI</>}
                          </span>
                        )}
                      </div>

                      {/* Empathy Warning */}
                      {!isUser && showEmpathy && (
                        <div style={{
                          background: 'rgba(245, 158, 11, 0.08)',
                          borderLeft: '3px solid var(--accent-warning)',
                          padding: '0.4rem 0.6rem',
                          fontSize: '0.85rem',
                          color: 'var(--accent-warning)',
                          marginBottom: '0.75rem',
                          borderRadius: '0 var(--radius-sm) var(--radius-sm) 0'
                        }}>
                          <FaHeart style={{ marginRight: '0.3rem' }} /> We understand this can be confusing — here is what we found:
                        </div>
                      )}

                      {/* Content */}
                      <div style={{ wordBreak: 'break-word', fontSize: '0.975rem' }}>
                        {isUser ? (
                          <p style={{ margin: 0, lineHeight: 1.5 }}>{m.text}</p>
                        ) : (
                          renderFormattedAnswer(m.text)
                        )}
                      </div>

                      {/* Escalate alert */}
                      {!isUser && m.escalate && (
                        <div style={{
                          marginTop: '1rem',
                          padding: '0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(99, 102, 241, 0.08)',
                          border: '1px solid rgba(99, 102, 241, 0.2)',
                          fontSize: '0.85rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem'
                        }}>
                          <span style={{ color: 'var(--accent-primary-light)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <FaLightbulb /> I couldn't find a matching FAQ in the database.
                          </span>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleNotHelpful(messages.filter(msg => msg.sender === 'user').slice(-1)[0]?.text || m.text)}
                            style={{ alignSelf: 'flex-start', padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                          >
                            <FaUpload style={{ marginRight: '0.3rem' }} /> Post to Community Board
                          </button>
                        </div>
                      )}

                      {/* Helpful Feedback Actions */}
                      {!isUser && !m.escalate && m.source !== 'system' && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: '1rem',
                          paddingTop: '0.75rem',
                          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                          fontSize: '0.8rem'
                        }}>
                          <span style={{ color: 'var(--text-muted)' }}>Was this helpful?</span>
                          {m.feedbackSubmitted ? (
                            <span style={{ color: m.wasHelpful ? 'var(--accent-success)' : 'var(--text-muted)', fontWeight: 600 }}>
                              {m.wasHelpful ? <><FaThumbsUp style={{ marginRight: '0.2rem' }} /> Thank you!</> : <><FaThumbsDown style={{ marginRight: '0.2rem' }} /> Noted!</>}
                            </span>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                className="btn btn-sm btn-success"
                                onClick={() => handleFeedback(m.id, m.cacheId, true)}
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-success)' }}
                              >
                                <FaThumbsUp style={{ marginRight: '0.2rem' }} /> Yes
                              </button>
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => {
                                  handleFeedback(m.id, m.cacheId, false);
                                  handleNotHelpful(messages.filter(msg => msg.sender === 'user').slice(-1)[0]?.text || m.text);
                                }}
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                              >
                                <FaThumbsDown style={{ marginRight: '0.2rem' }} /> No
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {loading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                  <div style={{
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border-color)',
                    padding: '1rem 1.25rem',
                    borderRadius: 'var(--radius-md) var(--radius-md) var(--radius-md) 0',
                    width: '180px'
                  }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8, fontWeight: 600, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><FaRobot /> Yaksha</div>
                    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', height: '20px' }}>
                      <div className="spinner" style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-primary-light)' }} />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Yaksha is thinking...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Area */}
            <form onSubmit={handleSend} className="card fade-in" style={{ padding: '1rem', border: '1px solid var(--border-active)' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'stretch' }}>
                <textarea
                  className="form-textarea"
                  placeholder="Ask a follow-up question..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  maxLength={500}
                  rows={2}
                  style={{
                    flex: 1,
                    fontSize: '1rem',
                    minHeight: '44px',
                    resize: 'none',
                    padding: '0.6rem 0.8rem',
                    marginBottom: 0
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (isValidInput && !loading) handleSend();
                    }
                  }}
                />
                <button 
                  type="button"
                  className={`btn ${isListening ? 'btn-danger' : 'btn-secondary'}`}
                  onClick={startVoiceSearch}
                  title={isListening ? "Listening..." : "Dictate your question"}
                  style={{
                    padding: '0 1rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  🎤
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!isValidInput || loading}
                  style={{
                    padding: '0 1.5rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <FaPaperPlane /> Ask
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                <span>{cleanedLength < 8 ? `Type ${8 - cleanedLength} more characters...` : 'Ready to send'}</span>
                <span>{cleanedLength} / 500</span>
              </div>
            </form>
          </>
        )}

        {/* Phase: Community Posting */}
        {phase === 'posting' && (
          <div>
            <PostQuestion
              originalQuery={postData.originalQuery}
              rephrased={postData.rephrased}
              suggestedCategory={postData.suggestedCategory}
              onPosted={() => {
                setPhase('thanked');
              }}
            />
            <button
              className="btn btn-secondary"
              onClick={() => setPhase('chat')}
              style={{ width: '100%', marginTop: '1rem' }}
            >
              <FaArrowLeft style={{ marginRight: '0.4rem' }} /> Back to Chat
            </button>
          </div>
        )}

        {/* Phase: Thank you */}
        {phase === 'thanked' && (
          <div className="card slide-up" style={{ marginTop: '1.5rem', textAlign: 'center', padding: '2.5rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', color: 'var(--accent-success)' }}><FaCheckCircle /></div>
            <h3 style={{ color: 'var(--accent-success)', marginBottom: '0.5rem' }}>Question Posted!</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Your question has been posted to the Community Board. Other members or admins will answer it soon!
            </p>
            <button
              className="btn btn-primary"
              onClick={() => {
                setPhase('chat');
              }}
            >
              Back to Chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
