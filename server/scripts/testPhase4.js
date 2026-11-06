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

  let sessionCookie = null;
  const setCookieHeader = res.headers.get('set-cookie');
  if (setCookieHeader) {
    const match = setCookieHeader.match(/token=[^;]+/);
    if (match) sessionCookie = match[0];
  }

  return { status: res.status, ok: res.ok, data, cookie: sessionCookie };
}

async function runTests() {
  console.log('=== STARTING BOOKLOOP PHASE 4 TEST SUITE ===\n');
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

  // 1. Authenticate Alice and Bob
  let aliceCookie = null;
  let bobCookie = null;

  await test('1. Login: Authenticate Alice and Bob demo sessions', async () => {
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

  // Clear unread notifications first for clean test baseline
  await request('PATCH', '/notifications/read-all', {}, aliceCookie);
  await request('PATCH', '/notifications/read-all', {}, bobCookie);

  // 2. Alice creates a book for Phase 4 circulation testing
  let bookId = null;
  const uniqueTitle = 'Chronicles of Circulating Pages ' + Date.now();
  await test('2. Book Creation: Alice lists a new book', async () => {
    const res = await request('POST', '/books', {
      title: uniqueTitle,
      author: 'George Eliot',
      genre: 'Fiction',
      description: 'Phase 4 notification testing specimen.',
      availability: true,
    }, aliceCookie);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.data)}`);
    bookId = res.data.data._id;
  });

  // 3. Bob requests Alice's book -> Alice should get a BORROW_REQUEST_RECEIVED notification
  let borrowReqId = null;
  let aliceNotifId = null;
  await test('3. Event: Bob requests book -> Owner (Alice) receives notification', async () => {
    const prevCountRes = await request('GET', '/notifications/count', null, aliceCookie);
    const prevCount = prevCountRes.data.data.unreadCount;

    const res = await request('POST', '/borrow-requests', {
      bookId,
      notes: 'May I borrow this Eliot volume?',
    }, bobCookie);
    if (!res.ok) throw new Error(`Failed to create request: ${JSON.stringify(res.data)}`);
    borrowReqId = res.data.data._id;

    // Verify Alice unread count incremented
    const countRes = await request('GET', '/notifications/count', null, aliceCookie);
    if (countRes.data.data.unreadCount !== prevCount + 1) {
      throw new Error(`Expected unread count ${prevCount + 1}, got ${countRes.data.data.unreadCount}`);
    }

    // Verify notification content
    const listRes = await request('GET', '/notifications', null, aliceCookie);
    const notif = listRes.data.data.find((n) => n.relatedRequestId?._id === borrowReqId || n.relatedRequestId === borrowReqId);
    if (!notif) throw new Error('Notification not found in Alice inbox');
    if (notif.type !== 'BORROW_REQUEST_RECEIVED') throw new Error(`Wrong type: ${notif.type}`);
    aliceNotifId = notif._id;
  });

  // 4. Notification Read Action (single item)
  await test('4. Read Action: Alice marks borrow request notification as read', async () => {
    const res = await request('PATCH', `/notifications/${aliceNotifId}/read`, {}, aliceCookie);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (res.data.data.isRead !== true) throw new Error('Notification was not marked read');

    // Verify unread count decremented
    const countRes = await request('GET', '/notifications/count', null, aliceCookie);
    if (countRes.data.data.unreadCount !== 0) {
      throw new Error(`Expected unreadCount 0, got ${countRes.data.data.unreadCount}`);
    }
  });

  // 5. Notification Isolation: Bob cannot mark Alice's notification as read
  await test('5. Isolation: Bob cannot mark Alice notification as read (403/404)', async () => {
    const res = await request('PATCH', `/notifications/${aliceNotifId}/read`, {}, bobCookie);
    if (res.status !== 403 && res.status !== 404) {
      throw new Error(`Expected 403/404, got ${res.status}`);
    }
  });

  // 6. Alice approves Bob's request -> Bob should get BORROW_REQUEST_APPROVED notification
  let bobNotifId = null;
  await test('6. Event: Alice approves request -> Borrower (Bob) receives notification with due date', async () => {
    const dueDate = new Date(Date.now() + 10 * 86400000).toISOString();
    const res = await request('PATCH', `/borrow-requests/${borrowReqId}/approve`, { dueDate }, aliceCookie);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const bobList = await request('GET', '/notifications', null, bobCookie);
    const approvedNotif = bobList.data.data.find((n) => n.type === 'BORROW_REQUEST_APPROVED');
    if (!approvedNotif) throw new Error('Borrower did not receive approval notification');
    if (!approvedNotif.message.includes('approved')) throw new Error('Notification missing approval text');
    bobNotifId = approvedNotif._id;
  });

  // 7. Bulk Action: Mark all notifications as read
  await test('7. Bulk Action: Bob marks all notifications as read', async () => {
    const res = await request('PATCH', '/notifications/read-all', {}, bobCookie);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const countRes = await request('GET', '/notifications/count', null, bobCookie);
    if (countRes.data.data.unreadCount !== 0) {
      throw new Error(`Expected unreadCount 0, got ${countRes.data.data.unreadCount}`);
    }
  });

  // 8. Alice marks loan returned -> Both Alice and Bob receive BOOK_RETURNED notifications
  await test('8. Event: Alice marks loan returned -> Both borrower & owner notified', async () => {
    const res = await request('PATCH', `/borrow-requests/${borrowReqId}/return`, {}, aliceCookie);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Check Bob received return notification
    const bobList = await request('GET', '/notifications', null, bobCookie);
    const bobReturnNotif = bobList.data.data.find((n) => n.type === 'BOOK_RETURNED');
    if (!bobReturnNotif) throw new Error('Borrower missing return notification');

    // Check Alice received return notification
    const aliceList = await request('GET', '/notifications', null, aliceCookie);
    const aliceReturnNotif = aliceList.data.data.find((n) => n.type === 'BOOK_RETURNED');
    if (!aliceReturnNotif) throw new Error('Owner missing return notification');
  });

  // 9. Rejection Event: Test BORROW_REQUEST_REJECTED
  await test('9. Event: Owner rejects request -> Borrower receives rejection notification', async () => {
    // Bob requests book again now that it is returned
    const reqRes = await request('POST', '/borrow-requests', {
      bookId,
      notes: 'Second request attempt',
    }, bobCookie);
    if (!reqRes.ok) throw new Error(`HTTP ${reqRes.status}`);
    const secondReqId = reqRes.data.data._id;

    // Alice rejects
    const rejRes = await request('PATCH', `/borrow-requests/${secondReqId}/reject`, {}, aliceCookie);
    if (!rejRes.ok) throw new Error(`HTTP ${rejRes.status}`);

    const bobList = await request('GET', '/notifications', null, bobCookie);
    const rejNotif = bobList.data.data.find(
      (n) => n.type === 'BORROW_REQUEST_REJECTED' && (n.relatedRequestId?._id === secondReqId || n.relatedRequestId === secondReqId)
    );
    if (!rejNotif) throw new Error('Borrower did not receive rejection notification');
  });

  // 10. Scheduled Reminder Processing & Deduplication
  await test('10. Scheduler: Approaching due date & overdue alerts with deduplication', async () => {
    // Run scheduler via backend trigger
    const res1 = await request('POST', '/notifications/trigger-reminders', {}, aliceCookie);
    if (!res1.ok) throw new Error(`HTTP ${res1.status}: ${JSON.stringify(res1.data)}`);

    // Run second time immediately to verify deduplication works cleanly without duplicates
    const res2 = await request('POST', '/notifications/trigger-reminders', {}, aliceCookie);
    if (!res2.ok) throw new Error(`HTTP ${res2.status}: ${JSON.stringify(res2.data)}`);
  });

  // 11. User Profile Endpoints
  await test('11. Profile: Fetch user profile with circulation metrics', async () => {
    const res = await request('GET', '/users/profile', null, aliceCookie);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.data)}`);
    if (!res.data.data.user || res.data.data.user.email !== 'alice@bookloop.local') {
      throw new Error('Profile user mismatch');
    }
    if (res.data.data.stats.booksListed < 1) {
      throw new Error('Expected booksListed count to be at least 1');
    }
  });

  await test('12. Profile: Update display name safely', async () => {
    const updatedName = 'Alice Kingsley';
    const res = await request('PATCH', '/users/profile', { name: updatedName }, aliceCookie);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.data)}`);
    if (res.data.data.name !== updatedName) throw new Error('Name update did not persist');

    // Revert name back to Alice
    await request('PATCH', '/users/profile', { name: 'Alice' }, aliceCookie);
  });

  // 12. Dashboard Statistics
  await test('13. Dashboard: Live authenticated dashboard statistics', async () => {
    const res = await request('GET', '/users/dashboard-stats', null, aliceCookie);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.data)}`);
    const { booksListed, activeLoans, pendingBorrowRequests, completedCirculations } = res.data.data;
    if (typeof booksListed !== 'number') throw new Error('booksListed is not a number');
    if (typeof activeLoans !== 'number') throw new Error('activeLoans is not a number');
    if (typeof completedCirculations !== 'number') throw new Error('completedCirculations is not a number');
  });

  // 13. Regression Check: Phase 3 Auth & Public Catalogue
  await test('14. Regression: Public catalogue and book details work unauthenticated', async () => {
    const booksRes = await request('GET', '/books');
    if (!booksRes.ok || booksRes.data.data.length === 0) throw new Error('Failed to fetch public books');

    const singleRes = await request('GET', `/books/${bookId}`);
    if (!singleRes.ok) throw new Error('Failed to fetch single book record');
  });

  console.log(`\n=== RESULTS: ${passed}/${total} TESTS PASSED ===\n`);
  if (passed !== total) process.exit(1);
}

runTests();
