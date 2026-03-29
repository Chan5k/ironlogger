import User from '../models/User.js';
import { userIsFullAdmin, userIsStaff } from '../config/admin.js';

export async function staffRequired(req, res, next) {
  try {
    if (req.user.actorId) {
      return res.status(403).json({ error: 'Exit impersonation before using the admin console.' });
    }
    const user = await User.findById(req.user.id).select('email isAdmin isSupport');
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!userIsStaff(user)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.staffUser = user;
    next();
  } catch (e) {
    next(e);
  }
}

export async function fullAdminRequired(req, res, next) {
  try {
    if (req.user.actorId) {
      return res.status(403).json({ error: 'Exit impersonation before using the admin console.' });
    }
    const user = await User.findById(req.user.id).select('email isAdmin isSupport');
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!userIsFullAdmin(user)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  } catch (e) {
    next(e);
  }
}

/** @deprecated use staffRequired */
export async function adminRequired(req, res, next) {
  return staffRequired(req, res, next);
}
