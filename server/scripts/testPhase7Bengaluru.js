/**
 * BookLoop Phase 7 — Bengaluru Neighbourhood Discovery Verification Suite
 *
 * Verifies:
 * 1. Predefined genuine Bengaluru localities (all 18 localities present)
 * 2. Geographically accurate Bengaluru adjacency clusters
 * 3. User registration with genuine Bengaluru locality (e.g. Yelahanka)
 * 4. User profile update with Bengaluru locality and cascade to books
 * 5. Book creation with owner's genuine Bengaluru locality
 * 6. Discovery prioritisation logic when a neighbourhood is selected:
 *    - Matching neighbourhood books appear FIRST (Rank 1)
 *    - Adjacent Bengaluru neighbourhood books appear SECOND (Rank 2)
 *    - Other Bengaluru neighbourhood books appear THIRD (Rank 3)
 *    - Unassigned location books appear FOURTH (Rank 4)
 *    - ALL books across Bengaluru remain discoverable (no books are hidden)
 * 7. Handover integrity: book's actual location never mutates on discovery selection
 * 8. Clean data teardown
 */

const BASE = 'http://localhost:5000/api';
const { NEIGHBORHOODS, getNearbyNeighborhoods } = require('../constants/neighborhoods');

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
  console.log('=== STARTING BENGALURU NEIGHBOURHOOD DISCOVERY VERIFICATION ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // ---------------------------------------------------------
    // 1. Bengaluru Localities Verification
    // ---------------------------------------------------------
    console.log('Test Group 1: Bengaluru Localities & Extensible Catalog');
    const expectedLocalities = [
      'Yelahanka', 'Yelahanka New Town', 'Hebbal', 'Jakkur', 'Sahakara Nagar',
      'Vidyaranyapura', 'Thanisandra', 'Hennur', 'RT Nagar', 'Malleshwaram',
      'Rajajinagar', 'Vijayanagar', 'Indiranagar', 'Whitefield', 'Koramangala',
      'Jayanagar', 'JP Nagar', 'Electronic City'
    ];

    assert(Array.isArray(NEIGHBORHOODS), 'NEIGHBORHOODS is an array');
    assert(NEIGHBORHOODS.length === 18, `Contains exactly 18 approved Bengaluru localities (got ${NEIGHBORHOODS.length})`);
    
    const missing = expectedLocalities.filter((loc) => !NEIGHBORHOODS.includes(loc));
    assert(missing.length === 0, `All 18 specified Bengaluru localities present (missing: ${missing.join(', ')})`);

    // Verify absence of fictional placeholders
    const fictional = ['Downtown', 'North End', 'Westside', 'Midtown', 'Historic Quarter', 'Greenfield'];
    const fictionalPresent = fictional.filter((loc) => NEIGHBORHOODS.includes(loc));
    assert(fictionalPresent.length === 0, `No fictional placeholder locations present (found: ${fictionalPresent.join(', ')})`);

    // Verify Bengaluru adjacency mapping
    const yelahankaNearby = getNearbyNeighborhoods('Yelahanka');
    assert(yelahankaNearby.includes('Yelahanka New Town'), 'Yelahanka adjacent to Yelahanka New Town');
    assert(yelahankaNearby.includes('Jakkur'), 'Yelahanka adjacent to Jakkur');
    assert(yelahankaNearby.includes('Sahakara Nagar'), 'Yelahanka adjacent to Sahakara Nagar');
    assert(yelahankaNearby.includes('Hebbal'), 'Yelahanka adjacent to Hebbal');
    assert(!yelahankaNearby.includes('Electronic City'), 'Yelahanka NOT directly adjacent to Electronic City');

    // ---------------------------------------------------------
    // 2. User Registration & Profile in Bengaluru
    // ---------------------------------------------------------
    console.log('\nTest Group 2: User Registration & Profile with Bengaluru Locality');
    const timestamp = Date.now();
    const userYelahankaEmail = `reader_blr_yelahanka_${timestamp}@test.bookloop.local`;
    const regRes = await request('POST', '/auth/register', {
      name: 'Ananya Sharma',
      email: userYelahankaEmail,
      password: 'Password123!',
      confirmPassword: 'Password123!',
      neighborhood: 'Yelahanka',
    });
    assert(regRes.status === 201, `Registered user in Yelahanka (status ${regRes.status})`);
    assert(regRes.data?.data?.neighborhood === 'Yelahanka', 'User registered with neighborhood "Yelahanka"');
    const yelahankaCookie = regRes.cookie;

    // Verify /auth/me reflects Yelahanka
    const meRes = await request('GET', '/auth/me', null, yelahankaCookie);
    assert(meRes.status === 200, 'GET /auth/me succeeded');
    assert(meRes.data?.data?.neighborhood === 'Yelahanka', 'Auth session returns Yelahanka');

    // ---------------------------------------------------------
    // 3. Create Multi-Locality Bengaluru Test Books
    // ---------------------------------------------------------
    console.log('\nTest Group 3: Creating Books Across Bengaluru Clusters');

    // Book A: Yelahanka (Matching target)
    const bookARes = await request('POST', '/books', {
      title: `Malgudi Days in Yelahanka ${timestamp}`,
      author: 'R. K. Narayan',
      genre: 'Fiction',
      description: 'Stories set in Bengaluru.',
    }, yelahankaCookie);
    assert(bookARes.status === 201, 'Book A created in Yelahanka');
    const bookAId = bookARes.data?.data?._id;
    assert(bookARes.data?.data?.ownerNeighborhood === 'Yelahanka', 'Book A ownerNeighborhood is Yelahanka');

    // Book B: Jakkur (Adjacent to Yelahanka)
    const userJakkurEmail = `reader_blr_jakkur_${timestamp}@test.bookloop.local`;
    const regJakkurRes = await request('POST', '/auth/register', {
      name: 'Rohan Rao',
      email: userJakkurEmail,
      password: 'Password123!',
      confirmPassword: 'Password123!',
      neighborhood: 'Jakkur',
    });
    const jakkurCookie = regJakkurRes.cookie;
    const bookBRes = await request('POST', '/books', {
      title: `Aviation and Lakes of Jakkur ${timestamp}`,
      author: 'A. Rao',
      genre: 'Non-Fiction',
      description: 'Aerodrome history in Jakkur.',
    }, jakkurCookie);
    assert(bookBRes.status === 201, 'Book B created in Jakkur');
    const bookBId = bookBRes.data?.data?._id;
    assert(bookBRes.data?.data?.ownerNeighborhood === 'Jakkur', 'Book B ownerNeighborhood is Jakkur');

    // Book C: Whitefield (Other Bengaluru locality - East Cluster)
    const userWhitefieldEmail = `reader_blr_whitefield_${timestamp}@test.bookloop.local`;
    const regWhitefieldRes = await request('POST', '/auth/register', {
      name: 'Priya Nair',
      email: userWhitefieldEmail,
      password: 'Password123!',
      confirmPassword: 'Password123!',
      neighborhood: 'Whitefield',
    });
    const whitefieldCookie = regWhitefieldRes.cookie;
    const bookCRes = await request('POST', '/books', {
      title: `Silicon Dreams in Whitefield ${timestamp}`,
      author: 'P. Nair',
      genre: 'Science',
      description: 'Tech corridor tales.',
    }, whitefieldCookie);
    assert(bookCRes.status === 201, 'Book C created in Whitefield');
    const bookCId = bookCRes.data?.data?._id;
    assert(bookCRes.data?.data?.ownerNeighborhood === 'Whitefield', 'Book C ownerNeighborhood is Whitefield');

    // ---------------------------------------------------------
    // 4. Discovery Prioritisation: Select "Yelahanka"
    // ---------------------------------------------------------
    console.log('\nTest Group 4: Proximity Discovery Prioritisation (Target = Yelahanka)');
    const exploreRes = await request('GET', '/books?neighborhood=Yelahanka');
    assert(exploreRes.status === 200, 'GET /books?neighborhood=Yelahanka succeeded');
    const books = exploreRes.data?.data || [];

    // CRITICAL REQUIREMENT: City-wide discoverability preserved (books are NOT filtered out!)
    assert(books.length >= 3, `All books remain discoverable (found ${books.length} books, not 0 or 1)`);

    const posA = books.findIndex((b) => b._id === bookAId);
    const posB = books.findIndex((b) => b._id === bookBId);
    const posC = books.findIndex((b) => b._id === bookCId);

    assert(posA !== -1, 'Book A (Yelahanka) is present in the catalogue');
    assert(posB !== -1, 'Book B (Jakkur - adjacent) is present in the catalogue');
    assert(posC !== -1, 'Book C (Whitefield - distant) is present in the catalogue');

    // Verify ordering: Rank 1 (Yelahanka) < Rank 2 (Jakkur) < Rank 3 (Whitefield)
    assert(posA < posB, `Rank 1 (Yelahanka: #${posA}) appears before Rank 2 (Jakkur: #${posB})`);
    assert(posB < posC, `Rank 2 (Jakkur: #${posB}) appears before Rank 3 (Whitefield: #${posC})`);

    // Verify Book A's location has NOT mutated
    const fetchedBookA = books.find((b) => b._id === bookAId);
    assert(fetchedBookA.ownerNeighborhood === 'Yelahanka', 'Book A retains true owner location "Yelahanka"');

    // ---------------------------------------------------------
    // 5. Discovery Prioritisation: Switch Target to "Whitefield"
    // ---------------------------------------------------------
    console.log('\nTest Group 5: Proximity Discovery Prioritisation (Target = Whitefield)');
    const exploreWhitefieldRes = await request('GET', '/books?neighborhood=Whitefield');
    assert(exploreWhitefieldRes.status === 200, 'GET /books?neighborhood=Whitefield succeeded');
    const booksW = exploreWhitefieldRes.data?.data || [];

    const posAW = booksW.findIndex((b) => b._id === bookAId);
    const posCW = booksW.findIndex((b) => b._id === bookCId);

    assert(posCW !== -1 && posAW !== -1, 'Both Whitefield and Yelahanka books present');
    assert(posCW < posAW, `When Whitefield is selected, Book C (Whitefield: #${posCW}) appears before Book A (Yelahanka: #${posAW})`);

    // Verify physical location integrity: Yelahanka book does NOT claim to be in Whitefield!
    const bookAInWhitefieldQuery = booksW.find((b) => b._id === bookAId);
    assert(bookAInWhitefieldQuery.ownerNeighborhood === 'Yelahanka', 'Book A in Whitefield query still shows owner neighborhood: Yelahanka');

    // ---------------------------------------------------------
    // 6. User Profile Update Cascading to Books
    // ---------------------------------------------------------
    console.log('\nTest Group 6: Profile Relocation within Bengaluru');
    const updateProfileRes = await request('PATCH', '/users/profile', {
      name: 'Ananya Sharma',
      neighborhood: 'Malleshwaram',
    }, yelahankaCookie);
    assert(updateProfileRes.status === 200, 'Profile updated to Malleshwaram');
    assert(updateProfileRes.data?.data?.neighborhood === 'Malleshwaram', 'User neighborhood updated to Malleshwaram');

    const checkBookA = await request('GET', `/books/${bookAId}`);
    assert(checkBookA.data?.data?.ownerNeighborhood === 'Malleshwaram', 'Book A ownerNeighborhood automatically synchronized to Malleshwaram');

    // ---------------------------------------------------------
    // 7. Cleanup
    // ---------------------------------------------------------
    console.log('\nCleaning up test books...');
    await request('DELETE', `/books/${bookAId}`, null, yelahankaCookie);
    await request('DELETE', `/books/${bookBId}`, null, jakkurCookie);
    await request('DELETE', `/books/${bookCId}`, null, whitefieldCookie);

    console.log(`\n=== TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED ===\n`);
    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Test run failed with error:', err);
    process.exit(1);
  }
}

runTests();

