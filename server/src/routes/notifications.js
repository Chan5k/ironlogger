import { Router } from 'express';
import { param, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

router.get(
  '/',
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const limit = Number(req.query.limit) || 40;
    const [items, unread] = await Promise.all([
      Notification.find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Notification.countDocuments({ userId: req.user.id, readAt: null }),
    ]);
    res.json({
      notifications: items.map((n) => ({
        id: n._id,
        type: n.type,
        title: n.title,
        body: n.body,
        payload: n.payload || {},
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
      unreadCount: unread,
    });
  }
);

router.patch('/read-all', async (req, res) => {
  await Notification.updateMany(
    { userId: req.user.id, readAt: null },
    { $set: { readAt: new Date() } }
  );
  res.json({ ok: true });
});

router.patch(
  '/:id/read',
  param('id').isMongoId(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const r = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: new mongoose.Types.ObjectId(req.user.id) },
      { $set: { readAt: new Date() } },
      { new: true }
    ).lean();
    if (!r) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  }
);

export default router;
