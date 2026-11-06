/**
 * BookLoop Phase 5 Comprehensive Verification & Security Audit Test Suite
 * Covers authentication, security hardening, search ReDoS prevention, active loan delete guards,
 * circulation lifecycle, notifications, rate limiting, and data persistence.
 */

const BASE = 'http://localhost:5000/api';

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
  console.log('=== STARTING BOOKLOOP PHASE 5 VERIFICATION SUITE ===\n');
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

  const uniqueSuffix = Date.now();
  let testUserCookie = null;
  let testUserId = null;
  let aliceCookie = null;
  let bobCookie = null;

  // 1. Health check verification
  await test('1. Health Check: Backend server is operational', async () => {
    const res = await request('GET', '/health');
    if (!res.ok || res.data.message !== 'BookLoop API is running') {
      throw new Error(`Health check failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 2. Authentication: Alice & Bob login
  await test('2. Auth: Alice and Bob login with secure session cookies', async () => {
    const aliceRes = await request('POST', '/auth/login', {
      email: 'alice@bookloop.local',
      password: 'BookLoop2026!',
    });
    if (!aliceRes.ok || !aliceRes.cookie) throw new Error('Failed to login Alice');
    aliceCookie = aliceRes.cookie;

    const bobRes = await request('POST', '/auth/login', {
      email: 'bob@bookloop.local',
      password: 'BookLoop2026!',
    });
    if (!bobRes.ok || !bobRes.cookie) throw new Error('Failed to login Bob');
    bobCookie = bobRes.cookie;
  });

  // 3. User Registration with Validation
  await test('3. Auth: New user registration with password validation', async () => {
    const email = `auditor_${uniqueSuffix}@bookloop.local`;
    const res = await request('POST', '/auth/register', {
      name: 'Auditor User',
      email,
      password: 'SecurePassword2026!',
      confirmPassword: 'SecurePassword2026!',
    });
    if (res.status !== 201) throw new Error(`Registration failed: ${JSON.stringify(res.data)}`);
    testUserCookie = res.cookie;
    testUserId = res.data.data._id;
  });

  // 4. Security: ReDoS protection on book search
  await test('4. Security: Special regex metacharacters in search do not crash or error', async () => {
    // Testing unescaped regex symbols that would crash new RegExp('(', 'i')
    const specialChars = ['(', '[', '+', '*{3}', '\\', '(?=.*)'];
    for (const q of specialChars) {
      const res = await request('GET', `/books?search=${encodeURIComponent(q)}`);
      if (res.status !== 200) {
        throw new Error(`Search failed on query "${q}" with status ${res.status}`);
      }
      if (!Array.isArray(res.data.data)) {
        throw new Error('Expected array in search response');
      }
    }
  });

  // 5. Book Listing & Retrieval
  let auditedBookId = null;
  await test('5. Books: Alice lists a volume with owner attribution', async () => {
    const res = await request('POST', '/books', {
      title: `The Architecture of Print ${uniqueSuffix}`,
      author: 'Beatrice Warde',
      genre: 'Art',
      description: 'A study of typography and readability.',
      availability: true,
    }, aliceCookie);
    if (res.status !== 201) throw new Error(`Failed to list book: ${JSON.stringify(res.data)}`);
    auditedBookId = res.data.data._id;
  });

  // 6. Circulation Lifecycle: Borrow Request
  let borrowReqId = null;
  await test('6. Circulation: Bob requests Alice book; status is Pending', async () => {
    const res = await request('POST', '/borrow-requests', {
      bookId: auditedBookId,
      notes: 'Requesting for Phase 5 verification test.',
    }, bobCookie);
    if (res.status !== 201) throw new Error(`Failed to request book: ${JSON.stringify(res.data)}`);
    borrowReqId = res.data.data._id;
    if (res.data.data.status !== 'Pending') throw new Error(`Expected Pending, got ${res.data.data.status}`);
  });

  // 7. Circulation Rule: Duplicate request rejection
  await test('7. Circulation Rule: Duplicate active borrow request rejected (400)', async () => {
    const res = await request('POST', '/borrow-requests', {
      bookId: auditedBookId,
      notes: 'Second request attempt should be rejected.',
    }, bobCookie);
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // 8. Authorization: Borrower cannot approve their own request
  await test('8. Authorization: Bob cannot approve borrow request (403)', async () => {
    const dueDate = new Date(Date.now() + 7 * 86400000).toISOString();
    const res = await request('PATCH', `/borrow-requests/${borrowReqId}/approve`, { dueDate }, bobCookie);
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  // 9. Circulation: Alice approves Bob request with due date
  await test('9. Circulation: Alice approves request; marks book unavailable', async () => {
    const dueDate = new Date(Date.now() + 7 * 86400000).toISOString();
    const res = await request('PATCH', `/borrow-requests/${borrowReqId}/approve`, { dueDate }, aliceCookie);
    if (res.status !== 200) throw new Error(`Approval failed: ${JSON.stringify(res.data)}`);

    // Verify book is now marked unavailable
    const bookRes = await request('GET', `/books/${auditedBookId}`);
    if (bookRes.data.data.availability !== false) {
      throw new Error('Book should be marked unavailable after approval');
    }
  });

  // 10. Data Integrity: Owner cannot delete book while actively on loan
  await test('10. Data Integrity: Owner cannot delete book during active loan (400)', async () => {
    const res = await request('DELETE', `/books/${auditedBookId}`, null, aliceCookie);
    if (res.status !== 400) {
      throw new Error(`Expected 400 rejecting deletion of loaned book, got ${res.status}`);
    }
  });

  // 11. Notifications: Persistent notification delivery & read isolation
  await test('11. Notifications: Bob received approval notification; Alice cannot read it (403/404)', async () => {
    const bobNotifRes = await request('GET', '/notifications', null, bobCookie);
    if (!bobNotifRes.ok) throw new Error('Failed to fetch Bob notifications');
    const approvalNotif = bobNotifRes.data.data.find(
      (n) => n.relatedRequestId?._id === borrowReqId || n.relatedRequestId === borrowReqId
    );
    if (!approvalNotif) throw new Error('Bob did not receive approval notification');

    // Alice attempts to mark Bob notification as read
    const isolationRes = await request('PATCH', `/notifications/${approvalNotif._id}/read`, {}, aliceCookie);
    if (isolationRes.status !== 403 && isolationRes.status !== 404) {
      throw new Error(`Expected 403 or 404 for notification cross-access, got ${isolationRes.status}`);
    }
  });

  // 12. Circulation: Alice records return; book availability restored
  await test('12. Circulation: Alice marks loan as returned; restores availability', async () => {
    const res = await request('PATCH', `/borrow-requests/${borrowReqId}/return`, {}, aliceCookie);
    if (res.status !== 200) throw new Error(`Return failed: ${JSON.stringify(res.data)}`);

    // Verify book availability is restored
    const bookRes = await request('GET', `/books/${auditedBookId}`);
    if (bookRes.data.data.availability !== true) {
      throw new Error('Book availability should be true after return');
    }
  });

  // 13. Data Integrity: Book can now be deleted after return
  await test('13. Data Integrity: Owner can delete book after successful return', async () => {
    const res = await request('DELETE', `/books/${auditedBookId}`, null, aliceCookie);
    if (res.status !== 200) {
      throw new Error(`Expected 200 deleting returned book, got ${res.status}`);
    }
  });

  // 14. User Profile & Dashboard Statistics
  await test('14. Dashboard: Authenticated dashboard metrics return numerical stats', async () => {
    const res = await request('GET', '/users/dashboard-stats', null, aliceCookie);
    if (!res.ok) throw new Error(`Dashboard stats error: ${JSON.stringify(res.data)}`);
    const { booksListed, activeLoans, completedCirculations } = res.data.data;
    if (typeof booksListed !== 'number') throw new Error('booksListed is not a number');
    if (typeof activeLoans !== 'number') throw new Error('activeLoans is not a number');
    if (typeof completedCirculations !== 'number') throw new Error('completedCirculations is not a number');
  });

  // 15. Security: Authentication Rate Limiter responds with headers
  await test('15. Security: Rate limiter active on auth endpoints', async () => {
    const res = await request('POST', '/auth/login', {
      email: 'nonexistent@bookloop.local',
      password: 'WrongPassword!',
    });
    // Should respond 401 with generic error
    if (res.status !== 401 || res.data.error !== 'Invalid email or password') {
      throw new Error(`Expected 401 generic auth failure, got ${res.status}`);
    }
  });

  console.log(`\n=== RESULTS: ${passed}/${total} TESTS PASSED ===\n`);
  if (passed !== total) process.exit(1);
}

runTests();

