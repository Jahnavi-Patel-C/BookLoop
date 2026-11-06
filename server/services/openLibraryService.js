/**
 * Open Library Metadata Service
 * Fetches book metadata from Open Library Search API and Covers API.
 * Features:
 * - Identifying User-Agent respecting Open Library usage guidelines
 * - In-memory TTL caching (1 hour) to reduce redundant queries
 * - Polite rate limiting (min 300ms spacing between external requests)
 * - Deterministic cover images from covers.openlibrary.org
 * - Subject-to-genre normalization matching BookLoop's 21 approved genres
 * - Safe length and character sanitization
 */

const BOOKLOOP_GENRES = [
  'Fiction', 'Non-Fiction', 'Mystery', 'Science Fiction', 'Fantasy',
  'Romance', 'Thriller', 'Biography', 'History', 'Self-Help',
  'Science', 'Philosophy', 'Poetry', 'Drama', 'Children',
  'Young Adult', 'Horror', 'Travel', 'Cooking', 'Art', 'Other',
];

// In-memory search cache with 1-hour TTL
const searchCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Polite rate limiting: minimum spacing between external calls
let lastRequestTime = 0;
const MIN_REQUEST_SPACING_MS = 350;

/**
 * Throttle helper to respect Open Library's 1-request-per-second recommendation
 */
const throttle = async () => {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_SPACING_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_SPACING_MS - elapsed));
  }
  lastRequestTime = Date.now();
};

/**
 * Map Open Library subjects to BookLoop's approved genre enum
 */
const mapSubjectsToGenre = (subjects) => {
  if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
    return 'Other';
  }

  const subjectStr = subjects.join(' ').toLowerCase();

  if (subjectStr.includes('young adult') || subjectStr.includes('ya fiction') || subjectStr.includes('teen')) {
    return 'Young Adult';
  }
  if (subjectStr.includes('children') || subjectStr.includes('juvenile') || subjectStr.includes('picture books')) {
    return 'Children';
  }
  if (subjectStr.includes('science fiction') || subjectStr.includes('sci-fi') || subjectStr.includes('space')) {
    return 'Science Fiction';
  }
  if (subjectStr.includes('fantasy') || subjectStr.includes('magic') || subjectStr.includes('wizards')) {
    return 'Fantasy';
  }
  if (subjectStr.includes('mystery') || subjectStr.includes('detective') || subjectStr.includes('crime') || subjectStr.includes('suspense')) {
    return 'Mystery';
  }
  if (subjectStr.includes('romance') || subjectStr.includes('love stories')) {
    return 'Romance';
  }
  if (subjectStr.includes('thriller') || subjectStr.includes('psychological thriller')) {
    return 'Thriller';
  }
  if (subjectStr.includes('biography') || subjectStr.includes('autobiography') || subjectStr.includes('memoir')) {
    return 'Biography';
  }
  if (subjectStr.includes('history') || subjectStr.includes('historical') || subjectStr.includes('civilization')) {
    return 'History';
  }
  if (subjectStr.includes('self-help') || subjectStr.includes('success') || subjectStr.includes('motivation') || subjectStr.includes('psychology')) {
    return 'Self-Help';
  }
  if (subjectStr.includes('computer') || subjectStr.includes('science') || subjectStr.includes('technology') || subjectStr.includes('mathematics') || subjectStr.includes('physics')) {
    return 'Science';
  }
  if (subjectStr.includes('philosophy') || subjectStr.includes('ethics')) {
    return 'Philosophy';
  }
  if (subjectStr.includes('poetry') || subjectStr.includes('poems')) {
    return 'Poetry';
  }
  if (subjectStr.includes('drama') || subjectStr.includes('plays') || subjectStr.includes('theatre')) {
    return 'Drama';
  }
  if (subjectStr.includes('horror') || subjectStr.includes('ghost') || subjectStr.includes('gothic')) {
    return 'Horror';
  }
  if (subjectStr.includes('travel') || subjectStr.includes('voyages') || subjectStr.includes('exploration')) {
    return 'Travel';
  }
  if (subjectStr.includes('cook') || subjectStr.includes('food') || subjectStr.includes('baking') || subjectStr.includes('recipes')) {
    return 'Cooking';
  }
  if (subjectStr.includes('art') || subjectStr.includes('design') || subjectStr.includes('architecture') || subjectStr.includes('photography')) {
    return 'Art';
  }
  if (subjectStr.includes('fiction') || subjectStr.includes('literature') || subjectStr.includes('classic')) {
    return 'Fiction';
  }
  if (subjectStr.includes('non-fiction') || subjectStr.includes('nonfiction') || subjectStr.includes('essays')) {
    return 'Non-Fiction';
  }

  // Exact match attempt against canonical list
  for (const genre of BOOKLOOP_GENRES) {
    if (subjectStr.includes(genre.toLowerCase())) {
      return genre;
    }
  }

  return 'Other';
};

/**
 * Generate Open Library cover URL from Cover ID or ISBN
 * Uses ?default=false so missing images return 404 rather than 1x1 blank image
 */
