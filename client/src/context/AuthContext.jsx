import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  getCurrentUser,
  loginUser,
  registerUser,
  logoutUser,
} from '../services/authService';
import {
  getNotificationCount,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/notificationService';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const activeUserIdRef = useRef(null);

  useEffect(() => {
    activeUserIdRef.current = user?._id || null;
  }, [user]);

  // Refresh notification count and recent list
  const refreshNotifications = useCallback(async () => {
    if (!activeUserIdRef.current) {
      setUnreadCount(0);
      setRecentNotifications([]);
      return;
    }
    try {
      const [countRes, listRes] = await Promise.all([
        getNotificationCount(),
        getNotifications({ limit: 8 }),
      ]);

      if (countRes && countRes.success && countRes.data) {
        setUnreadCount(countRes.data.unreadCount ?? countRes.data.pendingLendingRequests ?? 0);
      }
      if (listRes && listRes.success && listRes.data) {
        setRecentNotifications(listRes.data || []);
      }
    } catch (err) {
      // If unauthorized or network error, silently ignore
    }
  }, []);

  // Mark single notification as read
  const markAsRead = useCallback(async (id) => {
    try {
      await markNotificationRead(id);
      setRecentNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(prev - 1, 0));
    } catch (err) {
      console.warn('[BookLoop] Failed to mark notification read:', err);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      setRecentNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.warn('[BookLoop] Failed to mark all notifications read:', err);
    }
  }, []);

  // Initial session check on mount
  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        const res = await getCurrentUser();
        if (mounted && res && res.success && res.data) {
          setUser(res.data);
          activeUserIdRef.current = res.data._id;
        } else if (mounted) {
          setUser(null);
        }
      } catch (err) {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  // Socket connection & notification synchronization
  useEffect(() => {
    if (!user) {
      disconnectSocket();
      setUnreadCount(0);
      setRecentNotifications([]);
      return;
    }

    // Connect socket for real-time delivery
    const socket = connectSocket();

    // Initial notification fetch
    refreshNotifications();

    // Listen for incoming real-time notifications
    const handleNewNotification = (notification) => {
      setRecentNotifications((prev) => [notification, ...prev.slice(0, 7)]);
      setUnreadCount((prev) => prev + 1);
    };

    // Listen for direct unread count updates
    const handleCountUpdate = ({ unreadCount: count }) => {
      setUnreadCount(count);
    };

    // On socket reconnect, catch up on any missed notifications
    const handleReconnect = () => {
      refreshNotifications();
    };

    socket.on('notification:new', handleNewNotification);
    socket.on('notification:count', handleCountUpdate);
    socket.on('connect', handleReconnect);

    // Fallback polling every 30s + visibilitychange
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshNotifications();
      }
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshNotifications();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('notification:count', handleCountUpdate);
      socket.off('connect', handleReconnect);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, refreshNotifications]);

  // Sign In action
  const login = async (email, password) => {
    const res = await loginUser({ email, password });
    if (res && res.success && res.data) {
      setUser(res.data);
      activeUserIdRef.current = res.data._id;
      connectSocket();
      refreshNotifications();
    }
    return res;
  };

  // Register action
  const register = async (userData) => {
    const res = await registerUser(userData);
    if (res && res.success && res.data) {
      setUser(res.data);
      activeUserIdRef.current = res.data._id;
      connectSocket();
      setUnreadCount(0);
      setRecentNotifications([]);
    }
    return res;
  };

  // Sign Out action
  const logout = async () => {
    try {
      disconnectSocket();
      await logoutUser();
    } catch (err) {
      console.warn('[BookLoop] Logout request error:', err);
    } finally {
      setUser(null);
      activeUserIdRef.current = null;
      setUnreadCount(0);
      setRecentNotifications([]);
    }
  };

  // Synchronize local user object with updated profile data
  const updateUser = useCallback((updatedData) => {
    setUser((prev) => (prev ? { ...prev, ...updatedData } : updatedData));
  }, []);

  const value = {
    user,
    currentUser: user, // Backward compatibility alias
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    updateUser,
    unreadCount,
    notificationCount: unreadCount, // Backward compatibility alias
    recentNotifications,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Backward compatibility alias
export const useDevUser = useAuth;
