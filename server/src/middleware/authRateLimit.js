import rateLimit from 'express-rate-limit';

/** Brute-force protection: all attempts count (failed and successful). */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again in a few minutes.' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

/** Spam signups from one network. */
export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  message: { error: 'Too many accounts created from this network. Try again later.' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

export const resendVerificationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many verification emails. Try again in a few minutes.' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
