/**
 * BookLoop Google Books API Integration Test Suite
 * Tests:
 * 1. Endpoint security (requireAuth guard)
 * 2. Query parameter validation
 * 3. Graceful external API quota / 429 handling
 * 4. Metadata normalization unit testing (genre mapping, https covers, HTML stripping, length safety)
 * 5. Full End-to-End Flow: Selection -> POST /api/books -> MongoDB persistence & retrieval
 */

const BASE = 'http://localhost:5000/api';
const {
  normalizeVolume,
  mapCategoryToGenre,
  sanitizeDescription,
  normalizeCoverImage,
  BOOKLOOP_GENRES,
} = require('../services/googleBooksService');

async function request(method, path, body = null, cookie = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) {
    headers['Cookie'] = cookie;
  }

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE}${path}`, options);
  let data = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON response
  }

  let sessionCookie = null;
  const setCookieHeader = res.headers.get('set-cookie');
  if (setCookieHeader) {
    const match = setCookieHeader.match(/token=[^;]+/);
    if (match) sessionCookie = match[0];
  }

  return { status: res.status, ok: res.ok, data, cookie: sessionCookie };
}

async function runTests() {
  console.log('=== STARTING BOOKLOOP GOOGLE BOOKS INTEGRATION TEST SUITE ===\n');
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
    }
  }

  // 1. Auth Guard
  await test('1. Auth Guard: Unauthenticated GET /api/books/google-lookup returns 401', async () => {
    const res = await request('GET', '/books/google-lookup?q=test');
    if (res.status !== 401) {
      throw new Error(`Expected 401, got ${res.status}`);
    }
  });

  // Login as Alice for authenticated tests
  let aliceCookie = null;
  await test('2. Auth: Alice authenticates with demo session', async () => {
    const res = await request('POST', '/auth/login', {
      email: 'alice@bookloop.local',
      password: 'BookLoop2026!',
    });
    if (!res.ok || !res.cookie) {
      throw new Error(`Login failed: ${JSON.stringify(res.data)}`);
    }
    aliceCookie = res.cookie;
  });

  // 3. Query Validation
  await test('3. Validation: Missing query returns 400 with descriptive error', async () => {
    const res = await request('GET', '/books/google-lookup?q=', null, aliceCookie);
    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status}`);
    }
    if (!res.data.error.includes('Search query is required')) {
      throw new Error(`Unexpected error message: ${res.data.error}`);
    }
  });

  // 4. Graceful handling of external API quota (429/403)
  await test('4. Graceful Error Handling: Live query intercepts quota limits or returns results', async () => {
    const res = await request('GET', '/books/google-lookup?q=Virginia+Woolf', null, aliceCookie);
    // If quota exceeded, must return 429 with informative friendly error, NOT unhandled 500
    if (res.status === 429) {
      if (!res.data.error.includes('quota')) {
        throw new Error(`Expected quota explanation, got: ${res.data.error}`);
      }
    } else if (res.status === 200) {
      if (!Array.isArray(res.data.data)) {
        throw new Error('Expected array in data payload');
      }
    } else {
      throw new Error(`Unexpected status code: ${res.status} (${JSON.stringify(res.data)})`);
    }
  });

  // 5. Metadata Normalization & Sanitization Unit Tests
  await test('5. Normalization: Description HTML tags stripped & entities decoded', async () => {
    const rawHtml = '<p>A classic tale of <b>romance</b> &amp; society.<br/>Second line with &quot;quotes&#39;.</p>';
    const cleaned = sanitizeDescription(rawHtml);
    if (cleaned.includes('<p>') || cleaned.includes('<b>') || cleaned.includes('<br/>')) {
      throw new Error(`Failed to strip HTML tags: "${cleaned}"`);
    }
    if (!cleaned.includes('&') || !cleaned.includes('"') || !cleaned.includes("'")) {
      throw new Error(`Failed to decode HTML entities: "${cleaned}"`);
    }
  });

  await test('6. Normalization: Safe length enforcement for descriptions (> 2000 chars)', async () => {
    const hugeText = 'Paragraph of text. '.repeat(150); // ~2850 characters
    const cleaned = sanitizeDescription(hugeText);
    if (cleaned.length > 1995) {
      throw new Error(`Description exceeded Mongoose limit: ${cleaned.length} chars`);
    }
    if (!cleaned.endsWith('...')) {
      throw new Error('Expected truncated description to end with ellipsis');
    }
  });

  await test('7. Normalization: Categories safely mapped to BookLoop approved genre enum', async () => {
    const testCases = [
      { input: ['Juvenile Fiction / Fantasy & Magic'], expected: 'Young Adult' },
      { input: ['Computers / Programming Languages'], expected: 'Science' },
      { input: ['Biography & Autobiography / Presidents'], expected: 'Biography' },
      { input: ['Cooking / Regional & Ethnic / Italian'], expected: 'Cooking' },
      { input: ['Unrecognized Custom Category 12345'], expected: 'Other' },
    ];

    for (const { input, expected } of testCases) {
      const genre = mapCategoryToGenre(input);
      if (genre !== expected) {
        throw new Error(`Category "${input}" mapped to "${genre}", expected "${expected}"`);
      }
      if (!BOOKLOOP_GENRES.includes(genre)) {
        throw new Error(`Mapped genre "${genre}" is not in approved BOOKLOOP_GENRES`);
      }
    }
  });

  await test('8. Normalization: Cover images enforce HTTPS and strip edge curl', async () => {
    const rawUrl = 'http://books.google.com/books/content?id=xyz&printsec=frontcover&edge=curl&source=gbs_api';
    const normalized = normalizeCoverImage({ thumbnail: rawUrl });
    if (!normalized.startsWith('https://')) {
      throw new Error(`Expected https://, got: "${normalized}"`);
    }
    if (normalized.includes('&edge=curl')) {
      throw new Error('Failed to strip &edge=curl query parameter');
    }
  });

  await test('9. Normalization: Full volume parser constructs valid BookLoop schema payload', async () => {
    const rawGoogleItem = {
      id: 'vol_12345',
      volumeInfo: {
        title: 'Mrs Dalloway',
        subtitle: 'The Virginia Woolf Classic',
        authors: ['Virginia Woolf'],
        categories: ['Fiction / Classics'],
        description: '<p>A day in the life of Clarissa Dalloway.</p>',
        imageLinks: {
          thumbnail: 'http://books.google.com/books/content?id=vol_12345&thumbnail=1',
        },
        industryIdentifiers: [
          { type: 'ISBN_13', identifier: '9780156628709' },
        ],
        publishedDate: '1925',
      },
    };

    const parsed = normalizeVolume(rawGoogleItem);
    if (parsed.title !== 'Mrs Dalloway: The Virginia Woolf Classic') {
      throw new Error(`Unexpected title: ${parsed.title}`);
    }
    if (parsed.author !== 'Virginia Woolf') {
      throw new Error(`Unexpected author: ${parsed.author}`);
    }
    if (parsed.genre !== 'Fiction') {
      throw new Error(`Unexpected genre: ${parsed.genre}`);
    }
    if (!parsed.coverImage.startsWith('https://')) {
      throw new Error(`Cover image must be HTTPS: ${parsed.coverImage}`);
    }
    if (parsed.isbn !== '9780156628709') {
      throw new Error(`ISBN mismatch: ${parsed.isbn}`);
    }
  });

  // 10. End-to-End Workflow: Selected metadata is saved through the Share a Book form
  let createdBookId = null;
  await test('10. End-to-End Flow: Save selected Google Books metadata via Add Book form into MongoDB Atlas', async () => {
    const uniqueTitle = `Mrs Dalloway (Google Books Edition ${Date.now()})`;

    // Simulate explicit user submission of the Share a Book form with auto-filled values
    const createRes = await request('POST', '/books', {
      title: uniqueTitle,
      author: 'Virginia Woolf',
      genre: 'Fiction',
      description: 'A day in the life of Clarissa Dalloway in post-World War I England.',
      coverImage: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
      availability: true,
    }, aliceCookie);

    if (createRes.status !== 201) {
      throw new Error(`Failed to create book: HTTP ${createRes.status}: ${JSON.stringify(createRes.data)}`);
    }

    createdBookId = createRes.data.data._id;
    if (createRes.data.data.title !== uniqueTitle) {
      throw new Error('Saved book title mismatch');
    }

    // Verify book is retrieved from MongoDB
    const getRes = await request('GET', `/books/${createdBookId}`);
    if (!getRes.ok) throw new Error('Could not fetch saved book record');
    if (getRes.data.data.author !== 'Virginia Woolf') {
      throw new Error('Author was not persisted correctly');
    }

    // Clean up created test book
    await request('DELETE', `/books/${createdBookId}`, null, aliceCookie);
  });

  console.log(`\n=== RESULTS: ${passed}/${total} GOOGLE BOOKS TESTS PASSED ===\n`);
  if (passed !== total) process.exit(1);
}

runTests();
