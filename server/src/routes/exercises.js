import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import Exercise, { EXERCISE_CATEGORIES } from '../models/Exercise.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

router.get('/', query('category').optional().isIn(EXERCISE_CATEGORIES), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { category } = req.query;
  const filter = {
    $or: [{ isGlobal: true }, { userId: req.user.id }],
  };
  if (category) filter.category = category;
  const exercises = await Exercise.find(filter).sort({ category: 1, name: 1 }).lean();
  res.json({ exercises });
});

router.post(
  '/',
  body('name').trim().notEmpty(),
  body('category').isIn(EXERCISE_CATEGORIES),
  body('notes').optional().trim(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { name, category, notes } = req.body;
    const ex = await Exercise.create({
      name,
      category,
      notes: notes || '',
      userId: req.user.id,
      isGlobal: false,
    });
    res.status(201).json({ exercise: ex });
  }
);

router.patch(
  '/:id',
  param('id').isMongoId(),
  body('name').optional().trim().notEmpty(),
  body('category').optional().isIn(EXERCISE_CATEGORIES),
  body('notes').optional().trim(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const ex = await Exercise.findOne({ _id: req.params.id, userId: req.user.id });
    if (!ex) return res.status(404).json({ error: 'Exercise not found or not editable' });
    const { name, category, notes } = req.body;
    if (name !== undefined) ex.name = name;
    if (category !== undefined) ex.category = category;
    if (notes !== undefined) ex.notes = notes;
    await ex.save();
    res.json({ exercise: ex });
  }
);

router.delete('/:id', param('id').isMongoId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const r = await Exercise.deleteOne({ _id: req.params.id, userId: req.user.id });
  if (r.deletedCount === 0) {
    return res.status(404).json({ error: 'Exercise not found or not deletable' });
  }
  res.status(204).send();
});

export default router;
