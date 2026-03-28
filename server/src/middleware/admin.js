import User from '../models/User.js';
import { userIsAdmin } from '../config/admin.js';

export async function adminRequired(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select('email isAdmin');
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!userIsAdmin(user)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  } catch (e) {
    next(e);
  }
}
