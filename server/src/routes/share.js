import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import Workout, { SET_TYPES } from '../models/Workout.js';
import WorkoutTemplate from '../models/WorkoutTemplate.js';
import ShareLink from '../models/ShareLink.js';
import { authRequired } from '../middleware/auth.js';
import {
  newShareToken,
  buildWorkoutSnapshot,
  buildTemplateSnapshot,
  resolveExerciseForUser,
} from '../lib/shareHelpers.js';

const router = Router();
router.use(authRequired);

function normalizeSetType(t) {
  return SET_TYPES.includes(t) ? t : 'normal';
}

router.post('/workouts/:id', param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const w = await Workout.findOne({ _id: req.params.id, userId: req.user.id }).lean();
  if (!w) return res.status(404).json({ error: 'Workout not found' });
  const snapshot = buildWorkoutSnapshot(w);
  const token = newShareToken();
  await ShareLink.create({
    token,
    kind: 'workout',
    ownerId: req.user.id,
    resourceId: w._id,
    snapshot,
  });
  res.status(201).json({ token, kind: 'workout' });
});

router.post('/templates/:id', param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const t = await WorkoutTemplate.findOne({ _id: req.params.id, userId: req.user.id }).lean();
  if (!t) return res.status(404).json({ error: 'Template not found' });
  const snapshot = await buildTemplateSnapshot(t);
  const token = newShareToken();
  await ShareLink.create({
    token,
    kind: 'template',
    ownerId: req.user.id,
    resourceId: t._id,
    snapshot,
  });
  res.status(201).json({ token, kind: 'template' });
});

router.post(
  '/import-workout',
  body('token').trim().isLength({ min: 10, max: 128 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const link = await ShareLink.findOne({ token: req.body.token }).lean();
    if (!link || link.kind !== 'workout') {
      return res.status(404).json({ error: 'Invalid workout share link' });
    }
    const snap = link.snapshot;
    const exercises = [];
    for (const ex of snap.exercises || []) {
      const eid = await resolveExerciseForUser(
        req.user.id,
        ex.sourceExerciseId,
        ex.name,
        ex.category
      );
      exercises.push({
        exerciseId: eid,
        name: ex.name,
        category: ex.category || 'other',
        order: ex.order ?? exercises.length,
        sets: (ex.sets || []).map((s) => ({
          reps: s.reps ?? 0,
          weight: s.weight ?? 0,
          completed: false,
          setType: normalizeSetType(s.setType),
        })),
      });
    }
    const workout = await Workout.create({
      userId: req.user.id,
      title: snap.title ? `Copy of ${snap.title}` : 'Imported workout',
      notes: snap.notes || '',
      exercises,
      completedAt: null,
      startedAt: new Date(),
    });
    res.status(201).json({ workout });
  }
);

router.post(
  '/import-template',
  body('token').trim().isLength({ min: 10, max: 128 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const link = await ShareLink.findOne({ token: req.body.token }).lean();
    if (!link || link.kind !== 'template') {
      return res.status(404).json({ error: 'Invalid plan share link' });
    }
    const snap = link.snapshot;
    const items = [];
    for (const it of snap.items || []) {
      const eid = await resolveExerciseForUser(
        req.user.id,
        it.sourceExerciseId,
        it.exerciseName,
        it.category
      );
      items.push({
        exerciseId: eid,
        exerciseName: it.exerciseName,
        defaultSets: it.defaultSets ?? 3,
        defaultReps: it.defaultReps ?? 0,
        defaultWeight: it.defaultWeight ?? 0,
        order: it.order ?? items.length,
        itemNotes: it.itemNotes || '',
      });
    }
    const template = await WorkoutTemplate.create({
      userId: req.user.id,
      name: snap.name ? `Copy of ${snap.name}` : 'Imported plan',
      description: snap.description || '',
      items,
    });
    res.status(201).json({ template });
  }
);

router.delete('/:token', param('token').trim().isLength({ min: 10, max: 128 }), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const r = await ShareLink.deleteOne({ token: req.params.token, ownerId: req.user.id });
  if (r.deletedCount === 0) return res.status(404).json({ error: 'Share link not found' });
  res.status(204).send();
});

export default router;
