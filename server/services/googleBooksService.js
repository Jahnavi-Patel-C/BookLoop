/**
 * Google Books API Service
 * Fetches book volume metadata and normalizes fields to match BookLoop's schema:
 * - Sanitizes HTML entities and tags in descriptions
 * - Maps freeform categories to BookLoop's approved genre enum
 * - Enforces HTTPS on cover image URLs and cleans query parameters
 * - Enforces schema length limits safely
 */

const BOOKLOOP_GENRES = [
  'Fiction', 'Non-Fiction', 'Mystery', 'Science Fiction', 'Fantasy',
  'Romance', 'Thriller', 'Biography', 'History', 'Self-Help',
  'Science', 'Philosophy', 'Poetry', 'Drama', 'Children',
  'Young Adult', 'Horror', 'Travel', 'Cooking', 'Art', 'Other',
];

/**
 * Strip HTML tags and decode common HTML entities from descriptions
 */
const sanitizeDescription = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return '';

  let cleaned = rawText
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '') // Strip remaining HTML tags
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();

  // Enforce Mongoose schema limit of 2000 chars safely without cutting mid-sentence if possible
  if (cleaned.length > 1990) {
    cleaned = cleaned.slice(0, 1985).trim() + '...';
  }

  return cleaned;
};

/**
 * Map Google Books categories to BookLoop's approved genre enum
 */
const mapCategoryToGenre = (categories) => {
  if (!categories || !Array.isArray(categories) || categories.length === 0) {
    return 'Other';
  }

  const categoryStr = categories.join(' ').toLowerCase();

  if (categoryStr.includes('young adult') || categoryStr.includes('juvenile fiction')) {
    return 'Young Adult';
  }
  if (categoryStr.includes('children') || categoryStr.includes('juvenile')) {
    return 'Children';
  }
  if (categoryStr.includes('science fiction') || categoryStr.includes('sci-fi')) {
    return 'Science Fiction';
  }
  if (categoryStr.includes('fantasy')) {
    return 'Fantasy';
  }
  if (categoryStr.includes('mystery') || categoryStr.includes('detective') || categoryStr.includes('crime')) {
    return 'Mystery';
  }
  if (categoryStr.includes('romance') || categoryStr.includes('love story')) {
    return 'Romance';
  }
  if (categoryStr.includes('thriller') || categoryStr.includes('suspense')) {
    return 'Thriller';
  }
  if (categoryStr.includes('biography') || categoryStr.includes('autobiography') || categoryStr.includes('memoir')) {
    return 'Biography';
  }
  if (categoryStr.includes('history') || categoryStr.includes('historical')) {
    return 'History';
  }
  if (categoryStr.includes('self-help') || categoryStr.includes('personal development') || categoryStr.includes('psychology')) {
    return 'Self-Help';
  }
  if (categoryStr.includes('computers') || categoryStr.includes('technology') || categoryStr.includes('mathematics') || categoryStr.includes('science')) {
    return 'Science';
  }
  if (categoryStr.includes('philosophy') || categoryStr.includes('ethics')) {
    return 'Philosophy';
  }
  if (categoryStr.includes('poetry') || categoryStr.includes('poems')) {
    return 'Poetry';
  }
  if (categoryStr.includes('drama') || categoryStr.includes('plays') || categoryStr.includes('theater')) {
    return 'Drama';
  }
  if (categoryStr.includes('horror') || categoryStr.includes('ghost')) {
    return 'Horror';
  }
  if (categoryStr.includes('travel') || categoryStr.includes('voyages')) {
    return 'Travel';
  }
  if (categoryStr.includes('cooking') || categoryStr.includes('culinary') || categoryStr.includes('food')) {
    return 'Cooking';
  }
  if (categoryStr.includes('art') || categoryStr.includes('design') || categoryStr.includes('architecture') || categoryStr.includes('photography')) {
    return 'Art';
  }
  if (categoryStr.includes('fiction')) {
    return 'Fiction';
  }
  if (categoryStr.includes('non-fiction') || categoryStr.includes('nonfiction') || categoryStr.includes('essays')) {
    return 'Non-Fiction';
  }

  // Exact match attempt against canonical list
  for (const genre of BOOKLOOP_GENRES) {
    if (categoryStr.includes(genre.toLowerCase())) {
      return genre;
    }
  }

  return 'Other';
};

