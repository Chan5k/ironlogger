import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Goal, { GOAL_TYPES } from '../models/Goal.js';
import Workout from '../models/Workout.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

function normalizeSetType(t) {
  return t === 'warmup' || t === 'failure' || t === 'normal' ? t : 'normal';
}

function isCountingSet(s) {
  return normalizeSetType(s?.setType) !== 'warmup';
}

async function rolling7dVolumeKgReps(userId) {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const rows = await Workout.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        completedAt: { $ne: null, $gte: weekAgo, $lte: now },
      },
    },
    { $unwind: '$exercises' },
    { $unwind: '$exercises.sets' },
    {
      $match: {
        $expr: {
          $ne: [{ $ifNull: ['$exercises.sets.setType', 'normal'] }, 'warmup'],
        },
      },
    },
    {
      $group: {
        _id: null,
        totalVolume: {
          $sum: {
            $multiply: [
              { $ifNull: ['$exercises.sets.weight', 0] },
              { $ifNull: ['$exercises.sets.reps', 0] },
            ],
          },
        },
      },
    },
  ]);
  return Math.round(rows[0]?.totalVolume ?? 0);
}

async function strengthMaxWeight(userId, exerciseNameKey) {
  if (!exerciseNameKey) return 0;
  const workouts = await Workout.find({
    userId,
    completedAt: { $ne: null },
  })
    .select('exercises')
    .lean();
  let maxW = 0;
  for (const w of workouts) {
    for (const ex of w.exercises || []) {
      if ((ex.name || '').trim().toLowerCase() !== exerciseNameKey) continue;
      for (const s of ex.sets || []) {
        if (!isCountingSet(s) || !s.completed) continue;
        const wv = Number(s.weight) || 0;
        if (wv > maxW) maxW = wv;
      }
    }
  }
  return maxW;
}

async function enrichGoal(goalDoc, userId) {
  const goal = goalDoc.toObject ? goalDoc.toObject() : { ...goalDoc };
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  if (goal.completedAt) {
    return {
      ...goal,
      currentValue: goal.targetValue,
      progressPct: 100,
      isCompleted: true,
      isOverdue: !!(goal.deadline && new Date(goal.deadline) < now && !goal.completedAt),
    };
  }

  let currentValue = 0;
  let isCompleted = false;

  if (goal.type === 'frequency') {
    currentValue = await Workout.countDocuments({
      userId,
      completedAt: { $ne: null, $gte: weekAgo },
    });
    isCompleted = currentValue >= goal.targetValue;
  } else if (goal.type === 'volume') {
    currentValue = await rolling7dVolumeKgReps(userId);
    isCompleted = currentValue >= goal.targetValue;
  } else if (goal.type === 'strength') {
    const key = (goal.strengthExerciseName || '').trim().toLowerCase();
    currentValue = await strengthMaxWeight(userId, key);
    isCompleted = goal.targetValue > 0 && currentValue >= goal.targetValue;
  }

  const target = Math.max(0, Number(goal.targetValue) || 0);
  let progressPct = 0;
  if (target > 0) {
    progressPct = Math.min(100, Math.round((currentValue / target) * 1000) / 10);
  } else if (isCompleted) {
    progressPct = 100;
  }

  const deadline = goal.deadline ? new Date(goal.deadline) : null;
  const isOverdue = !!(deadline && deadline < now && !isCompleted);

  return {
    ...goal,
    currentValue,
    progressPct,
    isCompleted,
    isOverdue,
  };
}

router.get('/', async (req, res) => {
  const goals = await Goal.find({ userId: req.user.id }).sort({ completedAt: 1, createdAt: -1 }).limit(100);
  const out = [];
  for (const g of goals) {
    let row = await enrichGoal(g, req.user.id);
    if (!g.completedAt && row.isCompleted) {
      const doneAt = new Date();
      await Goal.updateOne({ _id: g._id }, { $set: { completedAt: doneAt } });
      row = { ...row, completedAt: doneAt, isCompleted: true, progressPct: 100 };
    }
    out.push(row);
  }
  res.json({ goals: out });
});

router.post(
  '/',
  body('type').isIn(GOAL_TYPES),
  body('title').trim().notEmpty().isLength({ max: 200 }),
  body('targetValue').isFloat({ gt: 0 }),
  body('strengthExerciseName').optional().trim().isLength({ max: 200 }),
  body('deadline').optional().isISO8601().toDate(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { type, title, targetValue, strengthExerciseName, deadline } = req.body;
    if (type === 'strength' && !(strengthExerciseName || '').trim()) {
      return res.status(400).json({ error: 'Strength goals need an exercise name to track.' });
    }
    const g = await Goal.create({
      userId: req.user.id,
      type,
      title: title.trim(),
      targetValue: Number(targetValue),
      strengthExerciseName: type === 'strength' ? String(strengthExerciseName || '').trim() : '',
      deadline: deadline || null,
    });
    res.status(201).json({ goal: await enrichGoal(g, req.user.id) });
  }
);

router.patch(
  '/:id',
  param('id').isMongoId(),
  body('title').optional().trim().notEmpty().isLength({ max: 200 }),
  body('targetValue').optional().isFloat({ gt: 0 }),
  body('strengthExerciseName').optional().trim().isLength({ max: 200 }),
  body('deadline').optional({ nullable: true }),
  body('completedAt').optional({ nullable: true }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const g = await Goal.findOne({ _id: req.params.id, userId: req.user.id });
    if (!g) return res.status(404).json({ error: 'Goal not found' });
    const { title, targetValue, strengthExerciseName, deadline, completedAt } = req.body;
    if (title !== undefined) g.title = title.trim();
    if (targetValue !== undefined) g.targetValue = Number(targetValue);
    if (strengthExerciseName !== undefined) g.strengthExerciseName = String(strengthExerciseName).trim();
    if (deadline !== undefined) {
      g.deadline = deadline == null || deadline === '' ? null : new Date(deadline);
    }
    if (completedAt !== undefined) {
      g.completedAt = completedAt == null || completedAt === '' ? null : new Date(completedAt);
    }
    await g.save();
    res.json({ goal: await enrichGoal(g, req.user.id) });
  }
);

router.delete('/:id', param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const r = await Goal.deleteOne({ _id: req.params.id, userId: req.user.id });
  if (!r.deletedCount) return res.status(404).json({ error: 'Goal not found' });
  res.json({ ok: true });
});

export default router;
