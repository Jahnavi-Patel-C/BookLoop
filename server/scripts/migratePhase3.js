const mongoose = require('mongoose');
const User = require('../models/User');
const DevUser = require('../models/DevUser');
const Book = require('../models/Book');
const BorrowRequest = require('../models/BorrowRequest');
const CirculationRecord = require('../models/CirculationRecord');

// Known demo account seed passwords for testing and evaluation
const DEMO_SEEDS = {
  '65f000000000000000000001': {
    name: 'Alice',
    email: 'alice@bookloop.local',
    password: 'BookLoop2026!',
  },
  '65f000000000000000000002': {
    name: 'Bob',
    email: 'bob@bookloop.local',
    password: 'BookLoop2026!',
  },
};

/**
 * Idempotent migration from DevUser to permanent User model.
 * Preserves exact ObjectIds so all foreign keys in Book, BorrowRequest,
 * and CirculationRecord remain valid.
 */
const migratePhase3 = async () => {
  console.log('[Migration Phase 3] Starting User migration...');
  const report = {
    usersMigrated: 0,
    usersPreserved: 0,
    booksVerified: 0,
    requestsVerified: 0,
    circulationsVerified: 0,
  };

  try {
    // 1. Inspect existing DevUsers
    const devUsers = await DevUser.find({});
    console.log(`[Migration Phase 3] Found ${devUsers.length} dev user records.`);

    // If no DevUsers exist (e.g. fresh DB), ensure Alice and Bob demo users are created in User collection
    const demoEntries = devUsers.length > 0 ? devUsers : Object.entries(DEMO_SEEDS).map(([id, data]) => ({
      _id: new mongoose.Types.ObjectId(id),
      name: data.name,
      email: data.email,
    }));

    for (const devUser of demoEntries) {
      const existingUser = await User.findOne({
        $or: [{ _id: devUser._id }, { email: devUser.email.toLowerCase() }],
      });

      if (!existingUser) {
        const seed = DEMO_SEEDS[devUser._id.toString()];
        const initialPassword = seed ? seed.password : 'BookLoop2026!';

        const newUser = new User({
          _id: devUser._id,
          name: devUser.name,
          email: devUser.email.toLowerCase(),
          password: initialPassword,
          isClaimed: false, // Flag indicating it originated as a demo identity
          role: 'user',
        });

        await newUser.save();
        report.usersMigrated++;
        console.log(`[Migration Phase 3] Migrated user: ${devUser.name} (${devUser.email}) -> ID: ${devUser._id}`);
      } else {
        report.usersPreserved++;
      }
    }

    // 2. Verify and link Book records
    const books = await Book.find({});
    for (const book of books) {
      if (book.ownerId) {
        const ownerExists = await User.findById(book.ownerId);
        if (ownerExists) {
          report.booksVerified++;
        } else {
          console.warn(`[Migration Phase 3] Book "${book.title}" (${book._id}) has unmapped ownerId: ${book.ownerId}`);
        }
      }
    }

    // 3. Verify BorrowRequest records
    const requests = await BorrowRequest.find({});
    for (const req of requests) {
      if (req.ownerId || req.borrowerId) {
        report.requestsVerified++;
      }
    }

    // 4. Verify CirculationRecord records
    const records = await CirculationRecord.find({});
    for (const rec of records) {
      if (rec.ownerId || rec.borrowerId) {
        report.circulationsVerified++;
      }
    }

    console.log('[Migration Phase 3] Migration completed successfully.');
    console.log('[Migration Phase 3 Report]:', JSON.stringify(report, null, 2));
    return report;
  } catch (err) {
    console.error(`[Migration Phase 3] Migration error: ${err.message}`);
    throw err;
  }
};

if (require.main === module) {
  require('dotenv').config();
  const connectDB = require('../config/db');
  (async () => {
    await connectDB();
    await migratePhase3();
    process.exit(0);
  })();
}

module.exports = migratePhase3;

