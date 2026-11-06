import React, { useState, useRef, useEffect } from 'react';
import { useDevUser } from '../context/DevUserContext';
import './UserSwitcher.css';

function UserSwitcher() {
  const { users, currentUser, switchUser } = useDevUser();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!currentUser) return null;

  return (
    <div className="user-switcher" ref={dropdownRef}>
      <button
        type="button"
        className="user-switcher__button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label="Switch active persona"
        title="Switch active user persona"
      >
        <span className="user-switcher__avatar">
          {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
        </span>
        <span className="user-switcher__label">
          <span className="user-switcher__prefix">Active:</span> {currentUser.name}
        </span>
        <span className="user-switcher__caret" aria-hidden="true">▾</span>
      </button>

      {isOpen && (
        <div className="user-switcher__dropdown" role="menu">
          <div className="user-switcher__header">
            <span className="user-switcher__header-title">Switch Persona</span>
            <span className="user-switcher__header-subtitle">Phase 2.5 Multi-User Testing</span>
          </div>
          <ul className="user-switcher__list">
            {users.map((user) => {
              const isSelected = user._id === currentUser._id;
              return (
                <li key={user._id}>
                  <button
                    type="button"
                    className={`user-switcher__item ${isSelected ? 'user-switcher__item--active' : ''}`}
                    onClick={() => {
                      switchUser(user._id);
                      setIsOpen(false);
                    }}
                    role="menuitem"
                  >
                    <span className="user-switcher__item-avatar">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="user-switcher__item-info">
                      <span className="user-switcher__item-name">{user.name}</span>
                      <span className="user-switcher__item-email">{user.email}</span>
                    </div>
                    {isSelected && (
                      <span className="user-switcher__item-check" aria-hidden="true">✓</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default UserSwitcher;

