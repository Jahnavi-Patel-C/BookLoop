const mongoose = require('mongoose');
const DevUser = require('../models/DevUser');

const DEMO_USERS = [
  {
    _id: new mongoose.Types.ObjectId('65f000000000000000000001'),
    name: 'Alice',
    email: 'alice@bookloop.local',
    role: 'Standard demo user',
    isActive: true,
  },
  {
    _id: new mongoose.Types.ObjectId('65f000000000000000000002'),
    name: 'Bob',
    email: 'bob@bookloop.local',
    role: 'Standard demo user',
    isActive: true,
  },
];

/**
 * Idempotently seed development users Alice and Bob.
 */
const seedDevUsers = async () => {
  try {
    const results = [];
    for (const user of DEMO_USERS) {
      const existing = await DevUser.findById(user._id);
      if (!existing) {
        const created = await DevUser.create(user);
        results.push(created);
        console.log(`[Seed] Created DevUser: ${created.name} (${created._id})`);
      } else {
        // Ensure active and accurate name
        existing.name = user.name;
        existing.email = user.email;
        existing.isActive = true;
        await existing.save();
        results.push(existing);
      }
    }
    return results;
  } catch (error) {
    console.error(`[Seed] Error seeding DevUsers: ${error.message}`);
    throw error;
  }
};

// Allow direct CLI execution if run directly
if (require.main === module) {
  require('dotenv').config();
  const connectDB = require('../config/db');
  (async () => {
    await connectDB();
    await seedDevUsers();
    console.log('[Seed] Dev users ready.');
    process.exit(0);
  })();
}

module.exports = {
  seedDevUsers,
  DEMO_USERS,
};

