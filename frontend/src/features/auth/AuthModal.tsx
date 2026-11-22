import React, { useState } from 'react';
import { api } from '../../services/api';
import { Lock, Sparkles, Key, CheckCircle, ArrowRight } from 'lucide-react';

interface AuthModalProps {
  onAuthenticated: () => void;
  ownerExists: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onAuthenticated, ownerExists }) => {
  const [isSetup, setIsSetup] = useState(!ownerExists);
  const [password, setPassword] = useState('Password123456');
  const [setupSecret, setSetupSecret] = useState('TUTOR_LEDGER_DEV_SECRET_2026');
  const [currency, setCurrency] = useState('INR');
  const [minBalance, setMinBalance] = useState('10000');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSetup) {
        await api.setupOwner({
          setup_secret: setupSecret,
          password,
          currency_code: currency,
          minimum_balance_minor: parseInt(minBalance, 10) * 100,
        });
        // Auto-load sample data for immediate usability
        try {
          await api.loadSampleData();
        } catch {}
        onAuthenticated();
      } else {
        await api.login(password);
        onAuthenticated();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!ownerExists) {
        await api.setupOwner({
          setup_secret: 'TUTOR_LEDGER_DEV_SECRET_2026',
          password: 'Password123456',
          currency_code: 'INR',
          minimum_balance_minor: 1000000,
        });
        await api.loadSampleData();
        onAuthenticated();
      } else {
        await api.login('Password123456');
        onAuthenticated();
      }
    } catch (err: any) {
      // If login fails, retry setup or report
      setError(err.message || 'Demo sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="bento-card" style={{ maxWidth: '440px', width: '100%', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-dropdown)' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'var(--brand-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
            }}
          >
            <Lock size={26} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {isSetup ? 'Welcome to Tutor Ledger' : 'Sign in to Tutor Ledger'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isSetup
              ? 'WhatsApp-first mobile back office for solo home tutors'
              : 'Enter your owner password to access your financial back office'}
          </p>
        </div>

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
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {isSetup && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Setup Secret (from .env)
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={setupSecret}
                  onChange={(e) => setSetupSecret(e.target.value)}
                  placeholder="TUTOR_LEDGER_DEV_SECRET_2026"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Currency
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
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Safety Cushion
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    value={minBalance}
                    onChange={(e) => setMinBalance(e.target.value)}
                    placeholder="10000"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Owner Password (at least 12 chars)
            </label>
            <input
              type="password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              minLength={12}
            />
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: '8px', width: '100%' }} disabled={loading}>
            {loading ? 'Authenticating...' : isSetup ? 'Complete Setup & Open Ledger' : 'Sign In'}
            <ArrowRight size={16} />
          </button>

          <button
            type="button"
            className="btn-secondary"
            style={{ width: '100%', borderColor: 'var(--brand-primary-border)', background: 'var(--brand-primary-light)', color: 'var(--brand-primary)', fontWeight: 700 }}
            onClick={handleDemoSignIn}
            disabled={loading}
          >
            <Sparkles size={16} color="var(--brand-primary)" />
            Instant 1-Click Tutor Demo Sign-In
          </button>
        </form>

        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Single owner per ledger • Encrypted at rest • Zero automated message leakage
        </div>
      </div>
    </div>
  );
};
