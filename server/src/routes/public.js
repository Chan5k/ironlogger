import { Router } from 'express';
import { param, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Workout from '../models/Workout.js';
import ShareLink from '../models/ShareLink.js';
import ProfileFollow from '../models/ProfileFollow.js';
import ProfileWallEntry from '../models/ProfileWallEntry.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { seasonRankPayloadForUser } from '../lib/rankLadder.js';

const router = Router();

/** Read-only preview of a shared workout or plan (no auth). */
router.get('/share/:token', param('token').trim().isLength({ min: 10, max: 128 }), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const link = await ShareLink.findOne({ token: req.params.token }).lean();
  if (!link) return res.status(404).json({ error: 'Share link not found or expired' });
  res.json({
    kind: link.kind,
    snapshot: link.snapshot,
    createdAt: link.createdAt,
  });
});

router.get('/profile/:slug', param('slug').trim().notEmpty(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const slug = String(req.params.slug).toLowerCase().trim();
  const user = await User.findOne({
    publicProfileEnabled: true,
    publicProfileSlug: slug,
  })
    .select('name weightUnit publicProfileSlug ladderSeasonId ladderSeasonPoints')
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

  const followerCount = await ProfileFollow.countDocuments({ targetUserId: uid });

  res.json({
    profile: {
      name: user.name || 'Athlete',
      slug: user.publicProfileSlug,
      weightUnit: user.weightUnit === 'lbs' ? 'lbs' : 'kg',
    },
    /** Current UTC-month competitive rank — visible to all visitors (no auth). */
    seasonRank: seasonRankPayloadForUser(user),
    stats: {
      totalWorkouts,
      workoutsLast30Days: monthCount,
      estimatedTotalVolume: Math.round(volumeAgg[0]?.totalVolume ?? 0),
      followerCount,
    },
  });
});

router.get(
  '/profile/:slug/wall',
  optionalAuth,
  param('slug').trim().notEmpty(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const slug = String(req.params.slug).toLowerCase().trim();
    const target = await User.findOne({
      publicProfileEnabled: true,
      publicProfileSlug: slug,
    })
      .select('_id')
      .lean();
    if (!target) return res.status(404).json({ error: 'Profile not found' });

    const limit = Number(req.query.limit) || 40;
    const entries = await ProfileWallEntry.find({ targetUserId: target._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('authorId', 'name')
      .lean();

    const viewerId = req.user?.id;
    const ownerId = target._id.toString();
    res.json({
      items: entries.map((e) => {
        const authorId = e.authorId?._id?.toString() || e.authorId?.toString?.() || '';
        const canDelete =
          !!viewerId && (viewerId === ownerId || viewerId === authorId);
        return {
          id: e._id,
          kind: e.kind,
          body: e.kind === 'comment' ? e.body : '',
          authorName: e.authorId?.name || 'Member',
          createdAt: e.createdAt,
          canDelete,
        };
      }),
    });
  }
);

export default router;
