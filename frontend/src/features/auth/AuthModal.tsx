import React, { useState } from 'react';
import { api } from '../../services/api';
import type { OwnerProfile } from '../../types';
import { Lock, Sparkles, User, Mail, Calendar, ArrowRight, CheckCircle2, UserPlus, LogIn, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  onAuthenticated: (owner?: OwnerProfile) => void;
  ownerExists: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onAuthenticated, ownerExists }) => {
  const [tab, setTab] = useState<'login' | 'signup'>(ownerExists ? 'login' : 'signup');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('sarah.jenkins@tutorledger.com');
  const [loginPassword, setLoginPassword] = useState('Password123456');

  // Signup form state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupDob, setSignupDob] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [minBalance, setMinBalance] = useState('10000');
  const [loadSample, setLoadSample] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Maximum allowed DOB is 16 years ago today
  const maxDobDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 16);
    return d.toISOString().slice(0, 10);
  })();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.login({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      onAuthenticated(res.owner);
    } catch (err: any) {
      if (err.status === 401) {
        setError(err.message && err.message !== 'Something went wrong.' ? err.message : 'Incorrect email or password. Please verify your credentials or use the 1-Click Demo.');
      } else {
        setError(err.message || 'Login failed. Please check your credentials or try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation: Name
    if (signupName.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }

    // Validation: Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signupEmail.trim())) {
      setError('Please provide a valid email address.');
      return;
    }

    // Validation: DOB
    if (!signupDob) {
      setError('Please enter your date of birth.');
      return;
    }
    const dobDate = new Date(signupDob);
    const now = new Date();
    const ageYears = (now.getTime() - dobDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (isNaN(dobDate.getTime()) || ageYears < 16) {
      setError('You must be at least 16 years of age to register.');
      return;
    }
    if (ageYears > 110) {
      setError('Please enter a valid date of birth.');
      return;
    }

    // Validation: Password
    if (signupPassword.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.signup({
        name: signupName.trim(),
        email: signupEmail.trim(),
        dob: signupDob,
        password: signupPassword,
        currency_code: currency,
        minimum_balance_minor: parseInt(minBalance || '0', 10) * 100,
        opening_balance_minor: 0,
        load_sample_data: loadSample,
      });

      if (loadSample) {
        try {
          await api.loadSampleData();
        } catch {}
      }

      onAuthenticated(res.owner);
    } catch (err: any) {
      if (err.status === 409 || err.message?.toLowerCase().includes('conflict')) {
        setError('An account with this email already exists. Please sign in instead.');
        setLoginEmail(signupEmail.trim());
        setTab('login');
      } else {
        setError(err.message || 'Account registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      try {
        const res = await api.login({
          email: 'sarah.jenkins@tutorledger.com',
          password: 'Password123456',
        });
        onAuthenticated(res.owner);
        return;
      } catch (loginErr: any) {
        // If login failed because owner is not set up, register demo owner
        const res = await api.signup({
          name: 'Sarah Jenkins',
          email: 'sarah.jenkins@tutorledger.com',
          dob: '1992-06-15',
          password: 'Password123456',
          currency_code: 'INR',
          minimum_balance_minor: 1000000,
          opening_balance_minor: 1500000,
        });
        try {
          await api.loadSampleData();
        } catch {}
        onAuthenticated(res.owner);
        return;
      }
    } catch (err: any) {
      setError(err.message || 'Demo sign-in failed. Please try manual sign-up.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div
        className="bento-card"
        style={{
          maxWidth: '460px',
          width: '100%',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-dropdown)',
          borderRadius: '16px',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'var(--brand-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '10px',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
            }}
          >
            <Lock size={26} />
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Tutor Ledger
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            WhatsApp-first mobile back office for solo home tutors
          </p>
        </div>

        {/* Tab Switcher: Sign In vs Sign Up */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: 'var(--bg-secondary)',
            borderRadius: '10px',
            padding: '4px',
            marginBottom: '18px',
            border: '1px solid var(--border-color)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 12px',
              fontSize: '0.85rem',
              fontWeight: tab === 'login' ? 700 : 500,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              background: tab === 'login' ? 'var(--card-bg)' : 'transparent',
              color: tab === 'login' ? 'var(--text-main)' : 'var(--text-muted)',
              boxShadow: tab === 'login' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <LogIn size={15} />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('signup');
              setError(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 12px',
              fontSize: '0.85rem',
              fontWeight: tab === 'signup' ? 700 : 500,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              background: tab === 'signup' ? 'var(--card-bg)' : 'transparent',
              color: tab === 'signup' ? 'var(--text-main)' : 'var(--text-muted)',
              boxShadow: tab === 'signup' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <UserPlus size={15} />
            Create Account
          </button>
        </div>

        {/* Error notification banner */}
        {error && (
          <div
            style={{
              padding: '10px 14px',
              background: 'var(--badge-rose-bg)',
              border: '1px solid rgba(225, 29, 72, 0.25)',
              borderRadius: '8px',
              color: 'var(--badge-rose-text)',
              fontSize: '0.85rem',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        {/* SIGN IN FORM */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  className="input-field"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="tutor@example.com"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Password
              </label>
              <input
                type="password"
                className="input-field"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••••••"
                required
              />
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: '6px', width: '100%' }} disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In'}
              <ArrowRight size={16} />
            </button>

            <button
              type="button"
              className="btn-secondary"
              style={{
                width: '100%',
                borderColor: 'var(--brand-primary-border)',
                background: 'var(--brand-primary-light)',
                color: 'var(--brand-primary)',
                fontWeight: 700,
              }}
              onClick={handleDemoSignIn}
              disabled={loading}
            >
              <Sparkles size={16} color="var(--brand-primary)" />
              Instant 1-Click Tutor Demo Sign-In
            </button>
          </form>
        )}

        {/* SIGN UP FORM */}
        {tab === 'signup' && (
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Full Name
              </label>
              <input
                type="text"
                className="input-field"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                placeholder="e.g. Sarah Jenkins"
                required
                minLength={2}
                autoFocus
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Email Address
              </label>
              <input
                type="email"
                className="input-field"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                placeholder="sarah.jenkins@tutorledger.com"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Date of Birth
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={signupDob}
                  max={maxDobDate}
                  onChange={(e) => setSignupDob(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Base Currency
                </label>
                <select
                  className="input-field"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="INR">₹ INR (India)</option>
                  <option value="GBP">£ GBP (UK)</option>
                  <option value="USD">$ USD (US)</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Password (min 8 characters)
              </label>
              <input
                type="password"
                className="input-field"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                minLength={8}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Safety Cushion Threshold ({currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '₹'})
              </label>
              <input
                type="number"
                className="input-field"
                value={minBalance}
                onChange={(e) => setMinBalance(e.target.value)}
                placeholder="10000"
                min="0"
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Triggers alerts when 13-week cash forecast dips below this reserve.
              </span>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer', marginTop: '2px' }}>
              <input
                type="checkbox"
                checked={loadSample}
                onChange={(e) => setLoadSample(e.target.checked)}
                style={{ accentColor: 'var(--brand-primary)', width: '16px', height: '16px' }}
              />
              Pre-populate 12 sample students & invoices for instant testing
            </label>

            <button type="submit" className="btn-primary" style={{ marginTop: '6px', width: '100%' }} disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account & Open Ledger'}
              <ArrowRight size={16} />
            </button>

            <button
              type="button"
              className="btn-secondary"
              style={{
                width: '100%',
                borderColor: 'var(--brand-primary-border)',
                background: 'var(--brand-primary-light)',
                color: 'var(--brand-primary)',
                fontWeight: 700,
              }}
              onClick={handleDemoSignIn}
              disabled={loading}
            >
              <Sparkles size={16} color="var(--brand-primary)" />
              Instant 1-Click Tutor Demo Sign-In
            </button>
          </form>
        )}

        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          PostgreSQL storage • Encrypted at rest • Zero automated message leakage
        </div>
      </div>
    </div>
  );
};
