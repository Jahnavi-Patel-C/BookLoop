import api from './api';

/**
 * Fetch all books with optional search, genre, availability, and ownerId filters.
 */
export const getBooks = async ({ search, genre, availability, ownerId } = {}) => {
  const params = {};
  if (search) params.search = search;
  if (genre) params.genre = genre;
  if (availability !== undefined) params.availability = availability;
  if (ownerId) params.ownerId = ownerId;

  const response = await api.get('/books', { params });
  return response.data;
};

/**
 * Fetch a single book by ID.
 */
export const getBook = async (id) => {
  const response = await api.get(`/books/${id}`);
  return response.data;
};

/**
 * Create a new book listing.
 */
export const createBook = async (bookData) => {
  const response = await api.post('/books', bookData);
  return response.data;
};

/**
 * Update an existing book.
 */
export const updateBook = async (id, bookData) => {
  const response = await api.patch(`/books/${id}`, bookData);
  return response.data;
};

/**
 * Delete a book listing.
 */
export const deleteBook = async (id) => {
  const response = await api.delete(`/books/${id}`);
  return response.data;
};

/**
 * Fetch community statistics.
 */
export const getStats = async () => {
  const response = await api.get('/books/stats');
  return response.data;
};

/**
 * Lookup book metadata from Open Library API proxy (no keys required).
 */
export const searchBookMetadata = async (query) => {
  const response = await api.get('/books/lookup', {
    params: { q: query },
  });
  return response.data;
};

/**
 * Backward-compatible alias for book metadata lookup.
 */
export const searchGoogleBooks = searchBookMetadata;
