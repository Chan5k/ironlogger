import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { authRequired } from '../middleware/auth.js';
import { generateWorkoutReview } from '../lib/aiWorkoutReview.js';
import { generateProgressReview } from '../lib/aiProgressReview.js';

const router = Router();
router.use(authRequired);

const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many AI requests. Please wait a moment and try again.' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
router.use(aiRateLimiter);

router.post(
  '/review-workout',
  body('workoutId').isMongoId(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const result = await generateWorkoutReview(req.body.workoutId, req.user.id);
      if (!result) {
        return res.status(404).json({ error: 'Workout not found or not completed' });
      }
      res.json(result);
    } catch (e) {
      console.error('AI workout review error', e.message || e);
      res.status(500).json({
        summary: 'Workout logged successfully.',
        highlights: ['Your session was recorded.'],
        risks: [],
        coaching: ['Keep tracking workouts to unlock smarter feedback.'],
        score: 75,
        tone: 'encouraging',
      });
    }
  }
);

router.post(
  '/review-progress',
  body('days').isInt({ min: 7, max: 90 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const result = await generateProgressReview(req.user.id, Number(req.body.days));
      res.json(result);
    } catch (e) {
      console.error('AI progress review error', e.message || e);
      res.status(500).json({
        summary: 'Your progress data is available.',
        progressWins: ['You are building consistency.'],
        concerns: [],
        coaching: ['Keep logging workouts regularly.'],
        nextFocus: 'Stay consistent this week.',
        score: 75,
        tone: 'encouraging',
      });
    }
  }
);

export default router;
