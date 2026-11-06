import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { getBorrowRequests, respondHandover } from '../services/circulationService';
import { useAuth } from '../context/AuthContext';
import './BorrowingsPage.css';

function BorrowingsPage() {
  const { user, refreshNotifications } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showOnlyMine, setShowOnlyMine] = useState(true);
  const [respondingId, setRespondingId] = useState(null);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  const fetchBorrowings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (showOnlyMine && user?._id) {
        params.borrowerId = user._id;
      }
      const res = await getBorrowRequests(params);
      setRequests(res.data || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load borrowings');
    } finally {
      setLoading(false);
    }
  }, [showOnlyMine, user]);

  useEffect(() => {
    fetchBorrowings();
  }, [fetchBorrowings]);

  const handleRespond = async (reqId, decision) => {
    setRespondingId(reqId);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await respondHandover(reqId, decision);
      setActionSuccess(res.message || (decision === 'YES' ? 'Handover proposal accepted.' : 'Handover proposal declined.'));
      await fetchBorrowings();
      if (refreshNotifications) refreshNotifications();
    } catch (err) {
      setActionError(
        err.response?.data?.error ||
        err.response?.data?.messages?.join(', ') ||
        err.message ||
        'Failed to respond to proposal'
      );
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <div className="borrowings-page">
      <div className="borrowings-page__header">
        <div className="container">
          <span className="section-eyebrow">Reader Folio</span>
          <h1 className="borrowings-page__title">My Borrowing Folio</h1>
          <p className="borrowings-page__subtitle">
            {user ? (
              <>
                Signed in as <strong>{user.name}</strong> ({user.email}). Showing books you have requested or borrowed.
              </>
            ) : (
              'Track books you have requested, active reading loans, and scheduled return dates.'
            )}
          </p>

          <div className="borrowings-page__filter-box">
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className={`btn lending-page__filter-btn ${showOnlyMine ? 'lending-page__filter-btn--active' : ''}`}
                onClick={() => setShowOnlyMine(true)}
              >
                My Requests ({user?.name || 'You'})
              </button>
              <button
                type="button"
                className={`btn lending-page__filter-btn ${!showOnlyMine ? 'lending-page__filter-btn--active' : ''}`}
                onClick={() => setShowOnlyMine(false)}
              >
                All Community Borrowings
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="borrowings-page__body">
        <div className="container">
          {actionSuccess && (
            <div className="alert alert--success" style={{ marginBottom: 'var(--space-lg)' }}>
              {actionSuccess}
            </div>
          )}

          {actionError && (
            <div className="alert alert--error" style={{ marginBottom: 'var(--space-lg)' }}>
              {actionError}
            </div>
          )}

          {loading ? (
            <Loader message="Loading borrowing folio..." />
          ) : error ? (
            <ErrorState title="Could not load records" message={error} onRetry={fetchBorrowings} />
          ) : requests.length === 0 ? (
            <EmptyState
              title="No borrowing records found"
              message={
                showOnlyMine
                  ? `No borrow requests found for ${user?.name || 'you'}. Explore the catalogue to discover a title.`
                  : 'No borrow requests have been made in the community yet.'
              }
              actionLabel="Explore Books"
              onAction={() => window.location.href = '/explore'}
            />
          ) : (
            <div className="borrowings-grid">
              {requests.map((req) => {
                const now = new Date();
                const isOverdue = req.status === 'Approved' && req.dueDate && new Date(req.dueDate) < now;
                let overdueDays = 0;
                if (isOverdue) {
                  const diffMs = now.getTime() - new Date(req.dueDate).getTime();
                  overdueDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                }

                const formattedReqDate = new Date(req.requestedAt || req.createdAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                });

                const formattedDueDate = req.dueDate
                  ? new Date(req.dueDate).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : null;

                return (
                  <div key={req._id} className="borrow-card">
                    <div className="borrow-card__header">
                      <span className="borrow-card__genre">
                        {req.bookId?.genre || 'Literature'}
                      </span>
                      <span className={`badge ${
                        req.status === 'Approved'
                          ? isOverdue ? 'badge--unavailable' : 'badge--available'
                          : req.status === 'Returned'
                          ? 'badge--genre'
                          : 'badge--unavailable'
                      }`}>
                        {isOverdue ? `Overdue by ${overdueDays}d` : req.status}
                      </span>
                    </div>

                    <h3 className="borrow-card__title">
                      {req.bookId ? (
                        <Link to={`/books/${req.bookId._id || req.bookId}`}>
                          {req.bookId.title || 'Untitled Volume'}
                        </Link>
                      ) : (
                        'Book Record'
                      )}
                    </h3>

                    {req.bookId?.author && (
                      <p className="borrow-card__author">by {req.bookId.author}</p>
                    )}

                    <div className="borrow-card__meta">
                      <div className="borrow-card__meta-row">
                        <span>Book Owner</span>
                        <strong>{req.ownerName}</strong>
                      </div>
                      <div className="borrow-card__meta-row">
                        <span>Requested On</span>
                        <span>{formattedReqDate}</span>
                      </div>
                      {formattedDueDate && (
                        <div className="borrow-card__meta-row">
                          <span>Return Due Date</span>
                          <strong style={{ color: isOverdue ? 'var(--color-black)' : 'inherit' }}>
                            {formattedDueDate}
                          </strong>
                        </div>
                      )}
                    </div>

                    {req.notes && (
                      <p className="borrow-card__note">
                        <strong>Your note:</strong> “{req.notes}”
                      </p>
                    )}

                    {/* Handover Coordination Flow (Phase 8) */}
                    {req.status === 'Approved' && (
                      <div className="borrow-handover-wrapper">
                        {req.handover?.status === 'Proposed' && (
                          <div className="borrow-handover-box borrow-handover-box--proposed">
                            <div className="borrow-handover-box__header">
                              <span className="badge badge--genre">Handover Proposal Received</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                From {req.ownerName}
                              </span>
                            </div>
                            <div className="borrow-handover-box__details">
                              <p>
                                <strong>📅 Proposed Date:</strong>{' '}
                                {new Date(req.handover.proposedDate).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </p>
                              <p>
                                <strong>⏰ Proposed Time:</strong> {req.handover.proposedTime}
                              </p>
                              <p>
                                <strong>📍 Location / Instructions:</strong> {req.handover.instructions}
                              </p>
                            </div>
                            <p className="borrow-handover-box__prompt">Do you accept this handover proposal?</p>
                            <div className="borrow-handover-box__actions">
                              <button
                                type="button"
                                className="btn borrow-handover-box__btn-yes"
                                disabled={respondingId === req._id}
                                onClick={() => handleRespond(req._id, 'YES')}
                              >
                                {respondingId === req._id ? 'Saving...' : 'YES — Accept Proposal'}
                              </button>
                              <button
                                type="button"
                                className="btn borrow-handover-box__btn-no"
                                disabled={respondingId === req._id}
                                onClick={() => handleRespond(req._id, 'NO')}
                              >
                                NO — Decline
                              </button>
                            </div>
                          </div>
                        )}

                        {req.handover?.status === 'Accepted' && (
                          <div className="borrow-handover-box borrow-handover-box--accepted">
                            <div className="borrow-handover-box__header">
                              <span className="badge badge--available">Handover Confirmed ✓</span>
                            </div>
                            <div className="borrow-handover-box__details">
                              <p>
                                <strong>📅 Confirmed Date:</strong>{' '}
                                {new Date(req.handover.proposedDate).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </p>
                              <p>
                                <strong>⏰ Time:</strong> {req.handover.proposedTime}
                              </p>
                              <p>
                                <strong>📍 Collection Location:</strong> {req.handover.instructions}
                              </p>
                            </div>
                            <p className="borrow-handover-box__note">
                              Please meet {req.ownerName} as scheduled. Physical loan return coordination will follow once received.
                            </p>
                          </div>
                        )}

                        {req.handover?.status === 'Declined' && (
                          <div className="borrow-handover-box borrow-handover-box--declined">
                            <span className="badge badge--unavailable">Handover Proposal Declined</span>
                            <p style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>
                              You declined the proposed handover. Your borrowing approval remains active. {req.ownerName} has been notified to propose alternative details.
                            </p>
                          </div>
                        )}

                        {(!req.handover || req.handover.status === 'Unproposed') && (
                          <div className="borrow-handover-box borrow-handover-box--waiting">
                            <span className="badge badge--genre" style={{ borderStyle: 'dashed' }}>
                              Awaiting Handover Proposal
                            </span>
                            <p style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>
                              {req.ownerName} has approved your request and will propose a handover date, time, and collection point shortly.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="borrow-card__footer">
                      {req.bookId && (
                        <Link to={`/books/${req.bookId._id || req.bookId}`} className="btn borrow-card__btn">
                          View Book Details
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BorrowingsPage;
