import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Loader from '../components/Loader';
import ErrorState from '../components/ErrorState';
import { getUserProfile, updateUserProfile } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { NEIGHBORHOODS } from '../constants/neighborhoods';
import './ProfilePage.css';

function ProfilePage() {
  const { user: authUser, updateUser } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit Name State
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');
  const [nameSuccess, setNameSuccess] = useState('');

  // Edit Neighbourhood State
  const [isEditingNeighborhood, setIsEditingNeighborhood] = useState(false);
  const [neighborhoodInput, setNeighborhoodInput] = useState('');
  const [savingNeighborhood, setSavingNeighborhood] = useState(false);
  const [neighborhoodError, setNeighborhoodError] = useState('');
  const [neighborhoodSuccess, setNeighborhoodSuccess] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState('books');

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getUserProfile();
      setProfileData(res.data);
      setNameInput(res.data.user.name);
      setNeighborhoodInput(res.data.user.neighborhood || '');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSaveName = async (e) => {
    e.preventDefault();
    setNameError('');
    setNameSuccess('');

    if (!nameInput.trim()) {
      setNameError('Name cannot be blank');
      return;
    }
    if (nameInput.trim().length < 2 || nameInput.trim().length > 50) {
      setNameError('Name must be between 2 and 50 characters');
      return;
    }

    setSavingName(true);
    try {
      const res = await updateUserProfile(nameInput.trim());
      setProfileData((prev) => ({
        ...prev,
        user: { ...prev.user, name: res.data.name },
      }));
      setNameSuccess('Display name updated successfully.');
      setIsEditingName(false);
      if (updateUser) {
        updateUser({ name: res.data.name });
      }
      // Reload page state
      fetchProfile();
    } catch (err) {
      setNameError(err.response?.data?.error || err.message || 'Failed to update name');
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveNeighborhood = async (e) => {
    e.preventDefault();
    setNeighborhoodError('');
    setNeighborhoodSuccess('');

    setSavingNeighborhood(true);
    try {
      const res = await updateUserProfile({
        name: profileData.user.name,
        neighborhood: neighborhoodInput,
      });
      setProfileData((prev) => ({
        ...prev,
        user: { ...prev.user, neighborhood: res.data.neighborhood },
      }));
      setNeighborhoodSuccess('Neighbourhood updated successfully.');
      setIsEditingNeighborhood(false);
      if (updateUser) {
        updateUser({ neighborhood: res.data.neighborhood });
      }
      fetchProfile();
    } catch (err) {
      setNeighborhoodError(err.response?.data?.error || err.message || 'Failed to update neighbourhood');
    } finally {
      setSavingNeighborhood(false);
    }
  };

  if (loading) return <Loader message="Accessing reader profile folio..." />;

  if (error) {
    return (
      <div className="profile-page">
        <div className="container">
          <ErrorState title="Profile Error" message={error} onRetry={fetchProfile} />
        </div>
      </div>
    );
  }

  const { user, stats, recentBooks, recentBorrowings, recentLendings } = profileData;

  const memberSince = new Date(user.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="profile-page">
      <div className="profile-page__header">
        <div className="container">
          <div className="profile-card">
            <div className="profile-card__avatar">
              {user.name.charAt(0).toUpperCase()}
            </div>

            <div className="profile-card__info">
              <span className="section-eyebrow">Community Member</span>
              <div className="profile-card__name-row">
                {!isEditingName ? (
                  <>
                    <h1 className="profile-card__name">{user.name}</h1>
                    <button
                      type="button"
                      className="profile-card__edit-btn"
                      onClick={() => setIsEditingName(true)}
                    >
                      Edit Name
                    </button>
                  </>
                ) : (
                  <form className="profile-card__edit-form" onSubmit={handleSaveName}>
                    <input
                      type="text"
                      className="form-input"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="Your full name"
                      autoFocus
                    />
                    <div className="profile-card__edit-actions">
                      <button
                        type="submit"
                        className="btn btn--primary profile-card__save-btn"
                        disabled={savingName}
                      >
                        {savingName ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className="btn profile-card__cancel-btn"
                        onClick={() => {
                          setIsEditingName(false);
                          setNameInput(user.name);
                          setNameError('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {nameError && <p className="form-error" style={{ margin: '4px 0' }}>{nameError}</p>}
              {nameSuccess && <p className="form-success" style={{ margin: '4px 0', color: 'var(--color-olive)' }}>{nameSuccess}</p>}

              {/* Neighbourhood Information */}
              <div className="profile-card__neighborhood-row" style={{ marginTop: '6px', marginBottom: '6px' }}>
                {!isEditingNeighborhood ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.95rem', color: 'var(--color-ink-muted)' }}>
                      📍 <strong>Bengaluru Neighbourhood:</strong> {user.neighborhood ? `${user.neighborhood}, Bengaluru` : <em style={{ color: 'var(--color-ink-subtle)' }}>None selected (All Bengaluru browsing)</em>}
                    </span>
                    <button
                      type="button"
                      className="profile-card__edit-btn"
                      onClick={() => setIsEditingNeighborhood(true)}
                    >
                      {user.neighborhood ? 'Change' : 'Set Bengaluru Neighbourhood'}
                    </button>
                  </div>
                ) : (
                  <form className="profile-card__edit-form" onSubmit={handleSaveNeighborhood} style={{ marginTop: '4px' }}>
                    <select
                      className="form-input"
                      value={neighborhoodInput}
                      onChange={(e) => setNeighborhoodInput(e.target.value)}
                      style={{ maxWidth: '260px', padding: '6px 10px', fontSize: '0.9rem' }}
                    >
                      <option value="">No neighbourhood (All Bengaluru)</option>
                      {NEIGHBORHOODS.map((nh) => (
                        <option key={nh} value={nh}>
                          {nh}
                        </option>
                      ))}
                    </select>
                    <div className="profile-card__edit-actions">
                      <button
                        type="submit"
                        className="btn btn--primary profile-card__save-btn"
                        disabled={savingNeighborhood}
                      >
                        {savingNeighborhood ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className="btn profile-card__cancel-btn"
                        onClick={() => {
                          setIsEditingNeighborhood(false);
                          setNeighborhoodInput(user.neighborhood || '');
                          setNeighborhoodError('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
                {neighborhoodError && <p className="form-error" style={{ margin: '4px 0' }}>{neighborhoodError}</p>}
                {neighborhoodSuccess && <p className="form-success" style={{ margin: '4px 0', color: 'var(--color-olive)' }}>{neighborhoodSuccess}</p>}
              </div>

              <p className="profile-card__email">{user.email}</p>
              <p className="profile-card__meta">
                Reader registered in {memberSince}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="profile-page__body">
        <div className="container">
          {/* Circulation Ledger Summary */}
          <div className="profile-stats">
            <div className="profile-stat-box">
              <span className="profile-stat-box__num">{stats.booksListed}</span>
              <span className="profile-stat-box__label">Books Listed</span>
            </div>
            <div className="profile-stat-box">
              <span className="profile-stat-box__num">{stats.booksBorrowed}</span>
              <span className="profile-stat-box__label">Books Borrowed</span>
            </div>
            <div className="profile-stat-box">
              <span className="profile-stat-box__num">{stats.activeLoans}</span>
              <span className="profile-stat-box__label">Active Loans</span>
            </div>
            <div className="profile-stat-box">
              <span className="profile-stat-box__num">{stats.completedReturns}</span>
              <span className="profile-stat-box__label">Completed Returns</span>
            </div>
          </div>

          {/* Activity Tabs */}
          <div className="profile-tabs">
            <button
              type="button"
              className={`profile-tab ${activeTab === 'books' ? 'profile-tab--active' : ''}`}
              onClick={() => setActiveTab('books')}
            >
              My Books ({recentBooks.length})
            </button>
            <button
              type="button"
              className={`profile-tab ${activeTab === 'borrowing' ? 'profile-tab--active' : ''}`}
              onClick={() => setActiveTab('borrowing')}
            >
              Borrowing History ({recentBorrowings.length})
            </button>
            <button
              type="button"
              className={`profile-tab ${activeTab === 'lending' ? 'profile-tab--active' : ''}`}
              onClick={() => setActiveTab('lending')}
            >
              Lending History ({recentLendings.length})
            </button>
          </div>

          {/* Tab Content */}
          <div className="profile-tab-content">
            {activeTab === 'books' && (
              recentBooks.length > 0 ? (
                <div className="profile-items-list">
                  {recentBooks.map((b) => (
                    <div key={b._id} className="profile-item-row">
                      <div className="profile-item-row__main">
                        <Link to={`/books/${b._id}`} className="profile-item-row__title">
                          {b.title}
                        </Link>
                        <span className="profile-item-row__sub">by {b.author} · {b.genre}</span>
                      </div>
                      <span className={`badge ${b.availability ? 'badge--available' : 'badge--unavailable'}`}>
                        {b.availability ? 'On Shelf' : 'On Loan'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="profile-empty-text">No books listed in your personal collection yet.</p>
              )
            )}

            {activeTab === 'borrowing' && (
              recentBorrowings.length > 0 ? (
                <div className="profile-items-list">
                  {recentBorrowings.map((req) => (
                    <div key={req._id} className="profile-item-row">
                      <div className="profile-item-row__main">
                        <Link to={`/books/${req.bookId?._id || req.bookId}`} className="profile-item-row__title">
                          {req.bookId?.title || 'Volume'}
                        </Link>
                        <span className="profile-item-row__sub">Owner: {req.ownerName}</span>
                      </div>
                      <span className={`badge ${req.status === 'Approved' ? 'badge--available' : req.status === 'Returned' ? 'badge--genre' : 'badge--unavailable'}`}>
                        {req.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="profile-empty-text">No borrowing requests submitted yet.</p>
              )
            )}

            {activeTab === 'lending' && (
              recentLendings.length > 0 ? (
                <div className="profile-items-list">
                  {recentLendings.map((req) => (
                    <div key={req._id} className="profile-item-row">
                      <div className="profile-item-row__main">
                        <Link to={`/books/${req.bookId?._id || req.bookId}`} className="profile-item-row__title">
                          {req.bookId?.title || 'Volume'}
                        </Link>
                        <span className="profile-item-row__sub">Borrower: {req.borrowerName}</span>
                      </div>
                      <span className={`badge ${req.status === 'Approved' ? 'badge--available' : req.status === 'Returned' ? 'badge--genre' : 'badge--unavailable'}`}>
                        {req.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="profile-empty-text">No lending requests received yet.</p>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;

