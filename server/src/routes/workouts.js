import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Workout, { SET_TYPES } from '../models/Workout.js';
import Exercise from '../models/Exercise.js';
import WorkoutTemplate from '../models/WorkoutTemplate.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

function normalizeSetType(t) {
  return SET_TYPES.includes(t) ? t : 'normal';
}

/** Sets counted toward load / PR stats (warm-ups excluded). */
function isCountingSet(s) {
  return normalizeSetType(s?.setType) !== 'warmup';
}

router.get(
  '/',
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('skip').optional().isInt({ min: 0 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const limit = Number(req.query.limit) || 20;
    const skip = Number(req.query.skip) || 0;
    const [workouts, total] = await Promise.all([
      Workout.find({ userId: req.user.id }).sort({ startedAt: -1 }).skip(skip).limit(limit).lean(),
      Workout.countDocuments({ userId: req.user.id }),
    ]);
    res.json({ workouts, total });
  }
);

router.get('/summary', async (req, res) => {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [totalWorkouts, weekCount, monthCount, lastWorkout, volumeAgg] = await Promise.all([
    Workout.countDocuments({ userId: req.user.id, completedAt: { $ne: null } }),
    Workout.countDocuments({
      userId: req.user.id,
      completedAt: { $gte: weekAgo },
    }),
    Workout.countDocuments({
      userId: req.user.id,
      completedAt: { $gte: monthAgo },
    }),
    Workout.findOne({ userId: req.user.id }).sort({ startedAt: -1 }).select('title startedAt completedAt').lean(),
    Workout.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user.id), completedAt: { $ne: null } } },
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
            $sum: { $multiply: ['$exercises.sets.weight', '$exercises.sets.reps'] },
          },
        },
      },
    ]),
  ]);

  const totalVolume = volumeAgg[0]?.totalVolume ?? 0;
  res.json({
    totalWorkouts,
    workoutsThisWeek: weekCount,
    workoutsThisMonth: monthCount,
    lastWorkout,
    estimatedTotalVolume: Math.round(totalVolume),
  });
});

router.get('/progress/:exerciseId', param('exerciseId').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const eid = req.params.exerciseId;
  const workouts = await Workout.find({
    userId: req.user.id,
    completedAt: { $ne: null },
    'exercises.exerciseId': new mongoose.Types.ObjectId(eid),
  })
    .sort({ startedAt: 1 })
    .select('startedAt exercises')
    .lean();

  const points = [];
  for (const w of workouts) {
    const ex = w.exercises.find((x) => x.exerciseId?.toString() === eid);
    if (!ex || !ex.sets?.length) continue;
    const countSets = ex.sets.filter(isCountingSet);
    if (!countSets.length) continue;
    const maxWeight = Math.max(...countSets.map((s) => s.weight || 0));
    const totalReps = countSets.reduce((a, s) => a + (s.reps || 0), 0);
    const volume = countSets.reduce((a, s) => a + (s.weight || 0) * (s.reps || 0), 0);
    points.push({
      date: w.startedAt,
      maxWeight,
      totalReps,
      volume,
      sets: countSets.length,
    });
  }
  res.json({ points });
});

router.get('/:id', param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const w = await Workout.findOne({ _id: req.params.id, userId: req.user.id }).lean();
  if (!w) return res.status(404).json({ error: 'Workout not found' });
  res.json({ workout: w });
});

router.post(
  '/from-template/:templateId',
  param('templateId').isMongoId(),
  body('title').optional().trim(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const template = await WorkoutTemplate.findOne({
      _id: req.params.templateId,
      userId: req.user.id,
    }).lean();
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const exercises = template.items
      .sort((a, b) => a.order - b.order)
      .map((item, order) => ({
        exerciseId: item.exerciseId,
        name: item.exerciseName,
        category: 'other',
        order,
        sets: Array.from({ length: item.defaultSets }, () => ({
          reps: item.defaultReps,
          weight: item.defaultWeight,
          completed: false,
          setType: 'normal',
        })),
      }));

    for (let i = 0; i < exercises.length; i++) {
      const exDoc = await Exercise.findById(exercises[i].exerciseId).select('category').lean();
      if (exDoc) exercises[i].category = exDoc.category;
    }

    const workout = await Workout.create({
      userId: req.user.id,
      title: req.body.title?.trim() || template.name,
      notes: '',
      templateId: template._id,
      exercises,
    });
    res.status(201).json({ workout });
  }
);

