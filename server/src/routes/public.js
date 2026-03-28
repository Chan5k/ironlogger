import { Router } from 'express';
import { param, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Workout from '../models/Workout.js';

const router = Router();

router.get('/profile/:slug', param('slug').trim().notEmpty(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const slug = String(req.params.slug).toLowerCase().trim();
  const user = await User.findOne({
    publicProfileEnabled: true,
    publicProfileSlug: slug,
  })
    .select('name weightUnit publicProfileSlug')
    .lean();
  if (!user) return res.status(404).json({ error: 'Profile not found' });

  const uid = user._id;
  const now = new Date();
  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [totalWorkouts, monthCount, volumeAgg] = await Promise.all([
    Workout.countDocuments({ userId: uid, completedAt: { $ne: null } }),
    Workout.countDocuments({
      userId: uid,
      completedAt: { $gte: monthAgo },
    }),
    Workout.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(uid), completedAt: { $ne: null } } },
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

  res.json({
    profile: {
      name: user.name || 'Athlete',
      slug: user.publicProfileSlug,
      weightUnit: user.weightUnit === 'lbs' ? 'lbs' : 'kg',
    },
    stats: {
      totalWorkouts,
      workoutsLast30Days: monthCount,
      estimatedTotalVolume: Math.round(volumeAgg[0]?.totalVolume ?? 0),
    },
  });
});

export default router;
