import { Router } from 'express';
import mongoose from 'mongoose';
import { param, query, body, validationResult } from 'express-validator';
import User from '../models/User.js';
import Workout from '../models/Workout.js';
import WorkoutTemplate from '../models/WorkoutTemplate.js';
import ActivityLog from '../models/ActivityLog.js';
import Exercise from '../models/Exercise.js';
import AdminAuditLog from '../models/AdminAuditLog.js';
import { authRequired } from '../middleware/auth.js';
import { staffRequired, fullAdminRequired } from '../middleware/admin.js';
import { parseAdminEmails, userIsAdmin } from '../config/admin.js';
import { adminApiRateLimiter } from '../middleware/adminRateLimit.js';
import { logAdminAction } from '../lib/adminAudit.js';
import { currentSeasonIdUTC, seasonRankPayloadForUser } from '../lib/rankLadder.js';
import { runHevyImportBackfill } from '../lib/backfillHevyImports.js';
import { normalizeAllHevyTimestampsPending } from '../lib/backfillHevyTimestamps.js';

const router = Router();
router.use(authRequired);
router.use(adminApiRateLimiter);
router.use(staffRequired);

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

function truthyQuery(v) {
  return v === '1' || v === 'true' || v === true;
}

router.get('/dashboard', async (_req, res) => {
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [totalUsers, signups7d, signups30d, totalWorkouts, totalTemplates, totalActivityLogs] =
    await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: d7 } }),
      User.countDocuments({ createdAt: { $gte: d30 } }),
      Workout.countDocuments(),
      WorkoutTemplate.countDocuments(),
      ActivityLog.countDocuments(),
    ]);
  res.json({
    totalUsers,
    signupsLast7Days: signups7d,
    signupsLast30Days: signups30d,
    totalWorkouts,
    totalTemplates,
    totalActivityLogs,
  });
});

