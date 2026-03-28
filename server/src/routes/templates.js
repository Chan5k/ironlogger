import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import WorkoutTemplate from '../models/WorkoutTemplate.js';
import Exercise from '../models/Exercise.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const templates = await WorkoutTemplate.find({ userId: req.user.id }).sort({ updatedAt: -1 }).lean();
  res.json({ templates });
});

router.get('/:id', param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const t = await WorkoutTemplate.findOne({ _id: req.params.id, userId: req.user.id }).lean();
  if (!t) return res.status(404).json({ error: 'Template not found' });
  res.json({ template: t });
});

router.post(
  '/',
  body('name').trim().notEmpty(),
  body('description').optional().trim(),
  body('items').isArray({ min: 1 }),
  body('items.*.exerciseId').isMongoId(),
  body('items.*.defaultSets').optional().isInt({ min: 1 }),
  body('items.*.defaultReps').optional().isInt({ min: 0 }),
  body('items.*.defaultWeight').optional().isFloat({ min: 0 }),
  body('items.*.itemNotes').optional().trim(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { name, description, items } = req.body;
    const ids = items.map((i) => i.exerciseId);
    const exercises = await Exercise.find({
      _id: { $in: ids },
      $or: [{ isGlobal: true }, { userId: req.user.id }],
    }).lean();
    const byId = new Map(exercises.map((e) => [e._id.toString(), e]));
    for (const i of items) {
      if (!byId.has(i.exerciseId)) {
        return res.status(400).json({ error: `Invalid exercise: ${i.exerciseId}` });
      }
    }
    const enriched = items.map((i, order) => {
      const ex = byId.get(i.exerciseId);
      return {
        exerciseId: new mongoose.Types.ObjectId(i.exerciseId),
        exerciseName: ex.name,
        defaultSets: i.defaultSets ?? 3,
        defaultReps: i.defaultReps ?? 0,
        defaultWeight: i.defaultWeight ?? 0,
        order,
        itemNotes: i.itemNotes || '',
      };
    });
    const template = await WorkoutTemplate.create({
      userId: req.user.id,
      name,
      description: description || '',
      items: enriched,
    });
    res.status(201).json({ template });
  }
);

router.put(
  '/:id',
  param('id').isMongoId(),
  body('name').trim().notEmpty(),
  body('description').optional().trim(),
  body('items').isArray({ min: 1 }),
  body('items.*.exerciseId').isMongoId(),
  body('items.*.defaultSets').optional().isInt({ min: 1 }),
  body('items.*.defaultReps').optional().isInt({ min: 0 }),
  body('items.*.defaultWeight').optional().isFloat({ min: 0 }),
  body('items.*.itemNotes').optional().trim(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const template = await WorkoutTemplate.findOne({ _id: req.params.id, userId: req.user.id });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    const { name, description, items } = req.body;
    const ids = items.map((i) => i.exerciseId);
    const exercises = await Exercise.find({
      _id: { $in: ids },
      $or: [{ isGlobal: true }, { userId: req.user.id }],
    }).lean();
    const byId = new Map(exercises.map((e) => [e._id.toString(), e]));
    for (const i of items) {
      if (!byId.has(i.exerciseId)) {
        return res.status(400).json({ error: `Invalid exercise: ${i.exerciseId}` });
      }
    }
    template.name = name;
    template.description = description ?? template.description;
    template.items = items.map((i, order) => {
      const ex = byId.get(i.exerciseId);
      return {
        exerciseId: new mongoose.Types.ObjectId(i.exerciseId),
        exerciseName: ex.name,
        defaultSets: i.defaultSets ?? 3,
        defaultReps: i.defaultReps ?? 0,
        defaultWeight: i.defaultWeight ?? 0,
        order,
        itemNotes: i.itemNotes || '',
      };
    });
    await template.save();
    res.json({ template });
  }
);

router.delete('/:id', param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const r = await WorkoutTemplate.deleteOne({ _id: req.params.id, userId: req.user.id });
  if (r.deletedCount === 0) return res.status(404).json({ error: 'Template not found' });
  res.status(204).send();
});

export default router;
