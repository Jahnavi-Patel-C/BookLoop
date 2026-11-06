const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'bookloop_jwt_secret_editorial_2026_secure_key';

let io = null;

/**
 * Initialize Socket.IO with HTTP server and authentication middleware
 */
const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  // Authentication middleware for socket connections
  io.use((socket, next) => {
    try {
      let token = null;

      // 1. Try extracting from cookies in handshake headers
      const cookieHeader = socket.handshake.headers.cookie;
      if (cookieHeader) {
        const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
        if (match) {
          token = decodeURIComponent(match[1]);
        }
      }

      // 2. Try auth payload
      if (!token && socket.handshake.auth && socket.handshake.auth.token) {
        token = socket.handshake.auth.token;
      }

      if (!token) {
        return next(new Error('Authentication required for socket connection'));
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      if (!decoded || !decoded.id) {
        return next(new Error('Invalid socket authentication token'));
      }

      socket.userId = decoded.id.toString();
      next();
    } catch (err) {
      next(new Error('Socket authentication failed: ' + err.message));
    }
  });

  io.on('connection', (socket) => {
    // Join personal room for private notification delivery
    const roomName = `user_${socket.userId}`;
    socket.join(roomName);

    socket.on('disconnect', () => {
      socket.leave(roomName);
    });
  });

  return io;
};

/**
 * Emit an event to a specific user's private room
 */
const emitToUser = (userId, event, data) => {
  if (io && userId) {
    const roomName = `user_${userId.toString()}`;
    io.to(roomName).emit(event, data);
  }
};

/**
 * Get active io instance
 */
const getIO = () => io;

module.exports = {
  initSocket,
  emitToUser,
  getIO,
};

