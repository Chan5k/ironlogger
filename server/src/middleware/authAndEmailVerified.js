import { authRequired } from './auth.js';
import { emailVerifiedRequired } from './emailVerified.js';

/** JWT auth + verified email (staff bypass inside emailVerifiedRequired). */
export function authAndEmailVerified(req, res, next) {
  authRequired(req, res, () => {
    emailVerifiedRequired(req, res, next);
  });
}
