import type { VercelRequest, VercelResponse } from '@vercel/node';

interface RateBucket {
  timestamps: number[];
}

const ipRateBuckets = new Map<string, RateBucket>();

/**
 * Extracts client IP address from Vercel / proxy request headers.
 *
 * @param req - Incoming Vercel serverless request
 * @returns Client IP identifier string
 */
export function extractClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return '127.0.0.1';
}

/**
 * Evaluates sliding-window rate limit for a client IP address.
 *
 * @param ip - Client IP address
 * @param windowMs - Sliding window duration in milliseconds
 * @param maxRequests - Maximum allowed requests within windowMs
 * @param nowMs - Current timestamp in milliseconds
 * @returns Object indicating whether request is allowed, remaining quota, and retryAfterSeconds
 */
export function checkSlidingWindowRateLimit(
  ip: string,
  windowMs = 60_000,
  maxRequests = 25,
  nowMs = Date.now()
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const existing = ipRateBuckets.get(ip) ?? { timestamps: [] };
  const windowStart = nowMs - windowMs;
  const activeTimestamps = existing.timestamps.filter((t) => t > windowStart);

  if (activeTimestamps.length >= maxRequests) {
    const oldest = activeTimestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000));
    ipRateBuckets.set(ip, { timestamps: activeTimestamps });
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  activeTimestamps.push(nowMs);
  ipRateBuckets.set(ip, { timestamps: activeTimestamps });

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - activeTimestamps.length),
    retryAfterSeconds: 0,
  };
}

/**
 * Resets all in-memory rate limit buckets (used by unit tests).
 */
export function resetRateLimitBuckets(): void {
  ipRateBuckets.clear();
}

/**
 * Verifies the Bearer session authentication token from request headers.
 *
 * @param req - Incoming Vercel serverless request
 * @param expectedToken - Expected session token from centralized ServerConfig
 * @returns True if authenticated with a valid token
 */
export function verifyRequestAuthToken(req: VercelRequest, expectedToken: string): boolean {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    return token.length > 0 && token === expectedToken;
  }
  const customHeader = req.headers['x-session-token'];
  if (typeof customHeader === 'string') {
    return customHeader.trim() === expectedToken;
  }
  return false;
}

/**
 * Applies defensive HTTP security headers, enforces Bearer token authentication (HTTP 401),
 * and enforces sliding-window IP rate limiting (HTTP 429) on serverless endpoints.
 *
 * @param req - Incoming Vercel serverless request
 * @param res - Outgoing Vercel serverless response
 * @param options - Token and rate-limit thresholds
 * @returns True if request passed all security checks; false if an error response was already sent
 */
export function enforceApiSecurity(
  req: VercelRequest,
  res: VercelResponse,
  options: {
    expectedToken: string;
    windowMs: number;
    maxRequests: number;
  }
): boolean {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store');

  if (!verifyRequestAuthToken(req, options.expectedToken)) {
    res.status(401).json({
      error: 'Unauthorized: Missing or invalid Bearer session token.',
    });
    return false;
  }

  const clientIp = extractClientIp(req);
  const rateStatus = checkSlidingWindowRateLimit(
    clientIp,
    options.windowMs,
    options.maxRequests
  );

  res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
  res.setHeader('X-RateLimit-Remaining', String(rateStatus.remaining));

  if (!rateStatus.allowed) {
    res.setHeader('Retry-After', String(rateStatus.retryAfterSeconds));
    res.status(429).json({
      error: `Rate limit exceeded. Please retry after ${rateStatus.retryAfterSeconds} seconds.`,
    });
    return false;
  }

  return true;
}
