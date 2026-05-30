import { useState } from 'react';
import { FaUser, FaLightbulb, FaUsers, FaBolt, FaExclamationTriangle } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const EyeIcon = ({ open }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {open ? (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ) : (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    )}
  </svg>
);

const PersonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
  </svg>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

function InputField({ label, icon, type = 'text', value, onChange, required, minLength, placeholder, rightElement, hint }) {
  return (
    <div style={{ marginBottom: '1.1rem' }}>
      <label style={{
        display: 'block', fontSize: '0.78rem', fontWeight: 700,
        color: 'var(--text-secondary)', marginBottom: '0.45rem',
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>{label}</label>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {icon && (
          <span style={{
            position: 'absolute', left: '0.85rem',
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
            pointerEvents: 'none',
          }}>{icon}</span>
        )}
        <input
          type={type}
          value={value}
          onChange={onChange}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          style={{
            width: '100%',
            padding: icon ? '0.75rem 0.9rem 0.75rem 2.6rem' : '0.75rem 0.9rem',
            paddingRight: rightElement ? '3rem' : '0.9rem',
            fontFamily: 'inherit',
            fontSize: '0.93rem',
            color: 'var(--text-primary)',
            background: 'var(--bg-glass)',
            border: '1.5px solid var(--border-color)',
            borderRadius: '10px',
            outline: 'none',
            transition: 'border-color 0.18s, box-shadow 0.18s',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--accent-primary)';
            e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.14)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--border-color)';
            e.target.style.boxShadow = 'none';
          }}
        />
        {rightElement && (
          <span style={{ position: 'absolute', right: '0.85rem', display: 'flex', alignItems: 'center' }}>
            {rightElement}
          </span>
        )}
      </div>
      {hint && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{hint}</p>}
    </div>
  );
}

const ROLES = [
  {
    value: 'asker',
    label: 'Ask Questions',
    desc: 'Post questions and get answers from the community.',
    Icon: FaUser,
  },
  {
    value: 'answerer',
    label: 'Answer Questions',
    desc: 'Help others by answering their questions.',
    Icon: FaLightbulb,
  },
  {
    value: 'both',
    label: 'Ask & Answer',
    desc: 'Do both — ask questions and help others too.',
    Icon: FaUsers,
  },
];

export default function Register() {
  const { register } = useAuth();
  const navigate     = useNavigate();

  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [role,     setRole]     = useState('asker');
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(name, email, password, role);
      navigate('/faq');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem 1rem' }}>
      <div className="card fade-in" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem 2.25rem' }}>

        {/* Logo + title */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: 'var(--gradient-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.4rem', margin: '0 auto 1rem',
            boxShadow: '0 4px 20px rgba(99,102,241,0.35)',
          }}>
            <FaBolt style={{ color: 'white', fontSize: '1.4rem' }} /></div>
          <h1 style={{
            fontSize: '1.65rem', fontWeight: 800, margin: 0,
            background: 'var(--gradient-primary)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            Join Samagama
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.4rem' }}>
            Create your account to get started
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1.25rem',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: 'var(--accent-danger)', fontSize: '0.87rem', display: 'flex', gap: '0.5rem', alignItems: 'center',
          }}>
            <FaExclamationTriangle /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <InputField
            label="Full Name"
            icon={<PersonIcon />}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            required
          />
          <InputField
            label="Email Address"
            icon={<MailIcon />}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
          <InputField
            label="Password"
            icon={<LockIcon />}
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 6 characters"
            required
            minLength={6}
            hint="At least 6 characters"
            rightElement={
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}
                tabIndex={-1}
              >
                <EyeIcon open={showPw} />
              </button>
            }
          />

          {/* Role picker */}
          <div style={{ marginBottom: '1.4rem' }}>
            <label style={{
              display: 'block', fontSize: '0.78rem', fontWeight: 700,
              color: 'var(--text-secondary)', marginBottom: '0.55rem',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              I want to
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem' }}>
              {ROLES.map((r) => {
                const active = role === r.value;
                const RoleIcon = r.Icon;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      gap: '0.3rem', padding: '0.85rem 0.9rem',
                      background: active ? 'rgba(99,102,241,0.1)' : 'var(--bg-glass)',
                      border: active ? '1.5px solid var(--accent-primary)' : '1.5px solid var(--border-color)',
                      borderRadius: '10px', cursor: 'pointer',
                      transition: 'all 0.18s',
                      boxShadow: active ? '0 0 0 3px rgba(99,102,241,0.1)' : 'none',
                      textAlign: 'left',
                    }}
                  >
                    <RoleIcon style={{ fontSize: '1.2rem', color: active ? 'var(--accent-primary-light)' : 'var(--text-muted)' }} />
                    <span style={{
                      fontSize: '0.82rem', fontWeight: 700,
                      color: active ? 'var(--accent-primary-light)' : 'var(--text-primary)',
                    }}>{r.label}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      {r.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit */}
          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '0.8rem', fontSize: '0.95rem', marginTop: '0.25rem' }}
          >
            {loading ? (
              <><div className="spinner" /> Creating account…</>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Divider + login link */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.5rem 0 1.1rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent-primary-light)', fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
