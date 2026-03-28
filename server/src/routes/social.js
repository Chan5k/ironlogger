import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Workout from '../models/Workout.js';
import ProfileFollow from '../models/ProfileFollow.js';
import ProfileWallEntry from '../models/ProfileWallEntry.js';
import { authRequired } from '../middleware/auth.js';
import { optionalAuth } from '../middleware/optionalAuth.js';

const router = Router();

async function publicUserBySlug(slug) {
  const s = String(slug || '').toLowerCase().trim();
  if (!s) return null;
  return User.findOne({
    publicProfileEnabled: true,
    publicProfileSlug: s,
  })
    .select('_id name publicProfileSlug')
    .lean();
}

router.get(
  '/profile/:slug/status',
  optionalAuth,
  param('slug').trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const target = await publicUserBySlug(req.params.slug);
    if (!target) return res.status(404).json({ error: 'Profile not found' });

    const followerCount = await ProfileFollow.countDocuments({ targetUserId: target._id });
    let isFollowing = false;
    let isOwnProfile = false;
    let hasGivenKudos = false;
    if (req.user) {
      isOwnProfile = target._id.toString() === req.user.id;
      if (!isOwnProfile) {
        const f = await ProfileFollow.findOne({
          followerId: req.user.id,
          targetUserId: target._id,
        }).lean();
        isFollowing = !!f;
        const k = await ProfileWallEntry.findOne({
          targetUserId: target._id,
          authorId: req.user.id,
          kind: 'kudos',
        }).lean();
        hasGivenKudos = !!k;
      }
    }
    res.json({ followerCount, isFollowing, isOwnProfile, hasGivenKudos });
  }
);

router.post('/follow/:slug', authRequired, param('slug').trim().notEmpty(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const target = await publicUserBySlug(req.params.slug);
  if (!target) return res.status(404).json({ error: 'Profile not found' });
  if (target._id.toString() === req.user.id) {
    return res.status(400).json({ error: 'Cannot follow yourself' });
  }
  try {
    await ProfileFollow.create({ followerId: req.user.id, targetUserId: target._id });
  } catch (e) {
    if (e.code === 11000) return res.status(200).json({ ok: true, already: true });
    throw e;
  }
  res.status(201).json({ ok: true });
});

router.delete('/follow/:slug', authRequired, param('slug').trim().notEmpty(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const target = await publicUserBySlug(req.params.slug);
  if (!target) return res.status(404).json({ error: 'Profile not found' });
  await ProfileFollow.deleteOne({ followerId: req.user.id, targetUserId: target._id });
  res.status(204).send();
});

/** High-level activity for people you follow (no workout titles or details). */
router.get('/feed', authRequired, async (req, res) => {
  const follows = await ProfileFollow.find({ followerId: req.user.id }).select('targetUserId').lean();
  const ids = follows.map((f) => f.targetUserId);
  if (!ids.length) {
    return res.json({ items: [] });
  }

  const since = new Date();
  since.setDate(since.getDate() - 14);

  const users = await User.find({
    _id: { $in: ids },
    publicProfileEnabled: true,
  })
    .select('name publicProfileSlug')
    .lean();

  const agg = await Workout.aggregate([
    {
      $match: {
        userId: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
        completedAt: { $ne: null, $gte: since },
      },
    },
    {
      $group: {
        _id: '$userId',
        sessions: { $sum: 1 },
        lastCompletedAt: { $max: '$completedAt' },
      },
    },
  ]);

  const byUser = new Map(agg.map((r) => [r._id.toString(), r]));
  const items = users
    .filter((u) => u.publicProfileSlug)
    .map((u) => {
      const row = byUser.get(u._id.toString());
      return {
        name: u.name || 'Athlete',
        slug: u.publicProfileSlug,
        completedSessionsLast14Days: row?.sessions ?? 0,
        lastCompletedAt: row?.lastCompletedAt ?? null,
      };
    })
    .sort((a, b) => {
      const ta = a.lastCompletedAt ? new Date(a.lastCompletedAt).getTime() : 0;
      const tb = b.lastCompletedAt ? new Date(b.lastCompletedAt).getTime() : 0;
      return tb - ta;
    });

  res.json({ items });
});

router.post(
  '/wall/:slug',
  authRequired,
  param('slug').trim().notEmpty(),
  body('kind').isIn(['kudos', 'comment']),
  body('body').optional().trim().isLength({ max: 500 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const target = await publicUserBySlug(req.params.slug);
    if (!target) return res.status(404).json({ error: 'Profile not found' });
    if (target._id.toString() === req.user.id) {
      return res.status(400).json({ error: 'Use your settings to manage your profile' });
    }

    const { kind, body: text } = req.body;
    if (kind === 'comment' && !(text || '').trim()) {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }
    if (kind === 'kudos') {
      try {
        await ProfileWallEntry.create({
          targetUserId: target._id,
          authorId: req.user.id,
          kind: 'kudos',
          body: '',
        });
      } catch (e) {
        if (e.code === 11000) return res.status(400).json({ error: 'You already sent kudos' });
        throw e;
      }
      return res.status(201).json({ ok: true });
    }

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const commentsToday = await ProfileWallEntry.countDocuments({
      targetUserId: target._id,
      authorId: req.user.id,
      kind: 'comment',
      createdAt: { $gte: dayStart },
    });
    if (commentsToday >= 20) {
      return res.status(429).json({ error: 'Daily comment limit reached for this profile' });
    }

    const entry = await ProfileWallEntry.create({
      targetUserId: target._id,
      authorId: req.user.id,
      kind: 'comment',
      body: text.trim(),
    });
    res.status(201).json({ entry: { id: entry._id, createdAt: entry.createdAt } });
  }
);

router.delete(
  '/wall/:slug/:entryId',
  authRequired,
  param('slug').trim().notEmpty(),
  param('entryId').isMongoId(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const target = await publicUserBySlug(req.params.slug);
    if (!target) return res.status(404).json({ error: 'Profile not found' });

    const entry = await ProfileWallEntry.findById(req.params.entryId);
    if (!entry || entry.targetUserId.toString() !== target._id.toString()) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    const isAuthor = entry.authorId.toString() === req.user.id;
    const isOwner = target._id.toString() === req.user.id;
    if (!isAuthor && !isOwner) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    await ProfileWallEntry.deleteOne({ _id: entry._id });
    res.status(204).send();
  }
);

export default router;
