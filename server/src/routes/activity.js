import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import ActivityLog from '../models/ActivityLog.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

router.get(
  '/',
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const q = { userId: req.user.id };
    if (req.query.from || req.query.to) {
      q.dayKey = {};
      if (req.query.from) q.dayKey.$gte = req.query.from.slice(0, 10);
      if (req.query.to) q.dayKey.$lte = req.query.to.slice(0, 10);
    }
    const logs = await ActivityLog.find(q).sort({ dayKey: -1 }).limit(90).lean();
    res.json({ logs });
  }
);

router.put(
  '/:dayKey',
  param('dayKey').matches(/^\d{4}-\d{2}-\d{2}$/),
  body('steps').optional().isInt({ min: 0 }),
  body('activeCalories').optional().isFloat({ min: 0 }),
  body('exerciseMinutes').optional().isFloat({ min: 0 }),
  body('note').optional().trim(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { dayKey } = req.params;
    const { steps, activeCalories, exerciseMinutes, note } = req.body;
    const log = await ActivityLog.findOneAndUpdate(
      { userId: req.user.id, dayKey },
      {
        $set: {
          ...(steps !== undefined && { steps }),
          ...(activeCalories !== undefined && { activeCalories }),
          ...(exerciseMinutes !== undefined && { exerciseMinutes }),
          ...(note !== undefined && { note }),
          source: 'manual',
        },
        $setOnInsert: { userId: req.user.id, dayKey },
      },
      { new: true, upsert: true }
    );
    res.json({ log });
  }
);

export default router;
