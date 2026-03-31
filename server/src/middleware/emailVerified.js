import User from '../models/User.js';
import { userIsStaff } from '../config/admin.js';
import { isEmailVerifiedUser } from '../lib/userEmailVerified.js';

/**
 * After authRequired. Staff (admin / support) bypass — same as admin console access.
 */
export async function emailVerifiedRequired(req, res, next) {
  try {
    const user = await User.findById(req.user.id)
      .select('email emailVerifiedAt isAdmin isSupport')
      .lean();
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (userIsStaff(user)) {
      return next();
    }
    if (!isEmailVerifiedUser(user)) {
      return res.status(403).json({
        error: 'Verify your email to use this feature.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }
    next();
  } catch (e) {
    next(e);
  }
}
