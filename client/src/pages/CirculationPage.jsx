import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { getCirculationRecords } from '../services/circulationService';
import './CirculationPage.css';

function CirculationPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchCirculation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await getCirculationRecords(params);
      setRecords(res.data || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load circulation records');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchCirculation();
  }, [fetchCirculation]);

  return (
    <div className="circulation-page">
      <div className="circulation-page__header">
        <div className="container">
          <span className="section-eyebrow">Community Ledger</span>
          <h1 className="circulation-page__title">Circulation Chronicle</h1>
          <p className="circulation-page__subtitle">
            An open record of books moving between neighbours, completed circulations, and active reader loans.
          </p>

          <div className="circulation-page__tabs">
            <button
              type="button"
              className={`btn circulation-page__tab-btn ${statusFilter === 'all' ? 'circulation-page__tab-btn--active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All Records
            </button>
            <button
              type="button"
              className={`btn circulation-page__tab-btn ${statusFilter === 'active' ? 'circulation-page__tab-btn--active' : ''}`}
              onClick={() => setStatusFilter('active')}
            >
              Active Loans
            </button>
            <button
              type="button"
              className={`btn circulation-page__tab-btn ${statusFilter === 'pending' ? 'circulation-page__tab-btn--active' : ''}`}
              onClick={() => setStatusFilter('pending')}
            >
              Pending Requests
            </button>
            <button
              type="button"
              className={`btn circulation-page__tab-btn ${statusFilter === 'overdue' ? 'circulation-page__tab-btn--active' : ''}`}
              onClick={() => setStatusFilter('overdue')}
            >
              Overdue Loans
            </button>
            <button
              type="button"
              className={`btn circulation-page__tab-btn ${statusFilter === 'returned' ? 'circulation-page__tab-btn--active' : ''}`}
              onClick={() => setStatusFilter('returned')}
            >
              Returned Books
            </button>
          </div>
        </div>
      </div>

      <div className="circulation-page__body">
        <div className="container">
          {loading ? (
            <Loader message="Loading circulation history ledger..." />
          ) : error ? (
            <ErrorState title="Could not load records" message={error} onRetry={fetchCirculation} />
          ) : records.length === 0 ? (
            <EmptyState
              title="No circulation entries found"
              message={
                statusFilter !== 'all'
                  ? `There are no circulation entries matching the "${statusFilter}" filter right now.`
                  : 'No circulation activity has been recorded yet.'
              }
              actionLabel="Explore Available Books"
              onAction={() => window.location.href = '/explore'}
            />
          ) : (
            <div className="circulation-table-wrap">
              <table className="circulation-table">
                <thead>
                  <tr>
                    <th>Book Title</th>
                    <th>Borrower</th>
                    <th>Owner</th>
                    <th>Borrowed Date</th>
                    <th>Due Date</th>
                    <th>Actual Return Date</th>
                    <th>Current Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec) => {
                    const formattedBorrowDate = rec.borrowedDate
                      ? new Date(rec.borrowedDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '—';

                    const formattedDueDate = rec.dueDate
                      ? new Date(rec.dueDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '—';

                    const formattedReturnDate = rec.returnedDate
                      ? new Date(rec.returnedDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '—';

                    return (
                      <tr key={rec._id}>
                        <td className="circulation-table__title">
                          {rec.bookId ? (
                            <Link to={`/books/${rec.bookId}`}>
                              {rec.bookTitle || 'Untitled Book'}
                            </Link>
                          ) : (
                            rec.bookTitle || 'Untitled Book'
                          )}
                          {rec.bookAuthor && (
                            <span className="circulation-table__author">by {rec.bookAuthor}</span>
                          )}
                        </td>
                        <td>{rec.borrowerName}</td>
                        <td>{rec.ownerName}</td>
                        <td>{formattedBorrowDate}</td>
                        <td>
                          <span style={{
                            color: rec.isOverdue ? '#b00020' : 'inherit',
                            fontWeight: rec.isOverdue ? 600 : 400
                          }}>
                            {formattedDueDate}
                          </span>
                        </td>
                        <td>{formattedReturnDate}</td>
                        <td>
                          <span className={`badge ${
                            rec.isOverdue
                              ? 'badge--unavailable'
                              : rec.status === 'Active'
                              ? 'badge--available'
                              : rec.status === 'Returned'
                              ? 'badge--genre'
                              : 'badge--unavailable'
                          }`}>
                            {rec.isOverdue
                              ? `Overdue (${rec.overdueDays}d)`
                              : rec.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CirculationPage;

