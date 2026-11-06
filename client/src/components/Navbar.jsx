import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import './Navbar.css';

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, isAuthenticated, logout, notificationCount } = useAuth();
  const navigate = useNavigate();

  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const closeMenu = () => setMenuOpen(false);

  const handleLogout = async () => {
    await logout();
    closeMenu();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="container navbar__inner">
        <Link to="/" className="navbar__logo" onClick={closeMenu}>
          Book<em>Loop</em>
          <span className="navbar__logo-dot" aria-hidden="true"></span>
        </Link>

        <div className="navbar__right">
          <button
            className="navbar__toggle"
            onClick={toggleMenu}
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          <ul className={`navbar__links ${menuOpen ? 'navbar__links--open' : ''}`}>
            <li>
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `navbar__link ${isActive ? 'navbar__link--active' : ''}`
                }
                onClick={closeMenu}
                end
              >
                Home
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/explore"
                className={({ isActive }) =>
                  `navbar__link ${isActive ? 'navbar__link--active' : ''}`
                }
                onClick={closeMenu}
              >
                Explore
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/circulation"
                className={({ isActive }) =>
                  `navbar__link ${isActive ? 'navbar__link--active' : ''}`
                }
                onClick={closeMenu}
              >
                Circulation
              </NavLink>
            </li>

            {isAuthenticated && (
              <>
                <li>
                  <NavLink
                    to="/dashboard"
                    className={({ isActive }) =>
                      `navbar__link ${isActive ? 'navbar__link--active' : ''}`
                    }
                    onClick={closeMenu}
                  >
                    Dashboard
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/lending"
                    className={({ isActive }) =>
                      `navbar__link ${isActive ? 'navbar__link--active' : ''}`
                    }
                    onClick={closeMenu}
                  >
                    Lending Desk
                    {notificationCount > 0 && (
                      <span className="navbar__badge" title={`${notificationCount} pending lending requests`}>
                        {notificationCount}
                      </span>
                    )}
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/borrowings"
                    className={({ isActive }) =>
                      `navbar__link ${isActive ? 'navbar__link--active' : ''}`
                    }
                    onClick={closeMenu}
                  >
                    My Borrowings
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/add"
                    className={({ isActive }) =>
                      `navbar__link ${isActive ? 'navbar__link--active' : ''}`
                    }
                    onClick={closeMenu}
                  >
                    Add Book
                  </NavLink>
                </li>
              </>
            )}

            <li className="navbar__cta">
              <Link to="/add" className="btn btn--primary" onClick={closeMenu}>
                Share a Book
              </Link>
            </li>

            {isAuthenticated ? (
              <li className="navbar__auth-group">
                <NotificationBell />
                <Link
                  to="/profile"
                  className="navbar__user-pill"
                  title={`View profile for ${user.email}`}
                  onClick={closeMenu}
                >
                  <span className="navbar__user-avatar">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </span>
                  <span className="navbar__user-name">{user.name}</span>
                </Link>
                <button
                  type="button"
                  className="navbar__auth-btn"
                  onClick={handleLogout}
                >
                  Sign Out
                </button>
              </li>
            ) : (
              <li className="navbar__auth-links">
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    `navbar__link ${isActive ? 'navbar__link--active' : ''}`
                  }
                  onClick={closeMenu}
                >
                  Sign In
                </NavLink>
                <Link
                  to="/register"
                  className="btn navbar__register-btn"
                  onClick={closeMenu}
                >
                  Register
                </Link>
              </li>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
