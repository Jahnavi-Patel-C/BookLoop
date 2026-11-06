const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Book title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    author: {
      type: String,
      required: [true, 'Author name is required'],
      trim: true,
      maxlength: [100, 'Author name cannot exceed 100 characters'],
    },
    genre: {
      type: String,
      required: [true, 'Genre is required'],
      trim: true,
      enum: {
        values: [
          'Fiction',
          'Non-Fiction',
          'Mystery',
          'Science Fiction',
          'Fantasy',
          'Romance',
          'Thriller',
          'Biography',
          'History',
          'Self-Help',
          'Science',
          'Philosophy',
          'Poetry',
          'Drama',
          'Children',
          'Young Adult',
          'Horror',
          'Travel',
          'Cooking',
          'Art',
          'Other',
        ],
        message: '{VALUE} is not a supported genre',
      },
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default: '',
    },
    coverImage: {
      type: String,
      trim: true,
      default: '',
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    ownerName: {
      type: String,
      required: [true, 'Owner display name is required'],
      trim: true,
      maxlength: [50, 'Owner name cannot exceed 50 characters'],
    },
    ownerNeighborhood: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Neighbourhood name cannot exceed 100 characters'],
    },
    availability: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for search and filtering
bookSchema.index({ title: 'text', author: 'text' });
bookSchema.index({ genre: 1 });
bookSchema.index({ availability: 1 });
bookSchema.index({ ownerNeighborhood: 1 });
bookSchema.index({ ownerNeighborhood: 1, availability: 1, createdAt: -1 });
bookSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Book', bookSchema);

