/**
 * BookLoop Phase 8 — Handover Coordination Verification Suite
 *
 * Verifies:
 * 1. Owner lists book and borrower requests it (Pending)
 * 2. Owner approves borrow request (Approved)
 * 3. Owner creates handover proposal with calendar date, time, and instructions
 * 4. Security checks: non-owner cannot propose, invalid past dates rejected
 * 5. Borrower receives persistent HANDOVER_PROPOSED notification
 * 6. Borrower declines proposal (NO):
 *    - Request status remains 'Approved' (NOT rejected)
 *    - Handover status becomes 'Declined'
 *    - Owner receives HANDOVER_DECLINED notification
 * 7. Owner reschedules proposal with new date, time, and instructions:
 *    - Handover status returns to 'Proposed'
 *    - Reschedule count tracked
 * 8. Borrower accepts proposal (YES):
 *    - Handover status becomes 'Accepted'
 *    - Owner receives HANDOVER_ACCEPTED notification
 *    - Confirmed date, time, and location recorded
 * 9. Physical receipt and return separation:
 *    - Existing return workflow functions independently
 * 10. Clean up test data
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
  console.log('=== STARTING BOOKLOOP PHASE 8 HANDOVER COORDINATION SUITE ===\n');
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
    const timestamp = Date.now();

    // ---------------------------------------------------------
    // 1. Setup Owner & Borrower Accounts
    // ---------------------------------------------------------
    console.log('Setup: Registering Owner and Borrower');
    const ownerEmail = `owner_phase8_${timestamp}@test.bookloop.local`;
    const borrowerEmail = `borrower_phase8_${timestamp}@test.bookloop.local`;

    const ownerReg = await request('POST', '/auth/register', {
      name: 'Ramesh Gowda',
      email: ownerEmail,
      password: 'Password123!',
      confirmPassword: 'Password123!',
      neighborhood: 'Yelahanka',
    });
    assert(ownerReg.status === 201, 'Owner registered successfully');
    const ownerCookie = ownerReg.cookie;
    const ownerId = ownerReg.data?.data?._id;

    const borrowerReg = await request('POST', '/auth/register', {
      name: 'Sunita Rao',
      email: borrowerEmail,
      password: 'Password123!',
      confirmPassword: 'Password123!',
      neighborhood: 'Hebbal',
    });
    assert(borrowerReg.status === 201, 'Borrower registered successfully');
    const borrowerCookie = borrowerReg.cookie;
    const borrowerId = borrowerReg.data?.data?._id;

    // ---------------------------------------------------------
    // 2. Owner Lists a Book & Borrower Requests It
    // ---------------------------------------------------------
    console.log('\nStep 1 & 2: Book Creation & Borrow Request');
    const bookRes = await request('POST', '/books', {
      title: `The Guide to Karnataka Heritage ${timestamp}`,
      author: 'K. S. Rao',
      genre: 'History',
      description: 'Historical monuments and culture.',
    }, ownerCookie);
    assert(bookRes.status === 201, 'Book created in Yelahanka');
    const bookId = bookRes.data?.data?._id;

    const borrowReqRes = await request('POST', '/borrow-requests', {
      bookId,
      notes: 'I would love to read this for my history project.',
    }, borrowerCookie);
    assert(borrowReqRes.status === 201, 'Borrow request submitted (status Pending)');
    const reqId = borrowReqRes.data?.data?._id;
    assert(borrowReqRes.data?.data?.status === 'Pending', 'Initial borrow request status is Pending');

    // ---------------------------------------------------------
    // 3. Owner Approves the Borrow Request
    // ---------------------------------------------------------
    console.log('\nStep 3: Owner Approves Request');
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14); // 14 days in future
    const approveRes = await request('PATCH', `/borrow-requests/${reqId}/approve`, {
      dueDate: dueDate.toISOString().split('T')[0],
    }, ownerCookie);
    assert(approveRes.status === 200, 'Borrow request approved');
    const approvedRequestData = approveRes.data?.data?.request || approveRes.data?.data;
    assert(approvedRequestData?.status === 'Approved', 'Borrow request status transitioned to Approved');
    assert(approvedRequestData?.handover?.status === 'Unproposed', 'Initial handover status is Unproposed');

    // ---------------------------------------------------------
    // 4. Security & Validation Guards on Handover Proposal
    // ---------------------------------------------------------
    console.log('\nStep 4: Proposal Security & Validation Guards');
    // Guard 1: Borrower cannot propose handover
    const unauthProposal = await request('POST', `/borrow-requests/${reqId}/handover/propose`, {
      date: new Date().toISOString().split('T')[0],
      time: '18:00',
      instructions: 'Meet me at metro station',
    }, borrowerCookie);
    assert(unauthProposal.status === 403, 'Borrower forbidden from proposing handover (403)');

    // Guard 2: Past dates rejected
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);
    const pastProposal = await request('POST', `/borrow-requests/${reqId}/handover/propose`, {
      date: pastDate.toISOString().split('T')[0],
      time: '18:00',
      instructions: 'Meet in the past',
    }, ownerCookie);
    assert(pastProposal.status === 400, 'Past handover date rejected (400)');

    // Guard 3: Date beyond due date rejected
    const farFutureDate = new Date();
    farFutureDate.setDate(farFutureDate.getDate() + 20);
    const farFutureProposal = await request('POST', `/borrow-requests/${reqId}/handover/propose`, {
      date: farFutureDate.toISOString().split('T')[0],
      time: '18:00',
      instructions: 'Meet after loan due date',
    }, ownerCookie);
    assert(farFutureProposal.status === 400, 'Handover date after loan due date rejected (400)');

    // ---------------------------------------------------------
    // 5. Owner Submits Valid Handover Proposal
    // ---------------------------------------------------------
    console.log('\nStep 5: Owner Sends Handover Proposal');
    const proposeDate = new Date();
    proposeDate.setDate(proposeDate.getDate() + 2); // 2 days in future
    const proposeDateStr = proposeDate.toISOString().split('T')[0];

    const proposalRes = await request('POST', `/borrow-requests/${reqId}/handover/propose`, {
      date: proposeDateStr,
      time: '17:30',
      instructions: 'Meet outside Costa Coffee in Yelahanka New Town. I will be wearing glasses.',
    }, ownerCookie);
    assert(proposalRes.status === 200, 'Handover proposal submitted successfully');
    assert(proposalRes.data?.data?.handover?.status === 'Proposed', 'Handover status is Proposed');
    assert(proposalRes.data?.data?.handover?.proposedTime === '17:30', 'Handover time saved as 17:30');
    assert(proposalRes.data?.data?.handover?.instructions.includes('Costa Coffee'), 'Instructions saved correctly');

    // ---------------------------------------------------------
    // 6. Verify Borrower Received HANDOVER_PROPOSED Notification
    // ---------------------------------------------------------
    console.log('\nStep 6: Borrower Notification Verification');
    const borrowerNotifRes = await request('GET', '/notifications?limit=5', null, borrowerCookie);
    assert(borrowerNotifRes.status === 200, 'Fetched borrower notifications');
    const proposalNotif = borrowerNotifRes.data?.data?.find((n) => n.type === 'HANDOVER_PROPOSED');
    assert(!!proposalNotif, 'Borrower received HANDOVER_PROPOSED notification');
    assert(proposalNotif?.message.includes('17:30'), 'Notification includes proposed time');

    // ---------------------------------------------------------
    // 7. Borrower Declines Proposal (NO)
    // ---------------------------------------------------------
    console.log('\nStep 7: Borrower Declines Proposal (NO)');
    // Guard: Owner cannot respond
    const ownerRespondAttempt = await request('PATCH', `/borrow-requests/${reqId}/handover/respond`, {
      decision: 'NO',
    }, ownerCookie);
    assert(ownerRespondAttempt.status === 403, 'Owner forbidden from responding to proposal (403)');

    const declineRes = await request('PATCH', `/borrow-requests/${reqId}/handover/respond`, {
      decision: 'NO',
    }, borrowerCookie);
    assert(declineRes.status === 200, 'Borrower declined handover proposal (200)');
    assert(declineRes.data?.data?.handover?.status === 'Declined', 'Handover status transitioned to Declined');

    // CRITICAL REQUIREMENT: BorrowRequest MUST REMAIN 'Approved'
    assert(declineRes.data?.data?.status === 'Approved', 'Borrow request status remains Approved after decline (not rejected)');

    // Verify Owner received HANDOVER_DECLINED notification
    const ownerNotif1 = await request('GET', '/notifications?limit=5', null, ownerCookie);
    const declineNotif = ownerNotif1.data?.data?.find((n) => n.type === 'HANDOVER_DECLINED');
    assert(!!declineNotif, 'Owner received HANDOVER_DECLINED notification');

    // ---------------------------------------------------------
    // 8. Owner Reschedules Handover Proposal
    // ---------------------------------------------------------
    console.log('\nStep 8: Owner Reschedules Proposal with Updated Details');
    const rescheduleDate = new Date();
    rescheduleDate.setDate(rescheduleDate.getDate() + 3);
    const rescheduleDateStr = rescheduleDate.toISOString().split('T')[0];

    const rescheduleRes = await request('POST', `/borrow-requests/${reqId}/handover/propose`, {
      date: rescheduleDateStr,
      time: '19:00',
      instructions: 'Alternative: Meet at Yelahanka Metro Gate 2 at 7:00 PM.',
    }, ownerCookie);
    assert(rescheduleRes.status === 200, 'Owner rescheduled handover proposal');
    assert(rescheduleRes.data?.data?.handover?.status === 'Proposed', 'Handover status returned to Proposed');
    assert(rescheduleRes.data?.data?.handover?.proposedTime === '19:00', 'Updated time saved');
    assert(rescheduleRes.data?.data?.handover?.rescheduleCount >= 1, 'Reschedule count tracked');

    // ---------------------------------------------------------
    // 9. Borrower Accepts Rescheduled Proposal (YES)
    // ---------------------------------------------------------
    console.log('\nStep 9: Borrower Accepts Rescheduled Proposal (YES)');
    const acceptRes = await request('PATCH', `/borrow-requests/${reqId}/handover/respond`, {
      decision: 'YES',
    }, borrowerCookie);
    assert(acceptRes.status === 200, 'Borrower accepted proposal');
    assert(acceptRes.data?.data?.handover?.status === 'Accepted', 'Handover status is Accepted');
    assert(acceptRes.data?.data?.status === 'Approved', 'Borrow request remains Approved');

    // Verify Owner received HANDOVER_ACCEPTED notification
    const ownerNotif2 = await request('GET', '/notifications?limit=5', null, ownerCookie);
    const acceptNotif = ownerNotif2.data?.data?.find((n) => n.type === 'HANDOVER_ACCEPTED');
    assert(!!acceptNotif, 'Owner received HANDOVER_ACCEPTED notification');

    // ---------------------------------------------------------
    // 10. Verify Confirmed Details on Both Sides
    // ---------------------------------------------------------
    console.log('\nStep 10: Verifying Confirmed Details for Both Users');
    const reqAsOwner = await request('GET', `/borrow-requests/${reqId}`, null, ownerCookie);
    assert(reqAsOwner.data?.data?.handover?.status === 'Accepted', 'Owner reads confirmed status: Accepted');
    assert(reqAsOwner.data?.data?.handover?.proposedTime === '19:00', 'Owner reads confirmed time: 19:00');

    const reqAsBorrower = await request('GET', `/borrow-requests/${reqId}`, null, borrowerCookie);
    assert(reqAsBorrower.data?.data?.handover?.status === 'Accepted', 'Borrower reads confirmed status: Accepted');
    assert(reqAsBorrower.data?.data?.handover?.instructions.includes('Gate 2'), 'Borrower reads confirmed instructions');

    // ---------------------------------------------------------
    // 11. Separation of Concerns: Mark Returned
    // ---------------------------------------------------------
    console.log('\nStep 11: Marking Volume Returned after Loan Lifecycle');
    const returnRes = await request('PATCH', `/borrow-requests/${reqId}/return`, null, ownerCookie);
    assert(returnRes.status === 200, 'Owner marked volume as returned');
    assert(returnRes.data?.data?.status === 'Returned', 'Request status is Returned');

    // Verify book is available again
    const finalBook = await request('GET', `/books/${bookId}`);
    assert(finalBook.data?.data?.availability === true, 'Book availability restored to true');

    // ---------------------------------------------------------
    // 12. Cleanup
    // ---------------------------------------------------------
    console.log('\nCleaning up test book and requests...');
    await request('DELETE', `/books/${bookId}`, null, ownerCookie);

    console.log(`\n=== PHASE 8 TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED ===\n`);
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
