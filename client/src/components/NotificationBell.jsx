import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './NotificationBell.css';

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const date = new Date(dateString);
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function NotificationBell() {
  const { unreadCount, recentNotifications, markAsRead, markAllAsRead } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      await markAsRead(notification._id);
    }
    setIsOpen(false);

    // Route based on notification context
    if (
      notification.type === 'BORROW_REQUEST_RECEIVED' ||
      notification.type === 'HANDOVER_ACCEPTED' ||
      notification.type === 'HANDOVER_DECLINED'
    ) {
      navigate('/lending');
    } else if (
      notification.type === 'BORROW_REQUEST_APPROVED' ||
      notification.type === 'BORROW_REQUEST_REJECTED' ||
      notification.type === 'DUE_DATE_APPROACHING' ||
      notification.type === 'HANDOVER_PROPOSED'
    ) {
      navigate('/borrowings');
    } else if (notification.relatedBookId) {
      const bookId = notification.relatedBookId._id || notification.relatedBookId;
      navigate(`/books/${bookId}`);
    } else {
      navigate('/notifications');
    }
  };

  return (
    <div className="notif-bell" ref={dropdownRef}>
      <button
        type="button"
        className="notif-bell__trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="View notifications"
        aria-expanded={isOpen}
      >
        <svg
          className="notif-bell__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>

        {unreadCount > 0 && (
          <span className="notif-bell__badge" title={`${unreadCount} unread notifications`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notif-dropdown">
          <div className="notif-dropdown__header">
            <div className="notif-dropdown__title-wrap">
              <span className="notif-dropdown__title">Notifications</span>
              {unreadCount > 0 && (
                <span className="notif-dropdown__count-pill">{unreadCount} unread</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="notif-dropdown__read-all-btn"
                onClick={markAllAsRead}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="notif-dropdown__list">
            {recentNotifications && recentNotifications.length > 0 ? (
              recentNotifications.map((n) => (
                <div
                  key={n._id}
                  className={`notif-item ${!n.isRead ? 'notif-item--unread' : ''}`}
                  onClick={() => handleNotificationClick(n)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="notif-item__indicator">
                    {!n.isRead && <span className="notif-item__unread-dot" />}
                  </div>
                  <div className="notif-item__content">
                    <div className="notif-item__top">
                      <span className="notif-item__type-tag">{n.title}</span>
                      <span className="notif-item__time">
                        {formatRelativeTime(n.createdAt)}
                      </span>
                    </div>
                    <p className="notif-item__message">{n.message}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="notif-dropdown__empty">
                <p>No notifications yet</p>
                <span>All quiet on your library shelf.</span>
              </div>
            )}
          </div>

          <div className="notif-dropdown__footer">
            <Link
              to="/notifications"
              className="notif-dropdown__view-all"
              onClick={() => setIsOpen(false)}
            >
              Open Notification Centre →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;