router.post(
  '/',
  body('title').trim().notEmpty(),
  body('notes').optional().trim(),
  body('exercises').optional().isArray(),
  body('exercises.*.name').optional().trim().notEmpty(),
  body('exercises.*.exerciseId').optional().isMongoId(),
  body('exercises.*.category').optional().trim(),
  body('exercises.*.sets').optional().isArray(),
  body('exercises.*.sets.*.reps').optional().isFloat({ min: 0 }),
  body('exercises.*.sets.*.weight').optional().isFloat({ min: 0 }),
  body('exercises.*.sets.*.completed').optional().isBoolean(),
  body('exercises.*.sets.*.setType').optional().isIn(SET_TYPES),
  body('startedAt').optional().isISO8601(),
  body('completedAt')
    .optional({ nullable: true })
    .custom((v) => v === null || v === undefined || !Number.isNaN(Date.parse(v))),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { title, notes, exercises: rawExercises, startedAt: bodyStarted, completedAt: bodyCompleted } =
      req.body;
    let exercises = rawExercises?.length
      ? rawExercises.map((e, order) => ({
          exerciseId: e.exerciseId ? new mongoose.Types.ObjectId(e.exerciseId) : null,
          name: e.name,
          category: e.category || 'other',
          order,
          sets: (e.sets || [{ reps: 0, weight: 0, completed: false }]).map((s) => ({
            reps: s.reps ?? 0,
            weight: s.weight ?? 0,
            completed: s.completed ?? false,
            setType: normalizeSetType(s.setType),
          })),
        }))
      : [
          {
            exerciseId: null,
            name: 'New exercise',
            category: 'other',
            order: 0,
            sets: [{ reps: 0, weight: 0, completed: false, setType: 'normal' }],
          },
        ];

    for (const ex of exercises) {
      if (ex.exerciseId) {
        const doc = await Exercise.findOne({
          _id: ex.exerciseId,
          $or: [{ isGlobal: true }, { userId: req.user.id }],
        })
          .select('name category')
          .lean();
        if (doc) {
          ex.name = doc.name;
          ex.category = doc.category;
        }
      }
    }

    const createPayload = {
      userId: req.user.id,
      title,
      notes: notes || '',
      exercises,
    };
    if (bodyStarted) {
      createPayload.startedAt = new Date(bodyStarted);
    }
    if (bodyCompleted !== undefined) {
      createPayload.completedAt =
        bodyCompleted === null || bodyCompleted === '' ? null : new Date(bodyCompleted);
    }

    const workout = await Workout.create(createPayload);
    res.status(201).json({ workout });
  }
);

router.put(
  '/:id',
  param('id').isMongoId(),
  body('title').optional().trim().notEmpty(),
  body('notes').optional().trim(),
  body('startedAt').optional().isISO8601(),
  body('completedAt')
    .optional({ nullable: true })
    .custom((v) => v === null || v === undefined || !Number.isNaN(Date.parse(v))),
  body('exercises').optional().isArray(),
  body('exercises.*.name').optional().trim().notEmpty(),
  body('exercises.*.exerciseId').optional({ nullable: true }).isMongoId(),
  body('exercises.*.category').optional().trim(),
  body('exercises.*.sets').optional().isArray(),
  body('exercises.*.sets.*.setType').optional().isIn(SET_TYPES),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const workout = await Workout.findOne({ _id: req.params.id, userId: req.user.id });
    if (!workout) return res.status(404).json({ error: 'Workout not found' });

    const { title, notes, startedAt, completedAt, exercises: rawExercises } = req.body;
    if (title !== undefined) workout.title = title;
    if (notes !== undefined) workout.notes = notes;
    if (startedAt !== undefined) workout.startedAt = new Date(startedAt);
    if (completedAt !== undefined) {
      workout.completedAt = completedAt === null ? null : new Date(completedAt);
    }

    if (rawExercises) {
      workout.exercises = rawExercises.map((e, order) => ({
        exerciseId: e.exerciseId ? new mongoose.Types.ObjectId(e.exerciseId) : null,
        name: e.name,
        category: e.category || 'other',
        order,
        sets: (e.sets || []).map((s) => ({
          reps: s.reps ?? 0,
          weight: s.weight ?? 0,
          completed: s.completed ?? false,
          setType: normalizeSetType(s.setType),
        })),
      }));
    }

    await workout.save();
    res.json({ workout });
  }
);

router.delete('/:id', param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const r = await Workout.deleteOne({ _id: req.params.id, userId: req.user.id });
  if (r.deletedCount === 0) return res.status(404).json({ error: 'Workout not found' });
  res.status(204).send();
});

export default router;
