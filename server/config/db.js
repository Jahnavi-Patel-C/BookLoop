const mongoose = require('mongoose');

let mongoServer;

const connectDB = async () => {
  try {
    let uri = process.env.MONGODB_URI;
    const isProd = process.env.NODE_ENV === 'production';
    let useMemoryServer = false;

    if (isProd) {
      if (!uri) {
        throw new Error('MONGODB_URI environment variable is required in production.');
      }
      await mongoose.connect(uri);
      console.log(`[BookLoop] Production MongoDB connected: ${mongoose.connection.host}`);
      return;
    }

    if (uri && !uri.includes('localhost')) {
      // External MongoDB (e.g. Atlas in dev/staging) — connect directly
      await mongoose.connect(uri);
      console.log(`MongoDB connected: ${mongoose.connection.host}`);
      return;
    }

    // Try local MongoDB with a short timeout
    if (uri) {
      try {
        await mongoose.connect(uri, {
          serverSelectionTimeoutMS: 3000,
        });
        console.log(`MongoDB connected: ${mongoose.connection.host}`);
        return;
      } catch {
        console.log('Local MongoDB not available, starting in-memory database...');
        await mongoose.disconnect();
        useMemoryServer = true;
      }
    } else {
      useMemoryServer = true;
    }

    if (useMemoryServer) {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongoServer = await MongoMemoryServer.create();
      uri = mongoServer.getUri();
      console.log('Using in-memory MongoDB for development');
      await mongoose.connect(uri);
      console.log(`MongoDB connected: ${mongoose.connection.host}`);
    }
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  if (mongoServer) {
    await mongoServer.stop();
  }
  await mongoose.connection.close();
  process.exit(0);
});

module.exports = connectDB;
