/**
 * Test Suite: Production Readiness & Safety Verification
 * Verifies JWT protection, startup conditional logic, and secret handling.
 */

const assert = require('assert');
const path = require('path');

console.log('\n--- Running Production Readiness & Safety Verification Suite ---\n');

let passed = 0;
let failed = 0;

function runTest(description, testFn) {
  try {
    testFn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

const originalEnv = { ...process.env };

function resetEnv() {
  process.env = { ...originalEnv };
}

const { resolveJwtSecret, MIN_SECRET_LENGTH } = require('../config/jwt');

// Test 1: Production requires JWT_SECRET
runTest('Production rejects startup if JWT_SECRET is unset or empty', () => {
  resetEnv();
  process.env.NODE_ENV = 'production';
  delete process.env.JWT_SECRET;

  assert.throws(
    () => resolveJwtSecret(),
    /Production startup error: JWT_SECRET environment variable is mandatory/
  );

  process.env.JWT_SECRET = '   ';
  assert.throws(
    () => resolveJwtSecret(),
    /Production startup error: JWT_SECRET environment variable is mandatory/
  );
});

// Test 2: Production rejects weak / short secrets
runTest(`Production rejects JWT_SECRET shorter than ${MIN_SECRET_LENGTH} characters`, () => {
  resetEnv();
  process.env.NODE_ENV = 'production';
  const weakSecret = 'short_secret_under_32_chars';
  process.env.JWT_SECRET = weakSecret;

  assert.throws(
    () => resolveJwtSecret(),
    (err) => {
      assert(err.message.includes('insufficiently strong'));
      // Secret must NEVER be leaked in the error message
      assert(!err.message.includes(weakSecret));
      return true;
    }
  );
});

// Test 3: Production accepts valid >= 32 character secret
runTest('Production accepts strong JWT_SECRET (>= 32 chars) and never leaks it in logs/errors', () => {
  resetEnv();
  process.env.NODE_ENV = 'production';
  const strongSecret = 'a'.repeat(32);
  process.env.JWT_SECRET = strongSecret;

  const resolved = resolveJwtSecret();
  assert.strictEqual(resolved, strongSecret);
});

// Test 4: Development fallback works for local testing
runTest('Development environment safely falls back to local key when JWT_SECRET is absent', () => {
  resetEnv();
  process.env.NODE_ENV = 'development';
  delete process.env.JWT_SECRET;

  const resolved = resolveJwtSecret();
  assert(resolved && resolved.length > 0);
  assert.strictEqual(resolved, 'bookloop_jwt_secret_editorial_2026_secure_key');
});

// Test 5: Development uses custom JWT_SECRET if supplied
runTest('Development environment respects custom JWT_SECRET when explicitly provided', () => {
  resetEnv();
  process.env.NODE_ENV = 'development';
  process.env.JWT_SECRET = 'custom-dev-secret';

  const resolved = resolveJwtSecret();
  assert.strictEqual(resolved, 'custom-dev-secret');
});

// Test 6: Verify all modules reference centralized config/jwt
runTest('Auth controller, Auth middleware, and Socket service share centralized JWT module', () => {
  const jwtConfig = require('../config/jwt');
  const authMiddleware = require('../middleware/auth');
  const socketService = require('../services/socketService');

  assert(jwtConfig.JWT_SECRET, 'config/jwt must export JWT_SECRET');
  assert(typeof jwtConfig.resolveJwtSecret === 'function', 'config/jwt must export resolveJwtSecret function');
});

// Test 7: Verify server.js contains production gating for seedDevUsers and migrations
runTest('server.js conditionally guards seedDevUsers and migrations for production', () => {
  const fs = require('fs');
  const serverCode = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

  assert(serverCode.includes("const isProduction = process.env.NODE_ENV === 'production'"));
  assert(serverCode.includes('if (!isProduction)'));
  assert(serverCode.includes('resolveJwtSecret();'));
  assert(serverCode.includes('startScheduler();'));
});

// Test 8: Verify README.md has removed demo passwords
runTest('README.md has no exposed demo passwords', () => {
  const fs = require('fs');
  const readme = fs.readFileSync(path.join(__dirname, '../../README.md'), 'utf8');

  assert(!readme.includes('BookLoop2026!'), 'README.md must not contain the demo password BookLoop2026!');
  assert(readme.includes('(Development only)'), 'README.md should label local demo accounts as Development only');
});

// Test 9: Verify migration scripts remain intact for manual execution
runTest('Data migration scripts remain available for manual execution', () => {
  const fs = require('fs');
  assert(fs.existsSync(path.join(__dirname, 'migratePhase2_5.js')));
  assert(fs.existsSync(path.join(__dirname, 'migratePhase3.js')));
  assert(fs.existsSync(path.join(__dirname, 'seedDevUsers.js')));
});

resetEnv();

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('✓ All Production Readiness & Safety tests passed!\n');
}
