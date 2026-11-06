import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/notificationService';
import { useAuth } from '../context/AuthContext';
import './NotificationsPage.css';

function formatDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function NotificationsPage() {
  const { refreshNotifications } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterUnread, setFilterUnread] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const navigate = useNavigate();

  const fetchNotifs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getNotifications({ unreadOnly: filterUnread, limit: 100 });
      setNotifications(res.data || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [filterUnread]);

  useEffect(() => {
    fetchNotifs();
  }, [fetchNotifs]);

  const handleMarkOne = async (id, e) => {
    e.stopPropagation();
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      refreshNotifications();
    } catch (err) {
      console.warn('Failed to mark read', err);
    }
  };

  const handleMarkAll = async () => {
    setActionLoading(true);
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      refreshNotifications();
    } catch (err) {
      console.warn('Failed to mark all read', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleItemClick = async (n) => {
    if (!n.isRead) {
      await markNotificationRead(n._id);
      refreshNotifications();
    }
    if (
      n.type === 'BORROW_REQUEST_RECEIVED' ||
      n.type === 'HANDOVER_ACCEPTED' ||
      n.type === 'HANDOVER_DECLINED'
    ) {
      navigate('/lending');
    } else if (
      n.type === 'BORROW_REQUEST_APPROVED' ||
      n.type === 'BORROW_REQUEST_REJECTED' ||
      n.type === 'DUE_DATE_APPROACHING' ||
      n.type === 'HANDOVER_PROPOSED'
    ) {
      navigate('/borrowings');
    } else if (n.relatedBookId) {
      const bookId = n.relatedBookId._id || n.relatedBookId;
      navigate(`/books/${bookId}`);
    }
  };

  const unreadTotal = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="notif-page">
      <div className="notif-page__header">
        <div className="container">
          <span className="section-eyebrow">Reader Desk</span>
          <h1 className="notif-page__title">Notification Centre</h1>
          <p className="notif-page__subtitle">
            Chronological log of borrowing requests, approvals, returns, and library circulation reminders.
          </p>

          <div className="notif-page__controls">
            <div className="notif-page__tabs">
              <button
                type="button"
                className={`btn notif-page__tab ${!filterUnread ? 'notif-page__tab--active' : ''}`}
                onClick={() => setFilterUnread(false)}
              >
                All Notifications
              </button>
              <button
                type="button"
                className={`btn notif-page__tab ${filterUnread ? 'notif-page__tab--active' : ''}`}
                onClick={() => setFilterUnread(true)}
              >
                Unread Only {unreadTotal > 0 && `(${unreadTotal})`}
              </button>
            </div>

            {unreadTotal > 0 && (
              <button
                type="button"
                className="btn notif-page__action-btn"
                onClick={handleMarkAll}
                disabled={actionLoading}
              >
                Mark All as Read
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="notif-page__body">
        <div className="container">
          {loading ? (
            <Loader message="Loading notification log..." />
          ) : error ? (
            <ErrorState title="Could not load notifications" message={error} onRetry={fetchNotifs} />
          ) : notifications.length === 0 ? (
            <EmptyState
              title={filterUnread ? 'No unread notifications' : 'Your notification log is clear'}
              message={
                filterUnread
                  ? 'All notifications have been reviewed. Switch to "All Notifications" to view your historical log.'
                  : 'You have no circulation notices at this time. Activity on your books and loans will appear here.'
              }
              actionLabel="View Catalogue"
              onAction={() => navigate('/explore')}
            />
          ) : (
            <div className="notif-list">
              {notifications.map((n) => (
                <div
                  key={n._id}
                  className={`notif-card ${!n.isRead ? 'notif-card--unread' : ''}`}
                  onClick={() => handleItemClick(n)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="notif-card__status">
                    {!n.isRead ? (
                      <span className="notif-card__dot" title="Unread" />
                    ) : (
                      <span className="notif-card__read-check">✓</span>
                    )}
                  </div>

                  <div className="notif-card__content">
                    <div className="notif-card__meta">
                      <span className="notif-card__type">{n.title}</span>
                      <span className="notif-card__time">{formatDate(n.createdAt)}</span>
                    </div>

                    <p className="notif-card__message">{n.message}</p>

                    <div className="notif-card__footer">
                      {n.relatedBookId && (
                        <span className="notif-card__link-hint">
                          Associated volume: <strong>{n.relatedBookId.title || 'View record'}</strong> →
                        </span>
                      )}

                      {!n.isRead && (
                        <button
                          type="button"
                          className="notif-card__mark-btn"
                          onClick={(e) => handleMarkOne(n._id, e)}
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NotificationsPage;

