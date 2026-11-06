require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const bookRoutes = require('./routes/bookRoutes');
const errorHandler = require('./middleware/errorHandler');
const { initSocket } = require('./services/socketService');
const { startScheduler } = require('./services/reminderScheduler');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize Socket.IO
initSocket(server);

// Connect to MongoDB & run migrations and background schedulers
connectDB().then(async () => {
  try {
    const { seedDevUsers } = require('./scripts/seedDevUsers');
    const migratePhase2_5 = require('./scripts/migratePhase2_5');
    const migratePhase3 = require('./scripts/migratePhase3');
    await seedDevUsers();
    await migratePhase2_5();
    await migratePhase3();
    startScheduler();
  } catch (err) {
    console.error(`[BookLoop] Startup initialization failed: ${err.message}`);
  }
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Authentication session resolution middleware
const { authenticateUser } = require('./middleware/auth');
app.use('/api', authenticateUser);

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/books', bookRoutes);
app.use('/api', require('./routes/circulationRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// Stats route at /api/stats as an alias
app.get('/api/stats', require('./controllers/bookController').getStats);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'BookLoop API is running' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

server.listen(PORT, () => {
  console.log(`BookLoop server running on port ${PORT}`);
});

process.on('unhandledRejection', (reason) => {
  console.error('[BookLoop] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[BookLoop] Uncaught Exception:', err);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[BookLoop] Port ${PORT} is already in use by an active instance or another process.`);
    console.error(`[BookLoop] If BookLoop is already running, you can access it at http://localhost:${PORT}`);
    process.exit(1);
  } else {
    console.error(`[BookLoop] Server startup error:`, err);
    process.exit(1);
  }
});
