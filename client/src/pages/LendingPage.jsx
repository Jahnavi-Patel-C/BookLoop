import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import {
  getBorrowRequests,
  approveBorrowRequest,
  rejectBorrowRequest,
  returnBorrowRequest,
  proposeHandover,
} from '../services/circulationService';
import { useAuth } from '../context/AuthContext';
import './LendingPage.css';

function LendingPage() {
  const { user, refreshNotifications } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [showOnlyMine, setShowOnlyMine] = useState(true);

  // Approval modal state
  const [approvingId, setApprovingId] = useState(null);
  const [dueDate, setDueDate] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Handover proposal modal state (Phase 8)
  const [handoverModalReq, setHandoverModalReq] = useState(null);
  const [handoverDate, setHandoverDate] = useState('');
  const [handoverTime, setHandoverTime] = useState('17:00');
  const [handoverInstructions, setHandoverInstructions] = useState('');
  const [handoverSubmitting, setHandoverSubmitting] = useState(false);
  const [handoverError, setHandoverError] = useState('');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (showOnlyMine && user?._id) {
        params.ownerId = user._id;
      }
      if (statusFilter) params.status = statusFilter;
      const res = await getBorrowRequests(params);
      setRequests(res.data || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load lending records');
    } finally {
      setLoading(false);
    }
  }, [showOnlyMine, user, statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleOpenApprove = (reqId) => {
    setApprovingId(reqId);
    setActionError('');
    // Default due date to 14 days in future
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setDueDate(d.toISOString().split('T')[0]);
  };

  const handleApproveSubmit = async (e) => {
    e.preventDefault();
    if (!dueDate) {
      setActionError('Please specify a due date');
      return;
    }
    const chosen = new Date(dueDate);
    if (chosen <= new Date()) {
      setActionError('Due date must be in the future');
      return;
    }

    setActionLoading(true);
    setActionError('');
    try {
      await approveBorrowRequest(approvingId, chosen.toISOString());
      setActionSuccess('Borrow request approved and book marked as currently on loan.');
      setApprovingId(null);
      await fetchRequests();
      if (refreshNotifications) refreshNotifications();
    } catch (err) {
      setActionError(
        err.response?.data?.error ||
        err.response?.data?.messages?.join(', ') ||
        err.message ||
        'Failed to approve request'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (reqId) => {
    if (!window.confirm('Are you sure you want to decline this borrow request?')) return;
    setActionLoading(true);
    setActionError('');
    try {
      await rejectBorrowRequest(reqId);
      setActionSuccess('Borrow request declined.');
      await fetchRequests();
      if (refreshNotifications) refreshNotifications();
    } catch (err) {
      setActionError(
        err.response?.data?.error ||
        err.response?.data?.messages?.join(', ') ||
        err.message ||
        'Failed to reject request'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturn = async (reqId) => {
    if (!window.confirm('Mark this book as safely returned to the shelf?')) return;
    setActionLoading(true);
    setActionError('');
    try {
      await returnBorrowRequest(reqId);
      setActionSuccess('Book return recorded. Book availability has been restored.');
      await fetchRequests();
      if (refreshNotifications) refreshNotifications();
    } catch (err) {
      setActionError(
        err.response?.data?.error ||
        err.response?.data?.messages?.join(', ') ||
        err.message ||
        'Failed to record return'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenProposeHandover = (req) => {
    setHandoverModalReq(req);
    setHandoverError('');
    // Default to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setHandoverDate(tomorrow.toISOString().split('T')[0]);
    setHandoverTime(req.handover?.proposedTime || '17:00');
    // Pre-populate instructions with owner's neighbourhood if available
    const defaultLoc = req.handover?.instructions || (user?.neighborhood ? `Near ${user.neighborhood}, Bengaluru` : '');
    setHandoverInstructions(defaultLoc);
  };

  const handleCloseProposeHandover = () => {
    setHandoverModalReq(null);
    setHandoverError('');
    setHandoverInstructions('');
  };

  const handleSubmitHandover = async (e) => {
    e.preventDefault();
    if (!handoverDate) {
      setHandoverError('Please select a handover date');
      return;
    }
    if (!handoverTime) {
      setHandoverError('Please select a handover time');
      return;
    }
    if (!handoverInstructions.trim()) {
      setHandoverError('Please provide handover instructions or location');
      return;
    }

    setHandoverSubmitting(true);
    setHandoverError('');
    try {
      await proposeHandover(handoverModalReq._id, {
        date: handoverDate,
        time: handoverTime,
        instructions: handoverInstructions.trim(),
      });
      setActionSuccess('Handover proposal sent to borrower. Awaiting their response.');
      handleCloseProposeHandover();
      await fetchRequests();
      if (refreshNotifications) refreshNotifications();
    } catch (err) {
      setHandoverError(
        err.response?.data?.error ||
        err.response?.data?.messages?.join(', ') ||
        err.message ||
        'Failed to submit handover proposal'
      );
    } finally {
      setHandoverSubmitting(false);
    }
  };

  return (
    <div className="lending-page">
      <div className="lending-page__header">
        <div className="container">
          <span className="section-eyebrow">Owner Desk</span>
          <h1 className="lending-page__title">Lending & Circulation Desk</h1>
          <p className="lending-page__subtitle">
            {user ? (
              <>
                Signed in as <strong>{user.name}</strong> ({user.email}). Showing requests for volumes you own.
              </>
            ) : (
              'Manage incoming borrowing requests for books you have listed in the community catalogue.'
            )}
          </p>

          <div className="lending-page__filters">
            <div className="form-group lending-page__search-owner" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: 0 }}>
              <button
                type="button"
                className={`btn lending-page__filter-btn ${showOnlyMine ? 'lending-page__filter-btn--active' : ''}`}
                onClick={() => setShowOnlyMine(true)}
              >
                Requests for My Books ({user?.name || 'You'})
              </button>
              <button
                type="button"
                className={`btn lending-page__filter-btn ${!showOnlyMine ? 'lending-page__filter-btn--active' : ''}`}
                onClick={() => setShowOnlyMine(false)}
              >
                All Community Requests
              </button>
            </div>

            <div className="lending-page__status-tabs">
              <button
                type="button"
                className={`btn lending-page__filter-btn ${statusFilter === '' ? 'lending-page__filter-btn--active' : ''}`}
                onClick={() => setStatusFilter('')}
              >
                All
              </button>
              <button
                type="button"
                className={`btn lending-page__filter-btn ${statusFilter === 'Pending' ? 'lending-page__filter-btn--active' : ''}`}
                onClick={() => setStatusFilter('Pending')}
              >
                Pending
              </button>
              <button
                type="button"
                className={`btn lending-page__filter-btn ${statusFilter === 'Approved' ? 'lending-page__filter-btn--active' : ''}`}
                onClick={() => setStatusFilter('Approved')}
              >
                Active Loans
              </button>
              <button
                type="button"
                className={`btn lending-page__filter-btn ${statusFilter === 'Returned' ? 'lending-page__filter-btn--active' : ''}`}
                onClick={() => setStatusFilter('Returned')}
              >
                Returned
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="lending-page__body">
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
            <Loader message="Loading circulation requests..." />
          ) : error ? (
            <ErrorState title="Could not load requests" message={error} onRetry={fetchRequests} />
          ) : requests.length === 0 ? (
            <EmptyState
              title="No lending requests found"
              message={
                showOnlyMine
                  ? `No incoming borrow requests found for books owned by ${user?.name || 'you'}. When other readers request your books, they will appear here.`
                  : 'No circulation requests match your current filters.'
              }
              actionLabel="View Catalogue"
              onAction={() => window.location.href = '/explore'}
            />
          ) : (
            <div className="lending-table-wrap">
              <table className="lending-table">
                <thead>
                  <tr>
                    <th>Book Title</th>
                    <th>Borrower</th>
                    <th>Owner</th>
                    <th>Status</th>
                    <th>Due Date</th>
                    <th>Requested On</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => {
                    const isOverdue = req.status === 'Approved' && req.dueDate && new Date(req.dueDate) < new Date();
                    const formattedReqDate = new Date(req.requestedAt || req.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    });
                    const formattedDueDate = req.dueDate
                      ? new Date(req.dueDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '—';

                    // Check if current user is authorized to manage this request
                    const isReqOwner = user && (
                      (req.ownerId && (req.ownerId._id || req.ownerId) === user._id) ||
                      (req.ownerName && user.name && req.ownerName.toLowerCase().trim() === user.name.toLowerCase().trim())
                    );

                    return (
                      <tr key={req._id}>
                        <td className="lending-table__title-cell">
                          {req.bookId ? (
                            <Link to={`/books/${req.bookId._id || req.bookId}`}>
                              {req.bookId.title || 'Untitled Volume'}
                            </Link>
                          ) : (
                            'Volume'
                          )}
                          {req.notes && (
                            <span className="lending-table__notes">“{req.notes}”</span>
                          )}
                        </td>
                        <td>{req.borrowerName}</td>
                        <td>
                          {req.ownerName}
                          {isReqOwner && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-olive)', marginLeft: '4px', fontWeight: 600 }}>
                              (You)
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${
                            req.status === 'Approved'
                              ? isOverdue ? 'badge--unavailable' : 'badge--available'
                              : req.status === 'Returned'
                              ? 'badge--genre'
                              : 'badge--unavailable'
                          }`}>
                            {isOverdue ? 'Overdue' : req.status}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: isOverdue ? 'var(--color-black)' : 'inherit', fontWeight: isOverdue ? 600 : 400 }}>
                            {formattedDueDate}
                          </span>
                        </td>
                        <td>{formattedReqDate}</td>
                        <td className="lending-table__actions">
                          {req.status === 'Pending' && (
                            isReqOwner ? (
                              <div className="lending-table__btn-group">
                                <button
                                  type="button"
                                  className="btn lending-table__action-btn"
                                  onClick={() => handleOpenApprove(req._id)}
                                  disabled={actionLoading}
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  className="btn lending-table__action-btn"
                                  onClick={() => handleReject(req._id)}
                                  disabled={actionLoading}
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                Owner only
                              </span>
                            )
                          )}

                          {req.status === 'Approved' && (
                            isReqOwner ? (
                              <div className="lending-handover-col" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {/* Handover Coordination Flow */}
                                {(!req.handover || req.handover.status === 'Unproposed') && (
                                  <button
                                    type="button"
                                    className="btn lending-table__action-btn"
                                    onClick={() => handleOpenProposeHandover(req)}
                                    style={{ backgroundColor: 'var(--color-royal-blue)', borderColor: 'var(--color-royal-blue)' }}
                                  >
                                    Propose Handover
                                  </button>
                                )}

                                {req.handover?.status === 'Proposed' && (
                                  <div style={{ fontSize: '0.75rem', lineHeight: '1.3' }}>
                                    <span className="badge badge--genre" style={{ display: 'inline-block', marginBottom: '2px' }}>
                                      Handover Proposed
                                    </span>
                                    <div style={{ color: 'var(--color-text-secondary)' }}>
                                      📅 {new Date(req.handover.proposedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {req.handover.proposedTime}
                                    </div>
                                    <div style={{ fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
                                      Awaiting reader response
                                    </div>
                                  </div>
                                )}

                                {req.handover?.status === 'Accepted' && (
                                  <div style={{ fontSize: '0.75rem', lineHeight: '1.3' }}>
                                    <span className="badge badge--available" style={{ display: 'inline-block', marginBottom: '2px' }}>
                                      Handover Confirmed ✓
                                    </span>
                                    <div style={{ fontWeight: 600, color: 'var(--color-black)' }}>
                                      📅 {new Date(req.handover.proposedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {req.handover.proposedTime}
                                    </div>
                                    <div style={{ color: 'var(--color-text-secondary)', maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={req.handover.instructions}>
                                      📍 {req.handover.instructions}
                                    </div>
                                  </div>
                                )}

                                {req.handover?.status === 'Declined' && (
                                  <div style={{ fontSize: '0.75rem', lineHeight: '1.3' }}>
                                    <span className="badge badge--unavailable" style={{ display: 'inline-block', marginBottom: '2px' }}>
                                      Handover Declined
                                    </span>
                                    <div style={{ color: 'var(--color-text-muted)', marginBottom: '3px' }}>
                                      Reader requested rescheduling
                                    </div>
                                    <button
                                      type="button"
                                      className="btn lending-table__action-btn"
                                      onClick={() => handleOpenProposeHandover(req)}
                                      style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                                    >
                                      Reschedule Handover
                                    </button>
                                  </div>
                                )}

                                <button
                                  type="button"
                                  className="btn lending-table__action-btn"
                                  onClick={() => handleReturn(req._id)}
                                  disabled={actionLoading}
                                  style={{ marginTop: '2px' }}
                                >
                                  Mark Returned
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                In circulation
                              </span>
                            )
                          )}

                          {(req.status === 'Returned' || req.status === 'Rejected') && (
                            <span className="lending-table__closed">
                              {req.status === 'Returned' ? 'Completed' : 'Rejected'}
                            </span>
                          )}
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

      {/* Approval Modal */}
      {approvingId && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <h3 className="modal-title">Approve Borrowing Request</h3>
            <p className="modal-desc">
              Specify the agreed return due date for this loan. The book will be marked unavailable during circulation.
            </p>

            <form onSubmit={handleApproveSubmit}>
              <div className="form-group">
                <label className="form-label form-label--required" htmlFor="modalDueDate">
                  Return Due Date
                </label>
                <input
                  id="modalDueDate"
                  type="date"
                  className="form-input"
                  min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>

              {actionError && (
                <div className="form-error" style={{ marginBottom: 'var(--space-md)' }}>
                  {actionError}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn modal-btn"
                  onClick={() => setApprovingId(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn modal-btn"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Approving...' : 'Confirm Loan Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Handover Proposal Modal (Phase 8) */}
      {handoverModalReq && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <h3 className="modal-title">
              {handoverModalReq.handover?.status === 'Declined' ? 'Reschedule Handover' : 'Propose Handover Coordination'}
            </h3>
            <p className="modal-desc">
              Coordinate in-person handover for <strong>"{handoverModalReq.bookId?.title || 'the volume'}"</strong> with <strong>{handoverModalReq.borrowerName}</strong>. Specify the proposed calendar date, time, and collection instructions.
            </p>

            <form onSubmit={handleSubmitHandover}>
              <div className="form-group">
                <label className="form-label form-label--required" htmlFor="modalHandoverDate">
                  Handover Date (Calendar)
                </label>
                <input
                  id="modalHandoverDate"
                  type="date"
                  className="form-input"
                  min={new Date().toISOString().split('T')[0]}
                  max={handoverModalReq.dueDate ? new Date(handoverModalReq.dueDate).toISOString().split('T')[0] : undefined}
                  value={handoverDate}
                  onChange={(e) => setHandoverDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label form-label--required" htmlFor="modalHandoverTime">
                  Handover Time (Time Picker)
                </label>
                <input
                  id="modalHandoverTime"
                  type="time"
                  className="form-input"
                  value={handoverTime}
                  onChange={(e) => setHandoverTime(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label form-label--required" htmlFor="modalHandoverInstructions">
                  Handover Location & Instructions
                </label>
                <textarea
                  id="modalHandoverInstructions"
                  className="form-input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  maxLength={500}
                  value={handoverInstructions}
                  onChange={(e) => setHandoverInstructions(e.target.value)}
                  placeholder="e.g. Meet outside Costa Coffee near Yelahanka Police Station. I will be wearing a blue jacket."
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {500 - (handoverInstructions || '').length} characters remaining
                </span>
              </div>

              {handoverError && (
                <div className="form-error" style={{ marginBottom: 'var(--space-md)' }}>
                  {handoverError}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn modal-btn"
                  onClick={handleCloseProposeHandover}
                  disabled={handoverSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn modal-btn"
                  disabled={handoverSubmitting}
                >
                  {handoverSubmitting ? 'Sending Proposal...' : 'Send Handover Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default LendingPage;