router.get(
  '/audit-log',
  query('limit').optional().isInt({ min: 1, max: 200 }),
  query('skip').optional().isInt({ min: 0 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const limit = Number(req.query.limit) || 50;
    const skip = Number(req.query.skip) || 0;
    const [entries, total] = await Promise.all([
      AdminAuditLog.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actorId', 'email name')
        .populate('targetUserId', 'email name')
        .lean(),
      AdminAuditLog.countDocuments(),
    ]);
    res.json({ entries, total, limit, skip });
  }
);

router.get(
  '/users',
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('skip').optional().isInt({ min: 0 }),
  query('q').optional().trim(),
  query('adminsOnly').optional(),
  query('activeWithinDays').optional().isInt({ min: 1, max: 365 }),
  query('sort').optional().isIn(['joined_desc', 'joined_asc', 'last_active_desc']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const limit = Number(req.query.limit) || 25;
    const skip = Number(req.query.skip) || 0;
    const q = req.query.q;
    const adminsOnly = truthyQuery(req.query.adminsOnly);
    const activeDays = req.query.activeWithinDays != null ? Number(req.query.activeWithinDays) : null;
    const sortParam = req.query.sort || 'joined_desc';

    const parts = [];
    if (q && q.length > 0) {
      parts.push({
        $or: [
          { email: new RegExp(escapeRegex(q), 'i') },
          { name: new RegExp(escapeRegex(q), 'i') },
        ],
      });
    }
    if (adminsOnly) {
      const envEmails = parseAdminEmails();
      const or = [{ isAdmin: true }];
      if (envEmails.length) or.push({ email: { $in: envEmails } });
      parts.push({ $or: or });
    }
    if (activeDays != null) {
      const cutoff = new Date(Date.now() - activeDays * 86400000);
      parts.push({ lastLoginAt: { $gte: cutoff } });
    }
    const filter = parts.length === 0 ? {} : parts.length === 1 ? parts[0] : { $and: parts };

    let sort = { createdAt: -1 };
    if (sortParam === 'joined_asc') sort = { createdAt: 1 };
    if (sortParam === 'last_active_desc') sort = { lastLoginAt: -1, createdAt: -1 };

    const [users, total] = await Promise.all([
      User.find(filter).select('-passwordHash -adminNotes').sort(sort).skip(skip).limit(limit).lean(),
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

  const u = publicUser(user);
  res.json({
    user: u,
    stats: {
      workouts: workoutCount,
      templates: templateCount,
      activityEntries: activityCount,
      customExercises: customExerciseCount,
    },
    seasonRank: seasonRankPayloadForUser(user),
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
  query('skip').optional().isInt({ min: 0 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const uid = req.params.id;
    const limit = Number(req.query.limit) || 50;
    const skip = Number(req.query.skip) || 0;
    const [templates, total] = await Promise.all([
      WorkoutTemplate.find({ userId: uid })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('name description items updatedAt createdAt')
        .lean(),
      WorkoutTemplate.countDocuments({ userId: uid }),
    ]);
    res.json({ templates, total, limit, skip });
  }
);

router.get(
  '/users/:id/activity',
  param('id').isMongoId(),
  query('limit').optional().isInt({ min: 1, max: 200 }),
  query('skip').optional().isInt({ min: 0 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const uid = req.params.id;
    const limit = Number(req.query.limit) || 60;
    const skip = Number(req.query.skip) || 0;
    const [logs, total] = await Promise.all([
      ActivityLog.find({ userId: uid }).sort({ dayKey: -1 }).skip(skip).limit(limit).lean(),
      ActivityLog.countDocuments({ userId: uid }),
    ]);
    res.json({ logs, total, limit, skip });
  }
);

router.patch(
  '/users/:id',
  fullAdminRequired,
  param('id').isMongoId(),
  body('isAdmin').optional().isBoolean(),
  body('isSupport').optional().isBoolean(),
  body('adminNotes').optional().isString().isLength({ max: 8000 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { isAdmin, isSupport, adminNotes } = req.body;
    if (isAdmin === undefined && isSupport === undefined && adminNotes === undefined) {
      return res.status(400).json({ error: 'No supported fields to update' });
    }

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    if (isAdmin !== undefined) {
      if (req.params.id === req.user.id && isAdmin === false) {
        return res.status(400).json({ error: 'Cannot remove your own admin flag' });
      }
      const prev = target.isAdmin;
      target.isAdmin = isAdmin;
      await logAdminAction(req.user.id, 'user.toggle_admin', {
        targetUserId: target._id,
        meta: { prev, next: isAdmin },
      });
    }
    if (isSupport !== undefined) {
      if (req.params.id === req.user.id) {
        return res.status(400).json({ error: 'Cannot change your own support flag here' });
      }
      target.isSupport = isSupport;
      await logAdminAction(req.user.id, 'user.toggle_support', {
        targetUserId: target._id,
        meta: { next: isSupport },
      });
    }
    if (adminNotes !== undefined) {
      target.adminNotes = String(adminNotes);
      await logAdminAction(req.user.id, 'user.admin_notes', {
        targetUserId: target._id,
        meta: { length: target.adminNotes.length },
      });
    }
    await target.save();
    res.json({ user: publicUser(target) });
  }
);

router.patch(
  '/users/:id/season-rank',
  fullAdminRequired,
  param('id').isMongoId(),
  body('ladderSeasonPoints').isInt({ min: 0, max: 99_999_999 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    const rawSeason = req.body.ladderSeasonId;
    let sid = currentSeasonIdUTC();
    if (rawSeason != null && String(rawSeason).trim() !== '') {
      const t = String(rawSeason).trim();
      if (!/^\d{4}-\d{2}$/.test(t)) {
        return res.status(400).json({ error: 'ladderSeasonId must be YYYY-MM (UTC month)' });
      }
      sid = t;
    }

    const before = {
      ladderSeasonId: target.ladderSeasonId || '',
      ladderSeasonPoints: Math.max(0, Number(target.ladderSeasonPoints) || 0),
    };
    const nextPts = Number(req.body.ladderSeasonPoints);

    target.ladderSeasonId = sid;
    target.ladderSeasonPoints = nextPts;
    await target.save();

    await logAdminAction(req.user.id, 'user.season_rank_set', {
      targetUserId: target._id,
      meta: {
        before,
        after: { ladderSeasonId: sid, ladderSeasonPoints: nextPts },
      },
    });

    res.json({
      user: publicUser(target),
      seasonRank: seasonRankPayloadForUser(target),
    });
  }
);

router.post(
  '/maintenance/backfill-hevy-imports',
  fullAdminRequired,
  body('fixCategories').optional().isBoolean(),
  body('awardSeasonPoints').optional().isBoolean(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const fixCategories = req.body.fixCategories !== false;
    const awardSeasonPoints = req.body.awardSeasonPoints !== false;
    const result = await runHevyImportBackfill({ fixCategories, awardSeasonPoints });
    await logAdminAction(req.user.id, 'maintenance.backfill_hevy_imports', { meta: result });
    res.json({ ok: true, result });
  }
);

router.post('/maintenance/backfill-hevy-timestamps', fullAdminRequired, async (req, res) => {
  try {
    const result = await normalizeAllHevyTimestampsPending();
    await logAdminAction(req.user.id, 'maintenance.backfill_hevy_timestamps', { meta: result });
    res.json({ ok: true, result });
  } catch (e) {
    console.error('backfill-hevy-timestamps', e);
    res.status(500).json({ error: 'Backfill failed' });
  }
});

router.delete(
  '/users/:id',
  fullAdminRequired,
  param('id').isMongoId(),
  body('confirmEmail').isEmail().normalizeEmail(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const uid = new mongoose.Types.ObjectId(req.params.id);
    const exists = await User.findById(uid);
    if (!exists) return res.status(404).json({ error: 'User not found' });

    const confirm = String(req.body.confirmEmail || '').toLowerCase().trim();
    if (confirm !== exists.email) {
      return res.status(400).json({ error: 'Email confirmation does not match this account' });
    }

    await logAdminAction(req.user.id, 'user.delete', { targetUserId: exists._id });

    await Promise.all([
      Workout.deleteMany({ userId: uid }),
      WorkoutTemplate.deleteMany({ userId: uid }),
      ActivityLog.deleteMany({ userId: uid }),
      Exercise.deleteMany({ userId: uid, isGlobal: false }),
    ]);
    await User.deleteOne({ _id: uid });
    res.status(204).send();
  }
);

export default router;
