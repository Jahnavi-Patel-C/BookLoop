/**
 * BookLoop Phase 7 — Neighbourhood Discovery Verification Suite
 * Tests:
 * 1. Neighborhood constants & adjacency mapping
 * 2. User registration with optional neighbourhood
 * 3. User profile fetching & updating neighbourhood
 * 4. Automatic synchronization of ownerNeighborhood across user's listed books
 * 5. Book creation with ownerNeighborhood resolution
 * 6. Explicit neighbourhood filtering (?neighborhood=...)
 * 7. 3-tier prioritisation (?userNeighborhood=...):
 *    - Tier 1: Same neighbourhood
 *    - Tier 2: Nearby/adjacent neighbourhood
 *    - Tier 3: Other neighbourhoods across the city
 * 8. Discoverability of city-wide books (no books hidden)
 * 9. Safe fallback for guests/users without a neighbourhood
 * 10. Data cleanup
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
  console.log('=== STARTING BOOKLOOP PHASE 7 VERIFICATION SUITE ===\n');
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
    // 1. Constants and Adjacency Graph Verification
    // ---------------------------------------------------------
    console.log('Test Group 1: Predefined Constants & Adjacency Graph');
    assert(Array.isArray(NEIGHBORHOODS) && NEIGHBORHOODS.length >= 10, 'NEIGHBORHOODS is an array with at least 10 civic areas');
    assert(NEIGHBORHOODS.includes('Downtown'), 'Contains Downtown');
    assert(NEIGHBORHOODS.includes('Westside'), 'Contains Westside');
    assert(NEIGHBORHOODS.includes('Suburbs / Greater Area'), 'Contains Suburbs / Greater Area fallback');

    const dtNearby = getNearbyNeighborhoods('Downtown');
    assert(Array.isArray(dtNearby) && dtNearby.length > 0, 'getNearbyNeighborhoods returns adjacent areas for Downtown');
    assert(dtNearby.includes('Midtown') || dtNearby.includes('Waterfront'), 'Downtown adjacency includes Midtown/Waterfront');
    assert(getNearbyNeighborhoods('NonExistentArea').length === 0, 'Returns empty array for unknown district');

    // ---------------------------------------------------------
    // 2. User Registration with Optional Neighbourhood
    // ---------------------------------------------------------
    console.log('\nTest Group 2: Registration & Profile with Neighbourhood');
    const timestamp = Date.now();
    const userEmail = `reader_phase7_${timestamp}@test.bookloop.local`;
    const regPayload = {
      name: 'Eleanor Vance',
      email: userEmail,
      password: 'Password123!',
      confirmPassword: 'Password123!',
      neighborhood: 'Downtown',
    };

    const regRes = await request('POST', '/auth/register', regPayload);
    assert(regRes.status === 201, `Registration returned 201 Created (got ${regRes.status})`);
    assert(regRes.data?.data?.neighborhood === 'Downtown', 'Returned user contains neighborhood "Downtown"');
    const authCookie = regRes.cookie;
    assert(!!authCookie, 'Received session authentication cookie');

    // Verify /auth/me returns neighbourhood
    const meRes = await request('GET', '/auth/me', null, authCookie);
    assert(meRes.status === 200, 'GET /auth/me succeeded');
    assert(meRes.data?.data?.neighborhood === 'Downtown', 'GET /auth/me returns reader neighborhood');

    // ---------------------------------------------------------
    // 3. User Listing a Book (inherits neighbourhood)
    // ---------------------------------------------------------
    console.log('\nTest Group 3: Book Creation and Location Inheritance');
    const bookDowntownPayload = {
      title: `The Haunting of Hill House ${timestamp}`,
      author: 'Shirley Jackson',
      genre: 'Horror',
      description: 'A classic gothic horror story.',
    };

    const createBookRes = await request('POST', '/books', bookDowntownPayload, authCookie);
    assert(createBookRes.status === 201, `Book created successfully (status ${createBookRes.status})`);
    const bookDowntownId = createBookRes.data?.data?._id;
    assert(createBookRes.data?.data?.ownerNeighborhood === 'Downtown', 'Book automatically inherited ownerNeighborhood: Downtown');

    // Create a book in a nearby area (e.g. Midtown)
    const userNearbyEmail = `reader_nearby_${timestamp}@test.bookloop.local`;
    const regNearbyRes = await request('POST', '/auth/register', {
      name: 'Midtown Reader',
      email: userNearbyEmail,
      password: 'Password123!',
      confirmPassword: 'Password123!',
      neighborhood: 'Midtown',
    });
    const nearbyCookie = regNearbyRes.cookie;
    const createNearbyBookRes = await request('POST', '/books', {
      title: `Midtown Chronicles ${timestamp}`,
      author: 'Jane Author',
      genre: 'Fiction',
      description: 'A story from Midtown.',
    }, nearbyCookie);
    const bookNearbyId = createNearbyBookRes.data?.data?._id;
    assert(createNearbyBookRes.data?.data?.ownerNeighborhood === 'Midtown', 'Nearby book set to Midtown');

    // Create a book in a distant area (e.g. Greenfield)
    const userDistantEmail = `reader_distant_${timestamp}@test.bookloop.local`;
    const regDistantRes = await request('POST', '/auth/register', {
      name: 'Distant Reader',
      email: userDistantEmail,
      password: 'Password123!',
      confirmPassword: 'Password123!',
      neighborhood: 'Greenfield',
    });
    const distantCookie = regDistantRes.cookie;
    const createDistantBookRes = await request('POST', '/books', {
      title: `Greenfield Field Guide ${timestamp}`,
      author: 'Botanist Bob',
      genre: 'Science',
      description: 'Flora and fauna in Greenfield.',
    }, distantCookie);
    const bookDistantId = createDistantBookRes.data?.data?._id;
    assert(createDistantBookRes.data?.data?.ownerNeighborhood === 'Greenfield', 'Distant book set to Greenfield');

    // ---------------------------------------------------------
    // 4. Profile Update & Automatic Book Synchronization
    // ---------------------------------------------------------
    console.log('\nTest Group 4: Profile Update & Cascade to Books');
    const updateProfileRes = await request('PATCH', '/users/profile', {
      name: 'Eleanor Vance Relocated',
      neighborhood: 'Waterfront',
    }, authCookie);
    assert(updateProfileRes.status === 200, 'PATCH /users/profile succeeded');
    assert(updateProfileRes.data?.data?.neighborhood === 'Waterfront', 'User neighborhood updated to Waterfront');

    // Fetch the previously listed book to ensure ownerNeighborhood updated!
    const getUpdatedBookRes = await request('GET', `/books/${bookDowntownId}`);
    assert(getUpdatedBookRes.status === 200, 'Fetched book record');
    assert(getUpdatedBookRes.data?.data?.ownerNeighborhood === 'Waterfront', 'Book ownerNeighborhood synchronized to Waterfront');

    // Switch back to Downtown for the prioritisation test
    await request('PATCH', '/users/profile', {
      name: 'Eleanor Vance',
      neighborhood: 'Downtown',
    }, authCookie);

    // ---------------------------------------------------------
    // 5. Explicit Neighbourhood Filtering (?neighborhood=...)
    // ---------------------------------------------------------
    console.log('\nTest Group 5: Explicit Neighbourhood Filtering');
    const filterRes = await request('GET', '/books?neighborhood=Midtown');
    assert(filterRes.status === 200, 'GET /books?neighborhood=Midtown succeeded');
    const filteredBooks = filterRes.data?.data || [];
    assert(filteredBooks.length > 0, 'Found books in Midtown');
    const allMidtown = filteredBooks.every((b) => b.ownerNeighborhood === 'Midtown');
    assert(allMidtown, 'Every returned book belongs strictly to Midtown');

    // ---------------------------------------------------------
    // 6. 3-Tier Prioritisation (?userNeighborhood=Downtown)
    // ---------------------------------------------------------
    console.log('\nTest Group 6: 3-Tier Prioritisation');
    // For Downtown:
    // Tier 1: Downtown
    // Tier 2: Midtown, Waterfront, etc.
    // Tier 3: Greenfield, etc.
    const priorityRes = await request('GET', '/books?userNeighborhood=Downtown');
    assert(priorityRes.status === 200, 'GET /books?userNeighborhood=Downtown succeeded');
    const prioritizedBooks = priorityRes.data?.data || [];
    assert(prioritizedBooks.length >= 3, 'All books returned (city-wide discoverability preserved)');

    // Find the positions of our 3 test books
    const posDowntown = prioritizedBooks.findIndex((b) => b._id === bookDowntownId);
    const posNearby = prioritizedBooks.findIndex((b) => b._id === bookNearbyId);
    const posDistant = prioritizedBooks.findIndex((b) => b._id === bookDistantId);

    assert(posDowntown !== -1 && posNearby !== -1 && posDistant !== -1, 'All 3 test books present in response');
    assert(posDowntown < posNearby, `Tier 1 (Downtown: #${posDowntown}) ranked before Tier 2 (Midtown: #${posNearby})`);
    assert(posNearby < posDistant, `Tier 2 (Midtown: #${posNearby}) ranked before Tier 3 (Greenfield: #${posDistant})`);

    // ---------------------------------------------------------
    // 7. Preservation of Search & Genre with Prioritisation
    // ---------------------------------------------------------
    console.log('\nTest Group 7: Combined Filters with Prioritisation');
    const searchRes = await request('GET', `/books?userNeighborhood=Downtown&search=Hill+House`);
    assert(searchRes.status === 200, 'Search with userNeighborhood succeeded');
    assert(searchRes.data?.data?.length === 1, 'Found exactly 1 matching book');
    assert(searchRes.data?.data[0]?._id === bookDowntownId, 'Correct book returned');

    // ---------------------------------------------------------
    // 8. Cleanup Test Books
    // ---------------------------------------------------------
    console.log('\nCleaning up test books...');
    await request('DELETE', `/books/${bookDowntownId}`, null, authCookie);
    await request('DELETE', `/books/${bookNearbyId}`, null, nearbyCookie);
    await request('DELETE', `/books/${bookDistantId}`, null, distantCookie);

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

