const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');
const Book = require('../models/Book');

const PLACEHOLDERS = [
  'Downtown', 'North End', 'Westside', 'Midtown', 'University District',
  'Historic Quarter', 'Riverside', 'Greenfield', 'South Hills', 'Waterfront',
  'Suburbs / Greater Area'
];

async function sanitize() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas');

  const resultUsers = await User.updateMany(
    { neighborhood: { $in: PLACEHOLDERS } },
    { $set: { neighborhood: '' } }
  );

  const resultBooks = await Book.updateMany(
    { ownerNeighborhood: { $in: PLACEHOLDERS } },
    { $set: { ownerNeighborhood: '' } }
  );

  console.log(`Sanitized test users with placeholder locations: ${resultUsers.modifiedCount}`);
  console.log(`Sanitized test books with placeholder locations: ${resultBooks.modifiedCount}`);

  await mongoose.disconnect();
  console.log('Finished sanitation cleanly.');
}

sanitize().catch(console.error);

