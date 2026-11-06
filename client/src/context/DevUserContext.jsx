import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getDevUsers, getNotificationCount } from '../services/devUserService';

const DevUserContext = createContext(null);

const STORAGE_KEY = 'bookloop_dev_user_id';

export const DevUserProvider = ({ children }) => {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const activeUserIdRef = useRef(null);

  // Keep ref synchronized with current user id
  useEffect(() => {
    activeUserIdRef.current = currentUser?._id || null;
  }, [currentUser]);

  // Refresh notification count for current user
  const refreshNotifications = useCallback(async () => {
    if (!activeUserIdRef.current) {
      setNotificationCount(0);
      return;
    }
    try {
      const res = await getNotificationCount();
      if (res && res.success && res.data) {
        setNotificationCount(res.data.pendingLendingRequests || 0);
      }
    } catch (err) {
      console.warn('[BookLoop] Failed to fetch notification count:', err);
    }
  }, []);

  // Switch persona
  const switchUser = useCallback((userId) => {
    const selected = users.find((u) => u._id === userId);
    if (selected) {
      localStorage.setItem(STORAGE_KEY, selected._id);
      activeUserIdRef.current = selected._id;
      setCurrentUser(selected);
      // Immediately refresh notifications for the new persona
      refreshNotifications();
    }
  }, [users, refreshNotifications]);

  // Initial load of dev users
  useEffect(() => {
    let mounted = true;

    const initUsers = async () => {
      try {
        const res = await getDevUsers();
        if (mounted && res && res.success && res.data && res.data.length > 0) {
          const devUsers = res.data;
          setUsers(devUsers);

          const storedId = localStorage.getItem(STORAGE_KEY);
          const matched = devUsers.find((u) => u._id === storedId);
          const activeUser = matched || devUsers[0]; // Default to Alice

          localStorage.setItem(STORAGE_KEY, activeUser._id);
          activeUserIdRef.current = activeUser._id;
          setCurrentUser(activeUser);
        }
      } catch (err) {
        console.error('[BookLoop] Failed to load dev users:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initUsers();

    return () => {
      mounted = false;
    };
  }, []);

  // After currentUser is loaded or changed, trigger initial notification fetch and set up polling
  useEffect(() => {
    if (!currentUser) return;

    refreshNotifications();

    // Poll every 30 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshNotifications();
      }
    }, 30000);

    // Refresh when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshNotifications();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser, refreshNotifications]);

  const value = {
    users,
    currentUser,
    loading,
    notificationCount,
    switchUser,
    refreshNotifications,
  };

  return (
    <DevUserContext.Provider value={value}>
      {children}
    </DevUserContext.Provider>
  );
};

export const useDevUser = () => {
  const context = useContext(DevUserContext);
  if (!context) {
    throw new Error('useDevUser must be used within a DevUserProvider');
  }
  return context;
};

