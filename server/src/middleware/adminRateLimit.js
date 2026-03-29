import rateLimit from 'express-rate-limit';

export const adminApiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many admin requests. Try again shortly.' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