/**
 * Normalize and secure image URLs from Google Books
 */
const normalizeCoverImage = (imageLinks) => {
  if (!imageLinks) return '';

  let url = imageLinks.thumbnail || imageLinks.smallThumbnail || '';
  if (!url) return '';

  // Google Books often returns http:// URLs; force https:// for mixed-content safety
  url = url.replace(/^http:\/\//i, 'https://');

  // Strip edge curl effect for cleaner display if present
  url = url.replace(/&edge=curl/gi, '');

  return url;
};

/**
 * Normalize a single Google Books volume item into BookLoop schema format
 */
const normalizeVolume = (item) => {
  if (!item || !item.volumeInfo) return null;
  const info = item.volumeInfo;

  // Author list formatting
  let author = 'Unknown Author';
  if (info.authors && Array.isArray(info.authors) && info.authors.length > 0) {
    author = info.authors.join(', ');
    if (author.length > 100) {
      author = author.slice(0, 97) + '...';
    }
  }

  // Title formatting (cap at 200 chars safely)
  let title = info.title || 'Untitled Volume';
  if (info.subtitle) {
    title = `${info.title}: ${info.subtitle}`;
  }
  if (title.length > 200) {
    title = title.slice(0, 197) + '...';
  }

  // ISBN extraction if available
  let isbn = '';
  if (info.industryIdentifiers && Array.isArray(info.industryIdentifiers)) {
    const isbn13 = info.industryIdentifiers.find((id) => id.type === 'ISBN_13');
    const isbn10 = info.industryIdentifiers.find((id) => id.type === 'ISBN_10');
    isbn = (isbn13 || isbn10)?.identifier || '';
  }

  return {
    googleBookId: item.id || '',
    title,
    author,
    genre: mapCategoryToGenre(info.categories),
    rawCategories: info.categories || [],
    description: sanitizeDescription(info.description),
    coverImage: normalizeCoverImage(info.imageLinks),
    publishedDate: info.publishedDate || '',
    pageCount: info.pageCount || null,
    publisher: info.publisher || '',
    isbn,
  };
};

/**
 * Search volumes via Google Books API
 * @param {string} query - Title, author, or ISBN search term
 * @param {number} maxResults - Max items to return (default: 8)
 * @returns {Promise<Array>} Normalized array of book volume candidates
 */
const searchVolumes = async (query, maxResults = 8) => {
  const trimmed = (query || '').trim();
  if (!trimmed) return [];

  // Check if query is an ISBN (10 or 13 digits, optional hyphens)
  const cleanIsbn = trimmed.replace(/[-\s]/g, '');
  const isIsbn = /^\d{9}[\dX]$|^\d{13}$/i.test(cleanIsbn);
  const formattedQuery = isIsbn ? `isbn:${cleanIsbn}` : trimmed;

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY || '';
  let url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(formattedQuery)}&maxResults=${Math.min(maxResults, 12)}&printType=books`;
  if (apiKey) {
    url += `&key=${encodeURIComponent(apiKey)}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000); // 7s timeout

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 429 || res.status === 403) {
        const quotaError = new Error('Google Books API quota reached. Please configure GOOGLE_BOOKS_API_KEY in server/.env or enter book details manually.');
        quotaError.statusCode = 429;
        throw quotaError;
      }
      const apiError = new Error(`Google Books API service error (status ${res.status}). You can enter details manually.`);
      apiError.statusCode = 502;
      throw apiError;
    }

    const data = await res.json();
    if (!data.items || !Array.isArray(data.items)) {
      return [];
    }

    // Normalize each item to BookLoop format
    return data.items
      .filter((item) => item.volumeInfo && item.volumeInfo.title)
      .map(normalizeVolume);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('Google Books search request timed out. Please try again or enter details manually.');
      timeoutErr.statusCode = 504;
      throw timeoutErr;
    }
    throw err;
  }
};

module.exports = {
  searchVolumes,
  normalizeVolume,
  sanitizeDescription,
  mapCategoryToGenre,
  normalizeCoverImage,
  BOOKLOOP_GENRES,
};
