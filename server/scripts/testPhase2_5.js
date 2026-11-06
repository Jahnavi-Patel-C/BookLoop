const BASE = 'http://localhost:5000/api';
const ALICE_ID = '65f000000000000000000001';
const BOB_ID = '65f000000000000000000002';

async function request(method, path, body = null, headers = {}) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, options);
  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-json
  }
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('=== STARTING BOOKLOOP PHASE 2.5 VERIFICATION ===\n');
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

  // 1. Seed & Resolution
  await test('1. Dev users list contains Alice and Bob', async () => {
    const res = await request('GET', '/dev-users');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (res.data.data.length < 2) throw new Error('Expected at least 2 users');
    const alice = res.data.data.find((u) => u._id === ALICE_ID);
    const bob = res.data.data.find((u) => u._id === BOB_ID);
    if (!alice || !bob) throw new Error('Alice or Bob missing');
  });

  await test('2. Current dev user header resolution for Alice', async () => {
    const res = await request('GET', '/dev-users/current', null, { 'X-Dev-User-Id': ALICE_ID });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (res.data.data._id !== ALICE_ID || res.data.data.name !== 'Alice') {
      throw new Error('Failed to resolve Alice');
    }
  });

  await test('3. Invalid X-Dev-User-Id yields 401', async () => {
    const res = await request('GET', '/dev-users/current', null, { 'X-Dev-User-Id': 'invalid_id_format' });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  // 2. Book Creation by Alice
  let testBookId = null;
  await test('4. Alice creates a book with ownership', async () => {
    const res = await request('POST', '/books', {
      title: 'The Odyssey of Ownership ' + Date.now(),
      author: 'Homer',
      genre: 'Fiction',
      description: 'A test book for Phase 2.5 identity verification.',
      availability: true,
    }, { 'X-Dev-User-Id': ALICE_ID });

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.data)}`);
    testBookId = res.data.data._id;
    if (res.data.data.ownerId !== ALICE_ID) throw new Error('Book ownerId mismatch');
    if (res.data.data.ownerName !== 'Alice') throw new Error('Book ownerName mismatch');
  });

  // 3. Self-borrowing prevention
  await test('5. Alice prevented from borrowing her own book (400)', async () => {
    const res = await request('POST', '/borrow-requests', {
      bookId: testBookId,
      notes: 'Self loan attempt',
    }, { 'X-Dev-User-Id': ALICE_ID });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // 4. Bob creates a borrow request on Alice book
  let requestId = null;
  await test('6. Bob requests Alice book', async () => {
    const res = await request('POST', '/borrow-requests', {
      bookId: testBookId,
      notes: 'Can I borrow this Homer classic?',
    }, { 'X-Dev-User-Id': BOB_ID });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.data)}`);
    requestId = res.data.data._id;
    if (res.data.data.borrowerId !== BOB_ID) throw new Error('BorrowerId mismatch');
    if (res.data.data.ownerId !== ALICE_ID) throw new Error('OwnerId mismatch');
    if (res.data.data.status !== 'Pending') throw new Error('Status should be Pending');
  });

  // 5. Duplicate request prevention
  await test('7. Bob prevented from creating duplicate active request (400)', async () => {
    const res = await request('POST', '/borrow-requests', {
      bookId: testBookId,
      notes: 'Second duplicate attempt',
    }, { 'X-Dev-User-Id': BOB_ID });
    if (res.status !== 400) throw new Error(`Expected 400 for duplicate request, got ${res.status}`);
  });

  // 6. Notifications check
  await test('8. Notification counts: Alice has pending request, Bob does not', async () => {
    const aliceNotif = await request('GET', '/notifications/count', null, { 'X-Dev-User-Id': ALICE_ID });
    const bobNotif = await request('GET', '/notifications/count', null, { 'X-Dev-User-Id': BOB_ID });
    if (aliceNotif.data.data.pendingLendingRequests < 1) {
      throw new Error(`Alice should have at least 1 pending lending request, got ${aliceNotif.data.data.pendingLendingRequests}`);
    }
    if (bobNotif.data.data.pendingLendingRequests !== 0) {
      throw new Error(`Bob should have 0 pending lending requests, got ${bobNotif.data.data.pendingLendingRequests}`);
    }
  });

  // 7. Authorization: Bob tries to approve his own request
  await test('9. Bob prevented from approving his own request (403)', async () => {
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
    const res = await request('PATCH', `/borrow-requests/${requestId}/approve`, {
      dueDate: futureDate,
    }, { 'X-Dev-User-Id': BOB_ID });
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  // 8. Authorization: Bob tries to reject request
  await test('10. Bob prevented from rejecting request on Alice book (403)', async () => {
    const res = await request('PATCH', `/borrow-requests/${requestId}/reject`, {}, { 'X-Dev-User-Id': BOB_ID });
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  // 9. Alice approves Bob request
  await test('11. Alice approves Bob request with due date', async () => {
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
    const res = await request('PATCH', `/borrow-requests/${requestId}/approve`, {
      dueDate: futureDate,
    }, { 'X-Dev-User-Id': ALICE_ID });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.data)}`);
    const approvedRequest = res.data.data.request || res.data.data;
    if (approvedRequest.status !== 'Approved') throw new Error('Status should be Approved');

    // Verify book availability changed to false
    const bookRes = await request('GET', `/books/${testBookId}`);
    if (bookRes.data.data.availability !== false) throw new Error('Book availability should be false');
  });

  // 10. Authorization: Bob tries to mark returned
  await test('12. Bob prevented from marking loan returned (403)', async () => {
    const res = await request('PATCH', `/borrow-requests/${requestId}/return`, {}, { 'X-Dev-User-Id': BOB_ID });
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  // 11. Alice marks returned
  await test('13. Alice marks book returned and restores availability', async () => {
    const res = await request('PATCH', `/borrow-requests/${requestId}/return`, {}, { 'X-Dev-User-Id': ALICE_ID });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.data)}`);
    if (res.data.data.status !== 'Returned') throw new Error('Status should be Returned');

    const bookRes = await request('GET', `/books/${testBookId}`);
    if (bookRes.data.data.availability !== true) throw new Error('Book availability should be restored to true');

    // Verify pending notification count decremented back to 0
    const aliceNotif = await request('GET', '/notifications/count', null, { 'X-Dev-User-Id': ALICE_ID });
    if (aliceNotif.data.data.pendingLendingRequests !== 0) {
      throw new Error(`Expected 0 pending lending requests, got ${aliceNotif.data.data.pendingLendingRequests}`);
    }
  });

  // 12. Book update authorization
  await test('14. Bob prevented from modifying Alice book (403)', async () => {
    const res = await request('PATCH', `/books/${testBookId}`, {
      title: 'Hacked by Bob',
    }, { 'X-Dev-User-Id': BOB_ID });
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  await test('15. Alice can update her own book (200)', async () => {
    const res = await request('PATCH', `/books/${testBookId}`, {
      title: 'The Odyssey of Ownership — Revised Edition',
    }, { 'X-Dev-User-Id': ALICE_ID });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (res.data.data.title !== 'The Odyssey of Ownership — Revised Edition') {
      throw new Error('Update did not persist');
    }
  });

  console.log(`\n=== RESULTS: ${passed}/${total} TESTS PASSED ===\n`);
  if (passed !== total) process.exit(1);
}

runTests();
