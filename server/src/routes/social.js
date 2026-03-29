import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Workout from '../models/Workout.js';
import ProfileFollow from '../models/ProfileFollow.js';
import ProfileWallEntry from '../models/ProfileWallEntry.js';
import WorkoutLike from '../models/WorkoutLike.js';
import Notification from '../models/Notification.js';
import { authRequired } from '../middleware/auth.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { buildLeaderboard } from '../lib/leaderboards.js';
import {
  addWorkoutComment,
  fetchActivityFeed,
  listWorkoutComments,
} from '../lib/activityFeed.js';

const router = Router();

function asObjectId(id) {
  if (id == null) return id;
  const s = String(id);
  return mongoose.Types.ObjectId.isValid(s) ? new mongoose.Types.ObjectId(s) : id;
}

function weekKeyUTC() {
  const d = new Date();
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${weekNo}`;
}

async function maybeNotifyLeaderboardSpot(viewerId, rank, metric, scope) {
  if (scope !== 'global' || rank > 10 || rank < 1) return;
  const wk = weekKeyUTC();
  const existing = await Notification.findOne({
    userId: asObjectId(viewerId),
    type: 'leaderboard_top',
    'payload.weekKey': wk,
    'payload.metric': metric,
  }).lean();
  if (existing) return;
  await Notification.create({
    userId: asObjectId(viewerId),
    type: 'leaderboard_top',
    title: 'Leaderboard spotlight',
    body: `You're #${rank} on the ${metric} leaderboard this week.`,
    payload: { weekKey: wk, metric, rank, scope },
  });
}

async function attachLikeInfoToFeedItems(items, viewerId) {
  const workoutIds = [];
  for (const row of items) {
    for (const w of row.recentWorkouts || []) {
      if (w.id) workoutIds.push(w.id);
    }
  }
  if (!workoutIds.length) return items;
  const oids = workoutIds.map((id) => new mongoose.Types.ObjectId(id));
  const [counts, liked] = await Promise.all([
    WorkoutLike.aggregate([
      { $match: { workoutId: { $in: oids } } },
      { $group: { _id: '$workoutId', n: { $sum: 1 } } },
    ]),
    WorkoutLike.find({ userId: asObjectId(viewerId), workoutId: { $in: oids } })
      .select('workoutId')
      .lean(),
  ]);
  const countMap = new Map(counts.map((c) => [c._id.toString(), c.n]));
  const likedSet = new Set(liked.map((l) => l.workoutId.toString()));
  return items.map((row) => ({
    ...row,
    recentWorkouts: (row.recentWorkouts || []).map((w) => ({
      ...w,
      likeCount: countMap.get(w.id) ?? 0,
      likedByMe: likedSet.has(w.id),
    })),
  }));
}

async function canLikeWorkout(viewerId, workout) {
  if (!workout?.completedAt) return false;
  if (workout.userId.toString() === String(viewerId)) return false;
  const ownerId = workout.userId;
  const [owner, follows] = await Promise.all([
    User.findById(ownerId).select('publicProfileEnabled').lean(),
    ProfileFollow.findOne({
      followerId: asObjectId(viewerId),
      targetUserId: ownerId,
    }).lean(),
  ]);
  if (follows) return true;
  if (owner?.publicProfileEnabled) return true;
  return false;
}

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
          followerId: asObjectId(req.user.id),
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

  const reciprocal = req.body?.reciprocal === true;

  const me = asObjectId(req.user.id);
  let alreadyFollowing = false;
  try {
    await ProfileFollow.create({ followerId: me, targetUserId: target._id });
  } catch (e) {
    if (e.code === 11000) alreadyFollowing = true;
    else throw e;
  }

  /** Friend-invite links: also follow back so both people appear in each other’s Following feed. */
  if (reciprocal) {
    try {
      await ProfileFollow.create({ followerId: target._id, targetUserId: me });
    } catch (e) {
      if (e.code !== 11000) throw e;
    }
  }

  if (alreadyFollowing) return res.status(200).json({ ok: true, already: true });
  res.status(201).json({ ok: true });
});

router.delete('/follow/:slug', authRequired, param('slug').trim().notEmpty(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const target = await publicUserBySlug(req.params.slug);
  if (!target) return res.status(404).json({ error: 'Profile not found' });
  await ProfileFollow.deleteOne({ followerId: asObjectId(req.user.id), targetUserId: target._id });
  res.status(204).send();
});

