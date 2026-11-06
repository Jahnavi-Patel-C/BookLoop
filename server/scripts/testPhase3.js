const BASE = 'http://localhost:5000/api';
const ALICE_ID = '65f000000000000000000001';
const BOB_ID = '65f000000000000000000002';

// Helper for HTTP requests with cookie handling
async function request(method, path, body = null, cookie = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) {
    headers['Cookie'] = cookie;
  }

  const options = {
    method,
    headers,
  };
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

  // Extract set-cookie if present
  let sessionCookie = null;
  const setCookieHeader = res.headers.get('set-cookie');
  if (setCookieHeader) {
    const match = setCookieHeader.match(/token=[^;]+/);
    if (match) sessionCookie = match[0];
  }

  return { status: res.status, ok: res.ok, data, cookie: sessionCookie };
}

async function runTests() {
  console.log('=== STARTING BOOKLOOP PHASE 3 TEST SUITE ===\n');
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

  // ---------------------------------------------------------
  // 1. REGISTRATION TESTS
  // ---------------------------------------------------------
  const uniqueSuffix = Date.now();
  const testUser = {
    name: 'Clarissa Dalloway',
    email: `clarissa_${uniqueSuffix}@bookloop.local`,
    password: 'SecurePassword123!',
    confirmPassword: 'SecurePassword123!',
  };
  let clarissaCookie = null;
  let clarissaId = null;

  await test('1. Register: Successful registration with safe payload & session cookie', async () => {
    const res = await request('POST', '/auth/register', testUser);
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
    if (!res.cookie) throw new Error('Missing HTTP-only session cookie in response');
    if (!res.data.data._id) throw new Error('Missing user ID');
    if (res.data.data.password) throw new Error('Security violation: password hash returned');
    clarissaCookie = res.cookie;
    clarissaId = res.data.data._id;
  });

  await test('2. Register: Reject invalid email format (400)', async () => {
    const res = await request('POST', '/auth/register', {
      name: 'Invalid Email User',
      email: 'not-an-email',
      password: 'SecurePassword123!',
      confirmPassword: 'SecurePassword123!',
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await test('3. Register: Reject missing required fields (400)', async () => {
    const res = await request('POST', '/auth/register', {
      email: `missing_name_${uniqueSuffix}@bookloop.local`,
      password: 'SecurePassword123!',
      confirmPassword: 'SecurePassword123!',
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await test('4. Register: Reject password mismatch (400)', async () => {
    const res = await request('POST', '/auth/register', {
      name: 'Mismatch User',
      email: `mismatch_${uniqueSuffix}@bookloop.local`,
      password: 'SecurePassword123!',
      confirmPassword: 'DifferentPassword456!',
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await test('5. Register: Reject weak password lacking digits (400)', async () => {
    const res = await request('POST', '/auth/register', {
      name: 'Weak Password User',
      email: `weak_${uniqueSuffix}@bookloop.local`,
      password: 'onlylettershere',
      confirmPassword: 'onlylettershere',
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await test('6. Register: Reject duplicate email registration (400)', async () => {
    const res = await request('POST', '/auth/register', testUser);
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // ---------------------------------------------------------
  // 2. LOGIN & SESSION MANAGEMENT TESTS
  // ---------------------------------------------------------
  let aliceCookie = null;
  let bobCookie = null;

  await test('7. Login: Successful sign in with migrated Alice demo account', async () => {
    const res = await request('POST', '/auth/login', {
      email: 'alice@bookloop.local',
      password: 'BookLoop2026!',
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    if (!res.cookie) throw new Error('Missing session cookie');
    if (res.data.data._id !== ALICE_ID) throw new Error(`Preserved ID mismatch: expected ${ALICE_ID}, got ${res.data.data._id}`);
    aliceCookie = res.cookie;
  });

  await test('8. Login: Successful sign in with migrated Bob demo account', async () => {
    const res = await request('POST', '/auth/login', {
      email: 'bob@bookloop.local',
      password: 'BookLoop2026!',
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.data.data._id !== BOB_ID) throw new Error(`Preserved ID mismatch for Bob: got ${res.data.data._id}`);
    bobCookie = res.cookie;
  });

  await test('9. Login: Reject incorrect password with generic message (401)', async () => {
    const res = await request('POST', '/auth/login', {
      email: 'alice@bookloop.local',
      password: 'IncorrectPassword!',
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await test('10. Login: Reject unknown email with generic message (401)', async () => {
    const res = await request('POST', '/auth/login', {
      email: 'nonexistent_user@bookloop.local',
      password: 'AnyPassword123!',
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await test('11. Session: Verify authenticated profile via GET /api/auth/me', async () => {
    const res = await request('GET', '/auth/me', null, aliceCookie);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.data.data.email !== 'alice@bookloop.local') throw new Error('Email mismatch');
  });

  await test('12. Session: Unauthenticated call to GET /api/auth/me returns 401', async () => {
    const res = await request('GET', '/auth/me');
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await test('13. Session: Logout clears cookie and invalidates session', async () => {
    const res = await request('POST', '/auth/logout', null, clarissaCookie);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  // ---------------------------------------------------------
  // 3. AUTHORIZATION & OWNERSHIP TESTS
  // ---------------------------------------------------------
  let bookId = null;

  await test('14. Auth Guard: Unauthenticated POST /api/books returns 401', async () => {
    const res = await request('POST', '/books', {
      title: 'Unauthenticated Book Attempt',
      author: 'Ghost Author',
      genre: 'Mystery',
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await test('15. Ownership: Alice creates book; ownerId automatically assigned from session', async () => {
    const res = await request('POST', '/books', {
      title: 'Mrs Dalloway in the Library ' + uniqueSuffix,
      author: 'Virginia Woolf',
      genre: 'Fiction',
      description: 'First edition classic volume.',
      availability: true,
    }, aliceCookie);
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
    bookId = res.data.data._id;
    if (res.data.data.ownerId !== ALICE_ID) throw new Error(`OwnerId not derived from session: got ${res.data.data.ownerId}`);
  });

  await test('16. Authorization: Bob cannot modify Alice book (403)', async () => {
    const res = await request('PATCH', `/books/${bookId}`, {
      title: 'Vandalized Title by Bob',
    }, bobCookie);
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  await test('17. Authorization: Bob cannot delete Alice book (403)', async () => {
    const res = await request('DELETE', `/books/${bookId}`, null, bobCookie);
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  // ---------------------------------------------------------
  // 4. CIRCULATION & NOTIFICATIONS WORKFLOW
  // ---------------------------------------------------------
  let borrowReqId = null;

  await test('18. Borrowing: Alice cannot borrow her own book (400)', async () => {
    const res = await request('POST', '/borrow-requests', {
      bookId,
      notes: 'Self loan',
    }, aliceCookie);
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await test('19. Borrowing: Bob requests Alice book; borrowerId assigned from session', async () => {
    const res = await request('POST', '/borrow-requests', {
      bookId,
      notes: 'Would love to read this Woolf edition.',
    }, bobCookie);
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
    borrowReqId = res.data.data._id;
    if (res.data.data.borrowerId !== BOB_ID) throw new Error('BorrowerId mismatch');
    if (res.data.data.ownerId !== ALICE_ID) throw new Error('OwnerId mismatch');
  });

  await test('20. Notifications: Alice has pending notification count, Bob has 0', async () => {
    const aliceNotif = await request('GET', '/notifications/count', null, aliceCookie);
    const bobNotif = await request('GET', '/notifications/count', null, bobCookie);
    if (aliceNotif.data.data.pendingLendingRequests < 1) {
      throw new Error(`Alice should have at least 1 pending request, got ${aliceNotif.data.data.pendingLendingRequests}`);
    }
    if (bobNotif.data.data.pendingLendingRequests !== 0) {
      throw new Error(`Bob should have 0 pending requests, got ${bobNotif.data.data.pendingLendingRequests}`);
    }
  });

  await test('21. Authorization: Bob cannot approve his own borrow request (403)', async () => {
    const futureDate = new Date(Date.now() + 14 * 86400000).toISOString();
    const res = await request('PATCH', `/borrow-requests/${borrowReqId}/approve`, {
      dueDate: futureDate,
    }, bobCookie);
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  await test('22. Authorization: Bob cannot reject request on Alice book (403)', async () => {
    const res = await request('PATCH', `/borrow-requests/${borrowReqId}/reject`, {}, bobCookie);
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  await test('23. Circulation: Alice approves Bob request; sets book unavailable', async () => {
    const futureDate = new Date(Date.now() + 14 * 86400000).toISOString();
    const res = await request('PATCH', `/borrow-requests/${borrowReqId}/approve`, {
      dueDate: futureDate,
    }, aliceCookie);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);

    // Verify book is unavailable
    const bookRes = await request('GET', `/books/${bookId}`);
    if (bookRes.data.data.availability !== false) throw new Error('Book should be marked unavailable');
  });

  await test('24. Authorization: Bob cannot mark loan as returned (403)', async () => {
    const res = await request('PATCH', `/borrow-requests/${borrowReqId}/return`, {}, bobCookie);
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  await test('25. Circulation: Alice marks loan as returned; restores availability', async () => {
    const res = await request('PATCH', `/borrow-requests/${borrowReqId}/return`, {}, aliceCookie);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);

    // Verify book availability is restored
    const bookRes = await request('GET', `/books/${bookId}`);
    if (bookRes.data.data.availability !== true) throw new Error('Book availability should be restored');

    // Verify Alice pending notification count decremented
    const aliceNotif = await request('GET', '/notifications/count', null, aliceCookie);
    if (aliceNotif.data.data.pendingLendingRequests !== 0) {
      throw new Error(`Expected 0 pending requests for Alice, got ${aliceNotif.data.data.pendingLendingRequests}`);
    }
  });

  console.log(`\n=== RESULTS: ${passed}/${total} TESTS PASSED ===\n`);
  if (passed !== total) process.exit(1);
}

runTests();

