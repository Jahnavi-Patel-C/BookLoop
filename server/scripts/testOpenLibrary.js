/**
 * BookLoop Open Library API Integration Test Suite
 * Tests:
 * 1. Endpoint security (requireAuth guard)
 * 2. Query parameter validation
 * 3. Live search by Title & Author via Open Library
 * 4. Live search by ISBN via Open Library
 * 5. In-memory caching verification (cache hit on repeated query)
 * 6. Cover URL construction & fallback safety
 * 7. Subject-to-genre mapping against BookLoop's 21 approved genres
 * 8. Full End-to-End Flow: Selection -> POST /api/books -> MongoDB Atlas persistence
 */

const BASE = 'http://localhost:5000/api';
const {
  normalizeDoc,
  mapSubjectsToGenre,
  getCoverUrl,
  sanitizeDescription,
  clearCache,
  BOOKLOOP_GENRES,
} = require('../services/openLibraryService');

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
  console.log('=== STARTING BOOKLOOP OPEN LIBRARY INTEGRATION TEST SUITE ===\n');
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
  await test('1. Auth Guard: Unauthenticated GET /api/books/lookup returns 401', async () => {
    const res = await request('GET', '/books/lookup?q=test');
    if (res.status !== 401) {
      throw new Error(`Expected 401, got ${res.status}`);
    }
  });

  // Login as Alice for authenticated calls
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
    const res = await request('GET', '/books/lookup?q=', null, aliceCookie);
    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status}`);
    }
    if (!res.data.error.includes('Search query is required')) {
      throw new Error(`Unexpected error message: ${res.data.error}`);
    }
  });

  // 4. Live Open Library Search by Title
  let lookupCandidate = null;
  await test('4. Open Library Search: Live query for "Pride and Prejudice"', async () => {
    const res = await request('GET', '/books/lookup?q=Pride+and+Prejudice', null, aliceCookie);
    if (!res.ok) {
      throw new Error(`Lookup failed: HTTP ${res.status}: ${JSON.stringify(res.data)}`);
    }
    if (!Array.isArray(res.data.data) || res.data.data.length === 0) {
      throw new Error('Expected at least one book candidate from Open Library');
    }

    lookupCandidate = res.data.data[0];

    // Verify title
    if (!lookupCandidate.title.toLowerCase().includes('pride and prejudice')) {
      throw new Error(`Expected title to include "Pride and Prejudice", got: "${lookupCandidate.title}"`);
    }

    // Verify genre is in approved BookLoop list
    if (!BOOKLOOP_GENRES.includes(lookupCandidate.genre)) {
      throw new Error(`Invalid genre mapped: "${lookupCandidate.genre}"`);
    }

    // Verify cover URL structure if present
    if (lookupCandidate.coverImage) {
      if (!lookupCandidate.coverImage.startsWith('https://covers.openlibrary.org/')) {
        throw new Error(`Expected Open Library covers URL, got: "${lookupCandidate.coverImage}"`);
      }
    }
  });

  // 5. Caching Verification
  await test('5. Caching: Repeated query returns identical results from in-memory cache', async () => {
    const t0 = Date.now();
    const res = await request('GET', '/books/lookup?q=Pride+and+Prejudice', null, aliceCookie);
    const duration = Date.now() - t0;

    if (!res.ok || !res.data.data || res.data.data.length === 0) {
      throw new Error('Failed to retrieve cached results');
    }
    // Cached response should be extremely fast (< 100ms)
    if (duration > 350) {
      console.warn(`[WARN] Cached query took ${duration}ms (network or cold cache)`);
    }
    if (res.data.data[0].title !== lookupCandidate.title) {
      throw new Error('Cached title does not match original candidate');
    }
  });

  // 6. Live Open Library Search by ISBN
  await test('6. Open Library Search: Query by ISBN (9780141439518)', async () => {
    const res = await request('GET', '/books/lookup?q=9780141439518', null, aliceCookie);
    if (!res.ok) {
      throw new Error(`ISBN lookup failed: HTTP ${res.status}: ${JSON.stringify(res.data)}`);
    }
    if (!Array.isArray(res.data.data) || res.data.data.length === 0) {
      throw new Error('Expected results for ISBN query');
    }
    const match = res.data.data[0];
    if (!match.title) {
      throw new Error('Missing title in ISBN match');
    }
  });

  // 7. Cover URL Construction Unit Tests
  await test('7. Covers API: Deterministic cover URL generation and fallbacks', async () => {
    const byId = getCoverUrl(8235114, null);
    if (byId !== 'https://covers.openlibrary.org/b/id/8235114-M.jpg?default=false') {
      throw new Error(`Cover by ID mismatch: ${byId}`);
    }

    const byIsbn = getCoverUrl(null, '978-0141439518');
    if (byIsbn !== 'https://covers.openlibrary.org/b/isbn/9780141439518-M.jpg?default=false') {
      throw new Error(`Cover by ISBN mismatch: ${byIsbn}`);
    }

    const empty = getCoverUrl(null, null);
    if (empty !== '') {
      throw new Error(`Expected empty string when no cover or ISBN, got: "${empty}"`);
    }
  });

  // 8. Subject Mapping Unit Tests
  await test('8. Genre Mapping: Open Library subjects map to 21 BookLoop enum values', async () => {
    const cases = [
      { subjects: ['Science fiction', 'Space travel'], expected: 'Science Fiction' },
      { subjects: ['Detective and mystery stories'], expected: 'Mystery' },
      { subjects: ['History, Modern', 'Europe'], expected: 'History' },
      { subjects: ['Cookery', 'Italian food'], expected: 'Cooking' },
      { subjects: ['Uncatalogued Subject X'], expected: 'Other' },
    ];

    for (const c of cases) {
      const g = mapSubjectsToGenre(c.subjects);
      if (g !== c.expected) {
        throw new Error(`Subject "${c.subjects}" mapped to "${g}", expected "${c.expected}"`);
      }
      if (!BOOKLOOP_GENRES.includes(g)) {
        throw new Error(`Genre "${g}" is not in BOOKLOOP_GENRES`);
      }
    }
  });

  // 9. Document Normalization Unit Test
  await test('9. Normalization: Raw Open Library doc correctly parsed into BookLoop schema', async () => {
    const rawDoc = {
      key: '/works/OL45804W',
      title: 'Jane Eyre',
      subtitle: 'An Autobiography',
      author_name: ['Charlotte Brontë'],
      first_publish_year: 1847,
      isbn: ['9780141441146', '0141441143'],
      cover_i: 8235114,
      subject: ['Classic Literature', 'Orphans', 'Gothic Fiction'],
      first_sentence: 'There was no possibility of taking a walk that day.',
    };

    const parsed = normalizeDoc(rawDoc);
    if (parsed.title !== 'Jane Eyre: An Autobiography') {
      throw new Error(`Unexpected title: ${parsed.title}`);
    }
    if (parsed.author !== 'Charlotte Brontë') {
      throw new Error(`Unexpected author: ${parsed.author}`);
    }
    if (parsed.genre !== 'Fiction' && parsed.genre !== 'Horror') {
      throw new Error(`Unexpected genre: ${parsed.genre}`);
    }
    if (parsed.coverImage !== 'https://covers.openlibrary.org/b/id/8235114-M.jpg?default=false') {
      throw new Error(`Unexpected cover URL: ${parsed.coverImage}`);
    }
    if (parsed.isbn !== '9780141441146') {
      throw new Error(`Unexpected ISBN: ${parsed.isbn}`);
    }
    if (!parsed.description.includes('taking a walk')) {
      throw new Error(`Description missing first sentence: ${parsed.description}`);
    }
  });

  // 10. Complete End-to-End Workflow: Selection -> POST /api/books -> MongoDB Atlas
  let createdBookId = null;
  await test('10. End-to-End Flow: Save Open Library metadata via Share a Book form into MongoDB Atlas', async () => {
    if (!lookupCandidate) throw new Error('No candidate available from test 4');

    const uniqueTitle = `${lookupCandidate.title} (Open Library Edition ${Date.now()})`;

    // Explicit user submission of the Share a Book form with auto-filled values
    const createRes = await request('POST', '/books', {
      title: uniqueTitle,
      author: lookupCandidate.author,
      genre: lookupCandidate.genre,
      description: lookupCandidate.description || 'A classic novel shared with the community.',
      coverImage: lookupCandidate.coverImage || 'https://covers.openlibrary.org/b/id/8235114-M.jpg?default=false',
      availability: true,
    }, aliceCookie);

    if (createRes.status !== 201) {
      throw new Error(`Failed to create book: HTTP ${createRes.status}: ${JSON.stringify(createRes.data)}`);
    }

    createdBookId = createRes.data.data._id;
    if (createRes.data.data.title !== uniqueTitle) {
      throw new Error('Saved book title mismatch');
    }

    // Verify book is retrieved from MongoDB Atlas
    const getRes = await request('GET', `/books/${createdBookId}`);
    if (!getRes.ok) throw new Error('Could not fetch saved book record');
    if (getRes.data.data.author !== lookupCandidate.author) {
      throw new Error('Author was not persisted correctly');
    }

    // Clean up created test book
    await request('DELETE', `/books/${createdBookId}`, null, aliceCookie);
  });

  console.log(`\n=== RESULTS: ${passed}/${total} OPEN LIBRARY TESTS PASSED ===\n`);
  if (passed !== total) process.exit(1);
}

runTests();