/** Unfollow by target user id (works when they have no public slug or profile is off). */
router.delete(
  '/following/:targetUserId',
  authRequired,
  param('targetUserId').isMongoId(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const tid = asObjectId(req.params.targetUserId);
    if (tid.toString() === String(req.user.id)) {
      return res.status(400).json({ error: 'Invalid target' });
    }
    const r = await ProfileFollow.deleteOne({
      followerId: asObjectId(req.user.id),
      targetUserId: tid,
    });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'Not following this user' });
    res.status(204).send();
  }
);

const FEED_RECENT_WORKOUTS = 5;

/** Activity for people you follow: session counts plus last completed workouts (title & timing only). */
router.get('/feed', authRequired, async (req, res) => {
  const follows = await ProfileFollow.find({ followerId: asObjectId(req.user.id) })
    .select('targetUserId')
    .lean();
  const ids = follows.map((f) => f.targetUserId);
  if (!ids.length) {
    return res.json({ items: [] });
  }

  const since = new Date();
  since.setDate(since.getDate() - 14);
  const oidIds = ids.map((id) => new mongoose.Types.ObjectId(id));

  const users = await User.find({ _id: { $in: ids } })
    .select('name publicProfileSlug publicProfileEnabled')
    .lean();
  const userById = new Map(users.map((u) => [u._id.toString(), u]));

  const [agg, recentAgg] = await Promise.all([
    Workout.aggregate([
      {
        $match: {
          userId: { $in: oidIds },
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
    ]),
    Workout.aggregate([
      {
        $match: {
          userId: { $in: oidIds },
          completedAt: { $ne: null },
        },
      },
      { $sort: { userId: 1, completedAt: -1 } },
      {
        $group: {
          _id: '$userId',
          workouts: {
            $push: {
              id: '$_id',
              title: '$title',
              startedAt: '$startedAt',
              completedAt: '$completedAt',
            },
          },
        },
      },
      {
        $project: {
          workouts: { $slice: ['$workouts', FEED_RECENT_WORKOUTS] },
        },
      },
    ]),
  ]);

  const byUser = new Map(agg.map((r) => [r._id.toString(), r]));
  const recentByUser = new Map(
    recentAgg.map((r) => [
      r._id.toString(),
      (r.workouts || []).map((w) => ({
        id: String(w.id),
        title: w.title,
        startedAt: w.startedAt,
        completedAt: w.completedAt,
      })),
    ])
  );

  /** One row per follow edge, same order as ProfileFollow, so new friends always appear. */
  const items = ids
    .map((id) => {
      const idStr = id.toString();
      const u = userById.get(idStr);
      if (!u) return null;
      const row = byUser.get(idStr);
      return {
        userId: idStr,
        name: u.name || 'Athlete',
        slug: u.publicProfileSlug || null,
        profilePublic: !!u.publicProfileEnabled,
        completedSessionsLast14Days: row?.sessions ?? 0,
        lastCompletedAt: row?.lastCompletedAt ?? null,
        recentWorkouts: recentByUser.get(idStr) ?? [],
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const ta = a.lastCompletedAt ? new Date(a.lastCompletedAt).getTime() : 0;
      const tb = b.lastCompletedAt ? new Date(b.lastCompletedAt).getTime() : 0;
      return tb - ta;
    });

  const withLikes = await attachLikeInfoToFeedItems(items, req.user.id);
  res.json({ items: withLikes });
});

router.get(
  '/activity-feed',
  authRequired,
  query('scope').isIn(['following', 'global']),
  query('sort').optional().isIn(['latest', 'top']),
  query('page').optional().isInt({ min: 1, max: 500 }),
  query('limit').optional().isInt({ min: 1, max: 30 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const data = await fetchActivityFeed({
        viewerId: req.user.id,
        scope: req.query.scope,
        sort: req.query.sort || 'latest',
        page: Number(req.query.page) || 1,
        limit: Math.min(Number(req.query.limit) || 12, 30),
      });
      res.json(data);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Feed failed' });
    }
  }
);

router.get(
  '/workouts/:workoutId/comments',
  authRequired,
  param('workoutId').isMongoId(),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('before').optional({ values: 'falsy' }).isISO8601(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const limit = Number(req.query.limit) || 25;
    const result = await listWorkoutComments(req.params.workoutId, req.user.id, {
      limit,
      before: req.query.before,
    });
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  }
);

router.post(
  '/workouts/:workoutId/comments',
  authRequired,
  param('workoutId').isMongoId(),
  body('body').trim().notEmpty().isLength({ min: 1, max: 800 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const out = await addWorkoutComment(req.params.workoutId, req.user.id, req.body.body);
    if (out.error) {
      const code = out.error === 'Workout not found' ? 404 : 403;
      return res.status(code).json({ error: out.error });
    }
    res.status(201).json(out);
  }
);

router.get(
  '/leaderboards',
  authRequired,
  query('metric').isIn(['volume', 'workouts', 'streak']),
  query('scope').isIn(['following', 'global']),
  query('page').optional().isInt({ min: 1, max: 500 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    try {
      const data = await buildLeaderboard({
        scope: req.query.scope,
        metric: req.query.metric,
        page,
        limit,
        viewerId: req.user.id,
      });
      if (page === 1 && req.query.scope === 'global') {
        const selfRow = data.entries.find((e) => e.isViewer);
        if (selfRow && selfRow.rank <= 10) {
          await maybeNotifyLeaderboardSpot(req.user.id, selfRow.rank, req.query.metric, 'global');
        }
      }
      res.json(data);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Leaderboard failed' });
    }
  }
);

router.get(
  '/workouts/:workoutId/likes',
  authRequired,
  param('workoutId').isMongoId(),
  query('preview').optional().isInt({ min: 1, max: 20 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const wid = req.params.workoutId;
    const w = await Workout.findById(wid).select('userId completedAt title').lean();
    if (!w || !w.completedAt) return res.status(404).json({ error: 'Workout not found' });
    const own = w.userId.toString() === req.user.id;
    if (!own && !(await canLikeWorkout(req.user.id, w))) {
      return res.status(403).json({ error: 'Not allowed to view likes' });
    }
    const previewLimit = Number(req.query.preview) || 8;
    const [likeCount, likedByMe, preview] = await Promise.all([
      WorkoutLike.countDocuments({ workoutId: w._id }),
      WorkoutLike.findOne({ workoutId: w._id, userId: asObjectId(req.user.id) }).lean(),
      WorkoutLike.find({ workoutId: w._id })
        .sort({ createdAt: -1 })
        .limit(previewLimit)
        .populate('userId', 'name email')
        .lean(),
    ]);
    res.json({
      likeCount,
      likedByMe: !!likedByMe,
      likers: preview.map((row) => {
        const u = row.userId;
        const name = (u?.name || '').trim() || (u?.email || '').split('@')[0] || 'Athlete';
        const initials = name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((p) => p[0]?.toUpperCase())
          .join('')
          .slice(0, 2) || '?';
        return { userId: u?._id?.toString(), name, initials };
      }),
    });
  }
);

router.post(
  '/workouts/:workoutId/like',
  authRequired,
  param('workoutId').isMongoId(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const wid = asObjectId(req.params.workoutId);
    const w = await Workout.findById(wid).select('userId title completedAt').lean();
    if (!w || !w.completedAt) return res.status(404).json({ error: 'Workout not found' });
    if (!(await canLikeWorkout(req.user.id, w))) {
      return res.status(403).json({ error: 'You cannot like this workout' });
    }
    let created = false;
    try {
      await WorkoutLike.create({ userId: asObjectId(req.user.id), workoutId: wid });
      created = true;
    } catch (e) {
      if (e.code !== 11000) throw e;
    }
    const likeCount = await WorkoutLike.countDocuments({ workoutId: wid });
    if (created && w.userId.toString() !== req.user.id) {
      const liker = await User.findById(req.user.id).select('name email').lean();
      const likerName = (liker?.name || '').trim() || (liker?.email || '').split('@')[0] || 'Someone';
      await Notification.create({
        userId: w.userId,
        type: 'workout_like',
        title: 'Workout liked',
        body: `${likerName} liked “${w.title}”.`,
        payload: { workoutId: String(wid), actorId: String(req.user.id) },
      });
    }
    res.status(created ? 201 : 200).json({ ok: true, likeCount, likedByMe: true });
  }
);

router.delete(
  '/workouts/:workoutId/like',
  authRequired,
  param('workoutId').isMongoId(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const wid = asObjectId(req.params.workoutId);
    await WorkoutLike.deleteOne({ userId: asObjectId(req.user.id), workoutId: wid });
    const likeCount = await WorkoutLike.countDocuments({ workoutId: wid });
    res.json({ ok: true, likeCount, likedByMe: false });
  }
);

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
