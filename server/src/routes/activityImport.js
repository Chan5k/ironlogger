import { Router } from 'express';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';
import { activityImportRateLimiter } from '../middleware/authRateLimit.js';

const router = Router();

function hashToken(plain) {
  return crypto.createHash('sha256').update(String(plain), 'utf8').digest('hex');
}

function extractToken(req) {
  const h = req.headers.authorization;
  if (h && /^Bearer\s+\S+/i.test(h)) {
    return String(h.replace(/^Bearer\s+/i, '')).trim();
  }
  if (req.body && typeof req.body.syncToken === 'string' && req.body.syncToken.trim()) {
    return req.body.syncToken.trim();
  }
  return null;
}

/**
 * POST /api/activity/import
 * Personal token auth (not JWT). Intended for iOS Shortcuts reading Apple Health, then POSTing here.
 * Body: { syncToken? (if not Bearer), dayKey, steps?, activeCalories?, exerciseMinutes? }
 */
router.post(
  '/',
  activityImportRateLimiter,
  body('dayKey').matches(/^\d{4}-\d{2}-\d{2}$/),
  body('steps').optional().isInt({ min: 0, max: 500000 }),
  body('activeCalories').optional().isFloat({ min: 0, max: 50000 }),
  body('exerciseMinutes').optional().isFloat({ min: 0, max: 2000 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Missing token. Use Authorization: Bearer <token> or body.syncToken.' });
    }

    const tokenHash = hashToken(token);
    const user = await User.findOne({ activitySyncTokenHash: tokenHash }).select('_id');
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { dayKey } = req.body;
    const hasSteps = req.body.steps !== undefined;
    const hasKcal = req.body.activeCalories !== undefined;
    const hasMin = req.body.exerciseMinutes !== undefined;
    if (!hasSteps && !hasKcal && !hasMin) {
      return res.status(400).json({ error: 'Provide at least one of steps, activeCalories, exerciseMinutes' });
    }

    const $set = { source: 'apple_shortcut' };
    if (hasSteps) $set.steps = Number(req.body.steps);
    if (hasKcal) $set.activeCalories = Math.round(Number(req.body.activeCalories) * 10) / 10;
    if (hasMin) $set.exerciseMinutes = Math.round(Number(req.body.exerciseMinutes) * 10) / 10;

    const log = await ActivityLog.findOneAndUpdate(
      { userId: user._id, dayKey },
      { $set, $setOnInsert: { userId: user._id, dayKey } },
      { new: true, upsert: true }
    );

    res.json({
      ok: true,
      log: {
        dayKey: log.dayKey,
        steps: log.steps,
        activeCalories: log.activeCalories,
        exerciseMinutes: log.exerciseMinutes,
        source: log.source,
      },
    });
  }
);

export default router;
