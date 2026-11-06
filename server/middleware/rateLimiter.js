/**
 * Lightweight in-memory rate limiter for authentication endpoints.
 * Protects against brute-force password guessing and registration spam.
 */
const rateLimit = ({
  windowMs = 15 * 60 * 1000, // 15 minutes default
  max = 100,                  // 100 requests per window
  message = 'Too many authentication attempts. Please try again later.',
} = {}) => {
  const requests = new Map();

  // Clean expired buckets every 5 minutes
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of requests.entries()) {
      if (now > data.resetTime) {
        requests.delete(ip);
      }
    }
  }, 5 * 60 * 1000);
  interval.unref();

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const record = requests.get(ip);
    if (!record || now > record.resetTime) {
      requests.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    record.count += 1;
    if (record.count > max) {
      const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        success: false,
        error: message,
      });
    }

    next();
  };
};

module.exports = rateLimit;

