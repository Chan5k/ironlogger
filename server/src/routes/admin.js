import { Router } from 'express';
import mongoose from 'mongoose';
import { param, query, body, validationResult } from 'express-validator';
import User from '../models/User.js';
import Workout from '../models/Workout.js';
import WorkoutTemplate from '../models/WorkoutTemplate.js';
import ActivityLog from '../models/ActivityLog.js';
import Exercise from '../models/Exercise.js';
import { authRequired } from '../middleware/auth.js';
import { adminRequired } from '../middleware/admin.js';
import { userIsAdmin } from '../config/admin.js';

const router = Router();
router.use(authRequired);
router.use(adminRequired);

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function publicUser(u) {
  if (!u) return null;
  const o = u.toObject ? u.toObject() : { ...u };
  delete o.passwordHash;
  o.isAdmin = userIsAdmin(u);
  return o;
}

router.get(
  '/users',
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('skip').optional().isInt({ min: 0 }),
  query('q').optional().trim(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const limit = Number(req.query.limit) || 25;
    const skip = Number(req.query.skip) || 0;
    const q = req.query.q;
    const filter =
      q && q.length > 0
        ? {
            $or: [
              { email: new RegExp(escapeRegex(q), 'i') },
              { name: new RegExp(escapeRegex(q), 'i') },
            ],
          }
        : {};

    const [users, total] = await Promise.all([
      User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    const ids = users.map((u) => u._id);
    const [workoutCounts, templateCounts, activityCounts] = await Promise.all([
      Workout.aggregate([
        { $match: { userId: { $in: ids } } },
        { $group: { _id: '$userId', n: { $sum: 1 } } },
      ]),
      WorkoutTemplate.aggregate([
        { $match: { userId: { $in: ids } } },
        { $group: { _id: '$userId', n: { $sum: 1 } } },
      ]),
      ActivityLog.aggregate([
        { $match: { userId: { $in: ids } } },
        { $group: { _id: '$userId', n: { $sum: 1 } } },
      ]),
    ]);

    const wMap = Object.fromEntries(workoutCounts.map((c) => [c._id.toString(), c.n]));
    const tMap = Object.fromEntries(templateCounts.map((c) => [c._id.toString(), c.n]));
    const aMap = Object.fromEntries(activityCounts.map((c) => [c._id.toString(), c.n]));

    const list = users.map((u) => {
      const id = u._id.toString();
      return {
        ...u,
        isAdmin: userIsAdmin(u),
        stats: {
          workouts: wMap[id] || 0,
          templates: tMap[id] || 0,
          activityLogs: aMap[id] || 0,
        },
      };
    });

    res.json({ users: list, total, limit, skip });
  }
);

router.get('/users/:id', param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const user = await User.findById(req.params.id).select('-passwordHash');
  if (!user) return res.status(404).json({ error: 'User not found' });

  const uid = new mongoose.Types.ObjectId(req.params.id);
  const [workoutCount, templateCount, activityCount, customExerciseCount] = await Promise.all([
    Workout.countDocuments({ userId: uid }),
    WorkoutTemplate.countDocuments({ userId: uid }),
    ActivityLog.countDocuments({ userId: uid }),
    Exercise.countDocuments({ userId: uid, isGlobal: false }),
  ]);

  res.json({
    user: publicUser(user),
    stats: {
      workouts: workoutCount,
      templates: templateCount,
      activityEntries: activityCount,
      customExercises: customExerciseCount,
    },
  });
});

router.get(
  '/users/:id/workouts',
  param('id').isMongoId(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('skip').optional().isInt({ min: 0 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const uid = req.params.id;
    const limit = Number(req.query.limit) || 30;
    const skip = Number(req.query.skip) || 0;
    const [workouts, total] = await Promise.all([
      Workout.find({ userId: uid })
        .sort({ startedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('title startedAt completedAt exercises')
        .lean(),
      Workout.countDocuments({ userId: uid }),
    ]);
    res.json({ workouts, total, limit, skip });
  }
);

router.get(
  '/users/:id/templates',
  param('id').isMongoId(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const uid = req.params.id;
    const limit = Number(req.query.limit) || 50;
    const templates = await WorkoutTemplate.find({ userId: uid })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select('name description items updatedAt createdAt')
      .lean();
    res.json({ templates });
  }
);

router.get(
  '/users/:id/activity',
  param('id').isMongoId(),
  query('limit').optional().isInt({ min: 1, max: 200 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const uid = req.params.id;
    const limit = Number(req.query.limit) || 60;
    const logs = await ActivityLog.find({ userId: uid })
      .sort({ dayKey: -1 })
      .limit(limit)
      .lean();
    res.json({ logs });
  }
);

router.patch(
  '/users/:id',
  param('id').isMongoId(),
  body('isAdmin').optional().isBoolean(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { isAdmin } = req.body;
    if (isAdmin === undefined) {
      return res.status(400).json({ error: 'No supported fields to update' });
    }

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    if (req.params.id === req.user.id && isAdmin === false) {
      return res.status(400).json({ error: 'Cannot remove your own admin flag' });
    }

    target.isAdmin = isAdmin;
    await target.save();
    res.json({ user: publicUser(target) });
  }
);

router.delete('/users/:id', param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  const uid = new mongoose.Types.ObjectId(req.params.id);
  const exists = await User.findById(uid);
  if (!exists) return res.status(404).json({ error: 'User not found' });

  await Promise.all([
    Workout.deleteMany({ userId: uid }),
    WorkoutTemplate.deleteMany({ userId: uid }),
    ActivityLog.deleteMany({ userId: uid }),
    Exercise.deleteMany({ userId: uid, isGlobal: false }),
  ]);
  await User.deleteOne({ _id: uid });
  res.status(204).send();
});

export default router;
