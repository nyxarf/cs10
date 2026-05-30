import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { FaSearch, FaBolt, FaUsers, FaArrowRight } from 'react-icons/fa';
import Footer from '../components/Footer';

export default function Home() {
  const [askInput, setAskInput] = useState('');
  const navigate = useNavigate();

  const handleAskSubmit = (e) => {
    e.preventDefault();
    if (askInput.trim()) {
      navigate(`/faq?q=${encodeURIComponent(askInput)}`);
    }
  };

  return (
    <div className="home-page" style={{ 
      minHeight: 'calc(100vh - 64px)', 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '4rem 0',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background ambient glows */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '-10%',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(0,0,0,0) 70%)',
        borderRadius: '50%',
        zIndex: 0,
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-10%',
        right: '-5%',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, rgba(0,0,0,0) 70%)',
        borderRadius: '50%',
        zIndex: 0,
        pointerEvents: 'none'
      }} />

      <div className="container" style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: '800px' }}>
        <div className="badge badge-primary fade-in" style={{ marginBottom: '1.5rem', animationDelay: '0.1s' }}>
          Welcome to VINS 2026
        </div>
        
        <h1 className="fade-in" style={{
          fontSize: '3.5rem',
          fontWeight: 800,
          lineHeight: 1.1,
          marginBottom: '1.5rem',
          letterSpacing: '-0.03em',
          animationDelay: '0.2s'
        }}>
          The Ultimate <br/>
          <span style={{
            background: 'var(--gradient-primary)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            FAQ Companion
          </span>
        </h1>
        
        <p className="fade-in" style={{
          fontSize: '1.15rem',
          color: 'var(--text-secondary)',
          marginBottom: '3rem',
          maxWidth: '600px',
          margin: '0 auto 3rem auto',
          lineHeight: 1.7,
          animationDelay: '0.3s'
        }}>
          Get instant answers to your Vicharanashala Summer Internship questions. Powered by Yaksha AI, driven by the community.
        </p>

        <form onSubmit={handleAskSubmit} className="fade-in" style={{ marginBottom: '2rem', animationDelay: '0.35s', position: 'relative', maxWidth: '500px', margin: '0 auto 2rem auto' }}>
          <input
            type="text"
            className="faq-search-input"
            placeholder="Type your question directly..."
            value={askInput}
            onChange={(e) => setAskInput(e.target.value)}
            style={{ padding: '1rem 1.5rem', fontSize: '1.05rem', borderRadius: '100px', width: '100%', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
          />
          <button type="submit" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <FaSearch />
          </button>
        </form>

        <div className="fade-in" style={{ 
          display: 'flex', 
          gap: '1rem', 
          justifyContent: 'center', 
          flexWrap: 'wrap',
          marginBottom: '4rem',
          animationDelay: '0.4s'
        }}>
          <Link to="/faq" className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.05rem', borderRadius: '100px' }}>
            <FaBolt /> Ask Yaksha AI
          </Link>
          <Link to="/faq/browse" className="btn btn-secondary" style={{ padding: '1rem 2rem', fontSize: '1.05rem', borderRadius: '100px' }}>
            <FaSearch /> Browse FAQs
          </Link>
        </div>

        <div className="slide-up" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.5rem',
          textAlign: 'left',
          animationDelay: '0.5s'
        }}>
          <Link to="/faq/browse" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card" style={{ height: '100%', cursor: 'pointer' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px', 
                background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.2rem', marginBottom: '1rem'
              }}>
                <FaSearch />
              </div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Curated Knowledge</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Browse officially verified answers categorized by timeline and topic.
              </p>
              <div style={{ color: 'var(--accent-primary-light)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                Explore <FaArrowRight style={{ fontSize: '0.7rem' }} />
              </div>
            </div>
          </Link>

          <Link to="/faq" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card" style={{ height: '100%', cursor: 'pointer' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px', 
                background: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.2rem', marginBottom: '1rem'
              }}>
                <FaBolt />
              </div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Yaksha Intelligence</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Chat with our AI assistant to instantly synthesize answers to complex questions.
              </p>
              <div style={{ color: 'var(--accent-secondary)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                Ask Now <FaArrowRight style={{ fontSize: '0.7rem' }} />
              </div>
            </div>
          </Link>

          <Link to="/faq/community" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card" style={{ height: '100%', cursor: 'pointer' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px', 
                background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-success)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.2rem', marginBottom: '1rem'
              }}>
                <FaUsers />
              </div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Community Board</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Engage with fellow applicants. Discuss, upvote, and find trending insights.
              </p>
              <div style={{ color: 'var(--accent-success)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                Join Discussion <FaArrowRight style={{ fontSize: '0.7rem' }} />
              </div>
            </div>
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}
