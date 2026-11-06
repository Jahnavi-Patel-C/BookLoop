import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import Loader from '../components/Loader';
import ErrorState from '../components/ErrorState';
import { getBook } from '../services/bookService';
import { createBorrowRequest, getBorrowRequests } from '../services/circulationService';
import { useAuth } from '../context/AuthContext';
import './BookDetailsPage.css';

function BookDetailsPage() {
  const { id } = useParams();
  const location = useLocation();
  const { user, isAuthenticated, refreshNotifications } = useAuth();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Borrow request form state
  const [showBorrowForm, setShowBorrowForm] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [existingRequests, setExistingRequests] = useState([]);

  const fetchBookData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bookRes, reqsRes] = await Promise.all([
        getBook(id),
        getBorrowRequests({ bookId: id }),
      ]);
      setBook(bookRes.data);
      setExistingRequests(reqsRes.data || []);
    } catch (err) {
      setError(
        err.response?.data?.error || err.message || 'Failed to load book details'
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchBookData();
  }, [fetchBookData]);

  const handleBorrowSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess('');

    if (!user) {
      setSubmitError('Please sign in to submit a borrow request.');
      return;
    }

    if (
      book && (
        (book.ownerId && (book.ownerId._id || book.ownerId) === user._id) ||
        (book.ownerName && book.ownerName.toLowerCase().trim() === user.name.toLowerCase())
      )
    ) {
      setSubmitError('You cannot submit a borrow request for a book you already own.');
      return;
    }

    setSubmitting(true);
    try {
      await createBorrowRequest({
        bookId: id,
        borrowerName: user.name,
        notes: notes.trim(),
      });
      setSubmitSuccess('Your borrow request has been recorded and sent to the owner.');
      setNotes('');
      setShowBorrowForm(false);
      // Refresh requests & notifications
      const reqsRes = await getBorrowRequests({ bookId: id });
      setExistingRequests(reqsRes.data || []);
      if (refreshNotifications) {
        refreshNotifications();
      }
    } catch (err) {
      setSubmitError(
        err.response?.data?.error ||
        err.response?.data?.messages?.join(', ') ||
        err.message ||
        'Could not submit borrow request'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loader message="Loading book record..." />;

  if (error) {
    return (
      <div className="book-details">
        <div className="container">
          <ErrorState title="Book record not found" message={error} onRetry={fetchBookData} />
        </div>
      </div>
    );
  }

  if (!book) return null;

  const isOwner = user && (
    (book.ownerId && (book.ownerId._id || book.ownerId) === user._id) ||
    (book.ownerName && user.name && book.ownerName.toLowerCase().trim() === user.name.toLowerCase().trim())
  );

  const existingUserRequest = existingRequests.find((req) => {
    const isUserBorrower = (
      (req.borrowerId && (req.borrowerId._id || req.borrowerId) === user?._id) ||
      (req.borrowerName && user?.name && req.borrowerName.toLowerCase().trim() === user.name.toLowerCase().trim())
    );
    return isUserBorrower && ['Pending', 'Approved'].includes(req.status);
  });

  const formattedDate = new Date(book.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="book-details">
      <div className="container">
        <div className="book-details__top-nav">
          <Link to="/explore" className="book-details__back">
            ← Return to Catalogue
          </Link>
        </div>

        <div className="book-details__layout">
          <div className="book-details__cover-col">
            <div className="book-details__cover">
              {book.coverImage ? (
                <img src={book.coverImage} alt={`Cover of ${book.title}`} />
              ) : (
                <div className="book-details__cover-specimen">
                  <span className="book-details__specimen-genre">{book.genre}</span>
                  <h3 className="book-details__specimen-title">{book.title}</h3>
                  <div className="book-details__specimen-rule"></div>
                  <p className="book-details__specimen-author">{book.author}</p>
                </div>
              )}
            </div>
          </div>

          <div className="book-details__info">
            <div className="book-details__badges">
              <span className="badge badge--genre">{book.genre}</span>
              <span className={`badge ${book.availability ? 'badge--available' : 'badge--unavailable'}`}>
                {book.availability ? 'Available for Sharing' : 'Currently with a Reader'}
              </span>
              {isOwner && (
                <span className="badge badge--genre" style={{ borderColor: 'var(--color-olive)', color: 'var(--color-olive)' }}>
                  Your Book
                </span>
              )}
            </div>

            <h1 className="book-details__title">{book.title}</h1>
            <p className="book-details__author">by {book.author}</p>

            {book.description ? (
              <div className="book-details__description-wrap">
                <h4 className="book-details__section-heading">About this book</h4>
                <p className="book-details__description">{book.description}</p>
              </div>
            ) : (
              <div className="book-details__description-wrap">
                <p className="book-details__description" style={{ fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
                  No additional description was provided by the owner.
                </p>
              </div>
            )}

            <div className="book-details__meta">
              <div className="book-details__meta-row">
                <span className="book-details__meta-label">Shared by</span>
                <span className="book-details__meta-value">
                  {book.ownerName} {isOwner && '(You)'}
                </span>
              </div>
              <div className="book-details__meta-row">
                <span className="book-details__meta-label">Handover Location</span>
                <span className="book-details__meta-value">
                  {book.ownerNeighborhood ? (
                    <span>📍 <strong>{book.ownerNeighborhood}</strong>, Bengaluru</span>
                  ) : (
                    <span>📍 Bengaluru (Location to be coordinated with owner)</span>
                  )}
                </span>
              </div>
              <div className="book-details__meta-row">
                <span className="book-details__meta-label">Genre</span>
                <span className="book-details__meta-value">{book.genre}</span>
              </div>
              <div className="book-details__meta-row">
                <span className="book-details__meta-label">Listed on</span>
                <span className="book-details__meta-value">{formattedDate}</span>
              </div>
              <div className="book-details__meta-row">
                <span className="book-details__meta-label">Availability</span>
                <span className="book-details__meta-value">
                  {book.availability ? 'Available to borrow' : 'Currently loaned out to a reader'}
                </span>
              </div>
            </div>

            <div className="book-details__location-notice" style={{
              margin: 'var(--space-md) 0',
              padding: 'var(--space-sm) var(--space-md)',
              backgroundColor: 'var(--color-ivory)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--border-radius)',
              fontSize: '0.82rem',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'baseline',
              gap: '6px'
            }}>
              <span>ℹ️</span>
              <span>
                <strong>Physical Handover Notice:</strong> Books remain in their owner's neighbourhood ({book.ownerNeighborhood ? `${book.ownerNeighborhood}, Bengaluru` : 'Bengaluru'}). Borrowers must coordinate in-person collection and return at the location specified by the owner. Books are not transferred between neighbourhoods.
              </span>
            </div>

            {/* Circulation Section */}
            <div className="book-details__circulation">
              <div className="book-details__circulation-header">
                <h4 className="book-details__circulation-title">Circulation & Borrowing</h4>
                <p className="book-details__circulation-text">
                  {isOwner
                    ? 'You are the registered owner of this volume in BookLoop.'
                    : book.availability
                    ? `This volume is presently ready for circulation. Connect with ${book.ownerName} to borrow.`
                    : 'This copy is currently checked out by a fellow reader in the community.'}
                </p>
              </div>

              {submitSuccess && (
                <div className="alert alert--success" style={{ margin: 'var(--space-md) 0' }}>
                  {submitSuccess}
                </div>
              )}

              {submitError && (
                <div className="alert alert--error" style={{ margin: 'var(--space-md) 0' }}>
                  {submitError}
                </div>
              )}

              {isOwner ? (
                <div className="book-details__owner-notice">
                  <span className="book-details__owner-notice-title">Volume in Your Collection</span>
                  <p>You listed this book in the community catalogue. You can review reader requests for this book on your <Link to="/lending" style={{ color: 'var(--color-royal-blue)', textDecoration: 'underline' }}>Lending Desk</Link>.</p>
                </div>
              ) : existingUserRequest ? (
                <div className="book-details__user-request-notice">
                  <span className="book-details__user-request-title">
                    Active Request: {existingUserRequest.status}
                    {existingUserRequest.handover?.status === 'Accepted' && ' (Handover Confirmed ✓)'}
                    {existingUserRequest.handover?.status === 'Proposed' && ' (Handover Proposed)'}
                  </span>
                  <p>
                    {existingUserRequest.handover?.status === 'Accepted' ? (
                      <>
                        Handover confirmed for <strong>{new Date(existingUserRequest.handover.proposedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {existingUserRequest.handover.proposedTime}</strong> ({existingUserRequest.handover.instructions}).
                      </>
                    ) : existingUserRequest.handover?.status === 'Proposed' ? (
                      <>
                        {book.ownerName} has proposed a handover date and time. Review and respond on your{' '}
                        <Link to="/borrowings" style={{ color: 'var(--color-royal-blue)', textDecoration: 'underline' }}>
                          My Borrowings
                        </Link>{' '}
                        page.
                      </>
                    ) : (
                      <>
                        You currently have an active {existingUserRequest.status.toLowerCase()} request for this volume.
                        Track its progress on your{' '}
                        <Link to="/borrowings" style={{ color: 'var(--color-royal-blue)', textDecoration: 'underline' }}>
                          My Borrowings
                        </Link>{' '}
                        page.
                      </>
                    )}
                  </p>
                </div>
              ) : !isAuthenticated ? (
                <div className="book-details__auth-prompt">
                  <span className="book-details__auth-prompt-title">Reader Membership Required</span>
                  <p>
                    Borrowing books on BookLoop is community-based. Please{' '}
                    <Link to="/login" state={{ from: location }} className="book-details__auth-link">
                      Sign In
                    </Link>{' '}
                    or{' '}
                    <Link to="/register" className="book-details__auth-link">
                      Register an Account
                    </Link>{' '}
                    to borrow this book from {book.ownerName}.
                  </p>
                </div>
              ) : book.availability ? (
                <div>
                  {!showBorrowForm ? (
                    <button
                      type="button"
                      className="btn book-details__action-btn"
                      onClick={() => setShowBorrowForm(true)}
                    >
                      Request to Borrow This Book
                    </button>
                  ) : (
                    <form className="book-details__borrow-form" onSubmit={handleBorrowSubmit}>
                      <h5 className="book-details__form-title">Submit Borrowing Request</h5>
                      <div className="form-group">
                        <label className="form-label" htmlFor="borrowerNameDisplay">
                          Borrower Name
                        </label>
                        <input
                          id="borrowerNameDisplay"
                          type="text"
                          className="form-input"
                          value={user.name}
                          disabled
                          readOnly
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px', display: 'block' }}>
                          Submitting as {user.name} ({user.email})
                        </span>
                      </div>

                      <div className="form-group">
                        <label className="form-label" htmlFor="notes">
                          Message or Note to Owner (Optional)
                        </label>
                        <textarea
                          id="notes"
                          className="form-textarea"
                          placeholder="Let the owner know when you'd like to pick up or how long you plan to read..."
                          rows="3"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                      </div>

                      <div className="book-details__form-actions">
                        <button
                          type="button"
                          className="btn book-details__cancel-btn"
                          onClick={() => {
                            setShowBorrowForm(false);
                            setSubmitError('');
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn book-details__action-btn"
                          disabled={submitting}
                        >
                          {submitting ? 'Submitting Request...' : 'Send Borrow Request'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : (
                <div className="book-details__unavailable-notice">
                  <span>Loaned Out</span>
                  <p>You can check back once the book is marked as returned by {book.ownerName}.</p>
                </div>
              )}

              {/* Existing active requests on this book */}
              {existingRequests.length > 0 && (
                <div className="book-details__requests-list">
                  <h5 className="book-details__requests-title">Activity on this Title</h5>
                  <div className="book-details__requests-items">
                    {existingRequests.slice(0, 5).map((req) => (
                      <div key={req._id} className="book-details__request-item">
                        <span className="book-details__request-borrower">
                          {req.borrowerName} requested
                        </span>
                        <span className={`badge ${
                          req.status === 'Approved' ? 'badge--available' :
                          req.status === 'Returned' ? 'badge--genre' : 'badge--unavailable'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BookDetailsPage;
