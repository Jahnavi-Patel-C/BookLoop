import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NEIGHBORHOODS } from '../constants/neighborhoods';
import './LoginPage.css';

function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    neighborhood: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) {
      errs.name = 'Full name is required';
    } else if (form.name.trim().length < 2) {
      errs.name = 'Name must be at least 2 characters';
    }

    if (!form.email.trim()) {
      errs.email = 'Email address is required';
    } else {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(form.email.trim())) {
        errs.email = 'Please provide a valid email address';
      }
    }

    if (!form.password) {
      errs.password = 'Password is required';
    } else {
      if (form.password.length < 8) {
        errs.password = 'Password must be at least 8 characters long';
      } else if (!/[a-zA-Z]/.test(form.password) || !/[0-9]/.test(form.password)) {
        errs.password = 'Password must contain at least one letter and one number';
      }
    }

    if (form.password !== form.confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }

    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    try {
      await register(form);
      navigate('/', { replace: true });
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.messages?.join(', ') ||
        'Failed to create account. Please try again.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="container">
        <div className="auth-card">
          <div className="auth-card__header">
            <span className="section-eyebrow">Membership</span>
            <h1 className="auth-card__title">Create Your Reader Account</h1>
            <p className="auth-card__subtitle">
              Join BookLoop to share your personal library, borrow volumes from neighbors, and keep stories in circulation.
            </p>
          </div>

          {submitError && (
            <div className="alert alert--error" style={{ marginBottom: 'var(--space-md)' }}>
              {submitError}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label form-label--required" htmlFor="regName">
                Full Name
              </label>
              <input
                id="regName"
                name="name"
                type="text"
                className={`form-input ${errors.name ? 'form-input--error' : ''}`}
                placeholder="e.g. Eleanor Vance"
                value={form.name}
                onChange={handleChange}
                autoComplete="name"
                required
              />
              {errors.name && <p className="form-error">{errors.name}</p>}
            </div>

            <div className="form-group">
              <label className="form-label form-label--required" htmlFor="regEmail">
                Email Address
              </label>
              <input
                id="regEmail"
                name="email"
                type="email"
                className={`form-input ${errors.email ? 'form-input--error' : ''}`}
                placeholder="eleanor@example.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
              {errors.email && <p className="form-error">{errors.email}</p>}
            </div>

            <div className="form-group">
              <label className="form-label form-label--required" htmlFor="regPassword">
                Password
              </label>
              <input
                id="regPassword"
                name="password"
                type="password"
                className={`form-input ${errors.password ? 'form-input--error' : ''}`}
                placeholder="At least 8 characters with letters & numbers"
                value={form.password}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
              {errors.password && <p className="form-error">{errors.password}</p>}
            </div>

            <div className="form-group">
              <label className="form-label form-label--required" htmlFor="regConfirmPassword">
                Confirm Password
              </label>
              <input
                id="regConfirmPassword"
                name="confirmPassword"
                type="password"
                className={`form-input ${errors.confirmPassword ? 'form-input--error' : ''}`}
                placeholder="Re-enter your password"
                value={form.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
              {errors.confirmPassword && <p className="form-error">{errors.confirmPassword}</p>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="regNeighborhood">
                Bengaluru Neighbourhood <span style={{ fontWeight: 'normal', color: 'var(--color-ink-muted)', fontSize: '0.85em' }}>(Optional — for local book discovery)</span>
              </label>
              <select
                id="regNeighborhood"
                name="neighborhood"
                className="form-input"
                value={form.neighborhood}
                onChange={handleChange}
              >
                <option value="">Select your Bengaluru neighbourhood...</option>
                {NEIGHBORHOODS.map((nh) => (
                  <option key={nh} value={nh}>
                    {nh}
                  </option>
                ))}
              </select>
            </div>

            <div className="auth-form__actions">
              <button
                type="submit"
                className="btn btn--primary auth-form__submit"
                disabled={submitting}
              >
                {submitting ? 'Creating Account...' : 'Register Account'}
              </button>
            </div>
          </form>

          <div className="auth-card__footer">
            <p>
              Already have an account?{' '}
              <Link to="/login" className="auth-link">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;

