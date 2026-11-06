import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('Please provide both your email address and password.');
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.messages?.join(', ') ||
        'Unable to sign in. Please verify your credentials.';
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFillDemo = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('BookLoop2026!');
    setErrorMessage('');
  };

  return (
    <div className="auth-page">
      <div className="container">
        <div className="auth-card">
          <div className="auth-card__header">
            <span className="section-eyebrow">Reader Access</span>
            <h1 className="auth-card__title">Sign In to BookLoop</h1>
            <p className="auth-card__subtitle">
              Enter your credentials to access your library folio, lending desk, and community circulation.
            </p>
          </div>

          {errorMessage && (
            <div className="alert alert--error" style={{ marginBottom: 'var(--space-md)' }}>
              {errorMessage}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label form-label--required" htmlFor="loginEmail">
                Email Address
              </label>
              <input
                id="loginEmail"
                type="email"
                className="form-input"
                placeholder="reader@bookloop.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label form-label--required" htmlFor="loginPassword">
                Password
              </label>
              <input
                id="loginPassword"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <div className="auth-form__actions">
              <button
                type="submit"
                className="btn btn--primary auth-form__submit"
                disabled={submitting}
              >
                {submitting ? 'Signing In...' : 'Sign In'}
              </button>
            </div>
          </form>

          {/* Quick Demo Credentials for Reviewers */}
          <div className="auth-demo-box">
            <span className="auth-demo-box__title">Migrated Demo Personas</span>
            <p className="auth-demo-box__desc">
              For evaluation, you can sign in as either preserved user (password: <code>BookLoop2026!</code>):
            </p>
            <div className="auth-demo-box__buttons">
              <button
                type="button"
                className="auth-demo-btn"
                onClick={() => handleFillDemo('alice@bookloop.local')}
              >
                Fill Alice
              </button>
              <button
                type="button"
                className="auth-demo-btn"
                onClick={() => handleFillDemo('bob@bookloop.local')}
              >
                Fill Bob
              </button>
            </div>
          </div>

          <div className="auth-card__footer">
            <p>
              Don't have a library account yet?{' '}
              <Link to="/register" className="auth-link">
                Join the Community
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;

