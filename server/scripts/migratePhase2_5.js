const mongoose = require('mongoose');
const Book = require('../models/Book');
const BorrowRequest = require('../models/BorrowRequest');
const CirculationRecord = require('../models/CirculationRecord');
const DevUser = require('../models/DevUser');
const { seedDevUsers, DEMO_USERS } = require('./seedDevUsers');

/**
 * Migration script for Phase 2.5: Multi-User Identity and Ownership.
 * Idempotent: Can be run multiple times safely.
 */
const migratePhase2_5 = async () => {
  console.log('[Migration] Starting Phase 2.5 data migration...');
  console.log('[Migration] Reminder: Ensure a database backup has been taken before running in staging/production.');

  // 1. Ensure demo users exist
  await seedDevUsers();
  const alice = await DevUser.findById(DEMO_USERS[0]._id);
  const bob = await DevUser.findById(DEMO_USERS[1]._id);

  const userMap = {
    alice: alice._id,
    bob: bob._id,
  };

  const report = {
    booksMigrated: 0,
    booksPreservedLegacy: 0,
    requestsMigrated: 0,
    requestsPreservedLegacy: 0,
    circulationMigrated: 0,
    circulationPreservedLegacy: 0,
  };

  // 2. Migrate Books
  const books = await Book.find({});
  for (const book of books) {
    const lowerOwner = (book.ownerName || '').trim().toLowerCase();
    if (userMap[lowerOwner]) {
      book.ownerId = userMap[lowerOwner];
      await book.save();
      report.booksMigrated++;
    } else {
      // Legacy unmapped book: preserve without assigning arbitrary ownerId
      report.booksPreservedLegacy++;
      console.log(`[Migration] Preserved legacy book "${book.title}" by unmapped owner "${book.ownerName}" (${book._id})`);
    }
  }

  // 3. Migrate BorrowRequests
  const requests = await BorrowRequest.find({});
  for (const req of requests) {
    let modified = false;
    const lowerBorrower = (req.borrowerName || '').trim().toLowerCase();
    const lowerOwner = (req.ownerName || '').trim().toLowerCase();

    if (userMap[lowerBorrower] && !req.borrowerId) {
      req.borrowerId = userMap[lowerBorrower];
      modified = true;
    }

    if (userMap[lowerOwner] && !req.ownerId) {
      req.ownerId = userMap[lowerOwner];
      modified = true;
    }

    // Also check if bookId has ownerId resolved
    if (!req.ownerId && req.bookId) {
      const parentBook = await Book.findById(req.bookId);
      if (parentBook && parentBook.ownerId) {
        req.ownerId = parentBook.ownerId;
        modified = true;
      }
    }

    if (modified) {
      await req.save();
      report.requestsMigrated++;
    } else if (!req.borrowerId || !req.ownerId) {
      report.requestsPreservedLegacy++;
      console.log(`[Migration] Preserved legacy request (${req._id}) — borrower: "${req.borrowerName}", owner: "${req.ownerName}"`);
    }
  }

  // 4. Migrate CirculationRecords
  const circRecords = await CirculationRecord.find({});
  for (const circ of circRecords) {
    let modified = false;
    const lowerBorrower = (circ.borrowerName || '').trim().toLowerCase();
    const lowerOwner = (circ.ownerName || '').trim().toLowerCase();

    if (userMap[lowerBorrower] && !circ.borrowerId) {
      circ.borrowerId = userMap[lowerBorrower];
      modified = true;
    }

    if (userMap[lowerOwner] && !circ.ownerId) {
      circ.ownerId = userMap[lowerOwner];
      modified = true;
    }

    if (modified) {
      await circ.save();
      report.circulationMigrated++;
    } else if (!circ.borrowerId || !circ.ownerId) {
      report.circulationPreservedLegacy++;
      console.log(`[Migration] Preserved legacy circulation record (${circ._id}) — book: "${circ.bookTitle}"`);
    }
  }

  console.log('[Migration] Migration completed successfully.');
  console.log('[Migration Report]:', JSON.stringify(report, null, 2));
  return report;
};

if (require.main === module) {
  require('dotenv').config();
  const connectDB = require('../config/db');
  (async () => {
    await connectDB();
    await migratePhase2_5();
    process.exit(0);
  })();
}

module.exports = migratePhase2_5;