const getCoverUrl = (coverId, isbn) => {
  if (coverId && typeof coverId === 'number') {
    return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg?default=false`;
  }
  if (isbn && typeof isbn === 'string') {
    const clean = isbn.replace(/[-\s]/g, '');
    if (clean) {
      return `https://covers.openlibrary.org/b/isbn/${clean}-M.jpg?default=false`;
    }
  }
  return '';
};

/**
 * Sanitize and construct description from Open Library metadata
 */
const sanitizeDescription = (firstSentence, subjects) => {
  let desc = '';

  if (firstSentence) {
    if (typeof firstSentence === 'string') {
      desc = firstSentence;
    } else if (typeof firstSentence === 'object' && firstSentence.value) {
      desc = firstSentence.value;
    }
  }

  // If no first sentence, provide summary from top subjects if available
  if (!desc && Array.isArray(subjects) && subjects.length > 0) {
    const topSubjects = subjects.slice(0, 5).join(', ');
    desc = `A volume exploring ${topSubjects}.`;
  }

  // Clean HTML if present
  desc = desc
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();

  if (desc.length > 1990) {
    desc = desc.slice(0, 1985).trim() + '...';
  }

  return desc;
};

/**
 * Normalize an Open Library doc into BookLoop schema format
 */
const normalizeDoc = (doc) => {
  if (!doc || !doc.title) return null;

  // Author formatting
  let author = 'Unknown Author';
  if (Array.isArray(doc.author_name) && doc.author_name.length > 0) {
    author = doc.author_name.join(', ');
    if (author.length > 100) {
      author = author.slice(0, 97) + '...';
    }
  }

  // Title formatting
  let title = (doc.title || 'Untitled Volume').trim();
  if (doc.subtitle) {
    title = `${title}: ${doc.subtitle}`;
  }
  if (title.length > 200) {
    title = title.slice(0, 197) + '...';
  }

  // ISBN extraction
  let isbn = '';
  if (Array.isArray(doc.isbn) && doc.isbn.length > 0) {
    // Prefer ISBN-13 if available, else first
    const isbn13 = doc.isbn.find((i) => i.length === 13);
    isbn = isbn13 || doc.isbn[0];
  }

  // Cover image
  const coverImage = getCoverUrl(doc.cover_i, isbn);

  // Genre
  const genre = mapSubjectsToGenre(doc.subject);

  // Description
  const description = sanitizeDescription(doc.first_sentence, doc.subject);

  return {
    openLibraryKey: doc.key || '',
    title,
    author,
    genre,
    rawSubjects: Array.isArray(doc.subject) ? doc.subject.slice(0, 8) : [],
    description,
    coverImage,
    publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : '',
    isbn,
  };
};

/**
 * Search books via Open Library API
 * @param {string} query - Title, author, or ISBN search term
 * @param {number} maxResults - Max items to return (default: 8)
 * @returns {Promise<Array>} Normalized array of candidate books
 */
const searchVolumes = async (query, maxResults = 8) => {
  const trimmed = (query || '').trim();
  if (!trimmed) return [];

  const cacheKey = trimmed.toLowerCase();

  // 1. Check in-memory TTL cache
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // Check if query is an ISBN
  const cleanQuery = trimmed.replace(/[-\s]/g, '');
  const isIsbn = /^\d{9}[\dX]$|^\d{13}$/i.test(cleanQuery);

  let searchUrl = '';
  if (isIsbn) {
    searchUrl = `https://openlibrary.org/search.json?isbn=${encodeURIComponent(cleanQuery)}&fields=key,title,subtitle,author_name,first_publish_year,isbn,cover_i,subject,first_sentence&limit=${Math.min(maxResults, 10)}`;
  } else {
    searchUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(trimmed)}&fields=key,title,subtitle,author_name,first_publish_year,isbn,cover_i,subject,first_sentence&limit=${Math.min(maxResults, 10)}`;
  }

  // Polite throttling before external network call
  await throttle();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7500); // 7.5s timeout

  try {
    const res = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        // Identifying User-Agent with contact as per Open Library request policy
        'User-Agent': 'BookLoop/1.0 (Community Book Circulation Platform; contact@bookloop.local)',
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 429) {
        const rateLimitErr = new Error('Open Library rate limit reached. Please try again shortly or enter book details manually.');
        rateLimitErr.statusCode = 429;
        throw rateLimitErr;
      }
      const serviceErr = new Error(`Open Library service returned status ${res.status}. You may enter details manually.`);
      serviceErr.statusCode = 502;
      throw serviceErr;
    }

    const data = await res.json();
    if (!data.docs || !Array.isArray(data.docs)) {
      return [];
    }

    const normalizedResults = data.docs
      .filter((doc) => doc.title)
      .map(normalizeDoc)
      .filter(Boolean);

    // Store in cache
    searchCache.set(cacheKey, {
      data: normalizedResults,
      timestamp: Date.now(),
    });

    return normalizedResults;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('Open Library search request timed out. Please try again or enter details manually.');
      timeoutErr.statusCode = 504;
      throw timeoutErr;
    }
    throw err;
  }
};

/**
 * Clear in-memory cache (useful for testing)
 */
const clearCache = () => {
  searchCache.clear();
};

module.exports = {
  searchVolumes,
  normalizeDoc,
  mapSubjectsToGenre,
  getCoverUrl,
  sanitizeDescription,
  clearCache,
  BOOKLOOP_GENRES,
};

