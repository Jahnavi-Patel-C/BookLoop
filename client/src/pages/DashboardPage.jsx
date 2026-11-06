import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Loader from '../components/Loader';
import ErrorState from '../components/ErrorState';
import { getDashboardStats } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import './DashboardPage.css';

function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDashboardStats();
      setStats(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load reader statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) return <Loader message="Compiling reader dashboard metrics..." />;

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="container">
          <ErrorState
            title="Dashboard Unavailable"
            message={error}
            onRetry={fetchStats}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-page__header">
        <div className="container">
          <span className="section-eyebrow">Personal Folio & Ledger</span>
          <h1 className="dashboard-page__title">Reader Dashboard</h1>
          <p className="dashboard-page__subtitle">
            Welcome back, <strong>{user?.name}</strong>. Here is the live status of your personal library, active borrowing loans, and community exchanges.
          </p>
        </div>
      </div>

      <div className="dashboard-page__body">
        <div className="container">
          {/* Main Metrics Grid */}
          <div className="dashboard-grid">
            <div className="dashboard-stat-card">
              <span className="dashboard-stat-card__label">Books Catalogued</span>
              <div className="dashboard-stat-card__number">{stats.booksListed}</div>
              <p className="dashboard-stat-card__desc">
                Volumes in your personal collection registered with BookLoop.
              </p>
              <Link to="/explore" className="dashboard-stat-card__link">
                View Catalogue →
              </Link>
            </div>

            <div className="dashboard-stat-card">
              <span className="dashboard-stat-card__label">Active Loans (Lending)</span>
              <div className="dashboard-stat-card__number">{stats.activeLoans}</div>
              <p className="dashboard-stat-card__desc">
                Copies of your books currently in circulation with fellow readers.
              </p>
              <Link to="/lending" className="dashboard-stat-card__link">
                Open Lending Desk →
              </Link>
            </div>

            <div className="dashboard-stat-card">
              <span className="dashboard-stat-card__label">Pending Requests</span>
              <div className="dashboard-stat-card__number">{stats.pendingBorrowRequests}</div>
              <p className="dashboard-stat-card__desc">
                Incoming reader requests awaiting your approval or review.
              </p>
              <Link to="/lending" className="dashboard-stat-card__link">
                Review Requests →
              </Link>
            </div>

            <div className="dashboard-stat-card">
              <span className="dashboard-stat-card__label">Active Borrowings</span>
              <div className="dashboard-stat-card__number">{stats.activeBorrowings}</div>
              <p className="dashboard-stat-card__desc">
                Books you have borrowed from neighbours currently in your care.
              </p>
              <Link to="/borrowings" className="dashboard-stat-card__link">
                My Borrowings →
              </Link>
            </div>

            <div className={`dashboard-stat-card ${stats.overdueLoans > 0 ? 'dashboard-stat-card--alert' : ''}`}>
              <span className="dashboard-stat-card__label">Overdue Loans</span>
              <div className="dashboard-stat-card__number">{stats.overdueLoans}</div>
              <p className="dashboard-stat-card__desc">
                {stats.overdueLoans > 0
                  ? 'Loans past their scheduled return due date.'
                  : 'All loans are on schedule. No overdue volumes.'}
              </p>
              <Link to="/circulation" className="dashboard-stat-card__link">
                Circulation Ledger →
              </Link>
            </div>

            <div className="dashboard-stat-card">
              <span className="dashboard-stat-card__label">Completed Exchanges</span>
              <div className="dashboard-stat-card__number">{stats.completedCirculations}</div>
              <p className="dashboard-stat-card__desc">
                Completed cycles of stories safely shared and returned.
              </p>
              <Link to="/circulation" className="dashboard-stat-card__link">
                Full Ledger →
              </Link>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="dashboard-actions-panel">
            <h3 className="dashboard-actions-panel__title">Quick Actions</h3>
            <div className="dashboard-actions-panel__buttons">
              <Link to="/add" className="btn btn--primary">
                Share Another Book
              </Link>
              <Link to="/explore" className="btn btn--primary">
                Explore Community Shelf
              </Link>
              <Link to="/lending" className="btn btn--primary">
                Go to Lending Desk
              </Link>
              <Link to="/profile" className="btn btn--primary">
                View Reader Profile
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;

