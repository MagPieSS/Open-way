import type { Request, Response, NextFunction } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import crypto from "crypto";

// Rate limiters are shared module-level singletons, so a test file that registers and logs in
// a dozen users would trip the 10-per-15-minutes auth limit and fail for reasons unrelated to
// what it tests. Limits are skipped only under the test runner (vitest sets NODE_ENV=test).
const skipInTests = () => process.env.NODE_ENV === "test";

// Rate limiting for auth endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { message: "Too many attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
});

// General API rate limiter
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { message: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
});

// Per-user (not per-IP) limiter for review submission, to slow down spam from a single account
// regardless of IP rotation. Falls back to IP if somehow unauthenticated (route still requires auth).
export const reviewRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  message: { message: "You're submitting reviews too quickly. Please wait a bit before posting another." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.session?.userId ? `user:${req.session.userId}` : ipKeyGenerator(req.ip || "unknown")),
  skip: skipInTests,
});

// Generate CSRF token for session
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Middleware to ensure CSRF token exists in session
export function ensureCsrfToken(req: Request, _res: Response, next: NextFunction) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }
  next();
}

// CSRF validation middleware for state-changing requests
export function validateCsrf(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF for GET, HEAD, OPTIONS (safe methods)
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Skip CSRF for unauthenticated users (register/login handle their own protection via rate limiting)
  if (!req.session.userId) {
    return next();
  }

  const csrfToken = req.headers["x-csrf-token"] as string;

  if (!csrfToken || csrfToken !== req.session.csrfToken) {
    return res.status(403).json({ message: "Invalid security token. Please refresh and try again." });
  }

  next();
}
