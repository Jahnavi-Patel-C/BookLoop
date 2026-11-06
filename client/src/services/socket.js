import { io } from 'socket.io-client';

let socket = null;

/**
 * Get or initialize the Socket.IO client instance.
 * Connects with credentials so session cookies are automatically passed.
 */
export const getSocket = () => {
  if (!socket) {
    const serverUrl = import.meta.env.VITE_SERVER_URL || '/';
    socket = io(serverUrl, {
      withCredentials: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
  }
  return socket;
};

/**
 * Connect socket when user logs in
 */
export const connectSocket = () => {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
};

/**
 * Disconnect socket when user logs out
 */
export const disconnectSocket = () => {
  if (socket && socket.connected) {
    socket.disconnect();
  }
};

