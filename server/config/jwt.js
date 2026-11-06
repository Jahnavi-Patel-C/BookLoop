/**
 * Centralized JWT Secret Resolution & Validation
 *
 * Production Safety Rules:
 * - When NODE_ENV === 'production':
 *   - JWT_SECRET environment variable is strictly mandatory.
 *   - Fails fast (throws Error) if missing, empty, or insufficiently strong (< 32 chars).
 *   - The secret is never exposed in logs, error messages, or API responses.
 * - In non-production environments (development / test):
 *   - Uses process.env.JWT_SECRET if provided.
 *   - Falls back safely to the development key if not specified, preserving existing local tests.
 * - All modules (authController, auth middleware, socketService) import from this single source of truth.
 */

const DEV_FALLBACK_SECRET = 'bookloop_jwt_secret_editorial_2026_secure_key';
const MIN_SECRET_LENGTH = 32;

/**
 * Validates and resolves the JWT secret based on the current environment.
 * Throws a fatal error in production if the secret is missing or insufficiently strong.
 */
function resolveJwtSecret() {
  const isProd = process.env.NODE_ENV === 'production';
  const rawSecret = process.env.JWT_SECRET;

  if (isProd) {
    if (!rawSecret || typeof rawSecret !== 'string' || !rawSecret.trim()) {
      throw new Error(
        '[FATAL] Production startup error: JWT_SECRET environment variable is mandatory when NODE_ENV=production. The application cannot start securely.'
      );
    }

    const trimmed = rawSecret.trim();
    if (trimmed.length < MIN_SECRET_LENGTH) {
      throw new Error(
        `[FATAL] Production startup error: JWT_SECRET is insufficiently strong (must be at least ${MIN_SECRET_LENGTH} characters long, received ${trimmed.length}). The application cannot start.`
      );
    }

    return trimmed;
  }

  // Development & Test environments
  if (rawSecret && typeof rawSecret === 'string' && rawSecret.trim()) {
    return rawSecret.trim();
  }

  return DEV_FALLBACK_SECRET;
}

module.exports = {
  get JWT_SECRET() {
    return resolveJwtSecret();
  },
  resolveJwtSecret,
  MIN_SECRET_LENGTH,
};
