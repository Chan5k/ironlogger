import mongoose from 'mongoose';
import Workout from '../models/Workout.js';
import User from '../models/User.js';
import ProfileFollow from '../models/ProfileFollow.js';
import {
  addCalendarDays,
  computeCurrentStreak,
  dateKeyInTimeZone,
} from './trainingStreak.js';

function oid(id) {
  return new mongoose.Types.ObjectId(id);
}

function weekStartDate() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d;
}

/** Non-warmup volume per user in last 7 days. */
export async function leaderboardVolumeRows(userIds, skip, limit) {
  const weekAgo = weekStartDate();
  const match = {
    completedAt: { $ne: null, $gte: weekAgo },
  };
  if (userIds?.length) match.userId = { $in: userIds };

  const [rows, countAgg] = await Promise.all([
    Workout.aggregate([
      { $match: match },
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
          _id: '$userId',
          value: {
            $sum: {
              $multiply: [
                { $ifNull: ['$exercises.sets.weight', 0] },
                { $ifNull: ['$exercises.sets.reps', 0] },
              ],
            },
          },
        },
      },
      { $sort: { value: -1, _id: 1 } },
      { $skip: skip },
      { $limit: limit },
    ]),
    Workout.aggregate([
      { $match: match },
      { $unwind: '$exercises' },
      { $unwind: '$exercises.sets' },
      {
        $match: {
          $expr: {
            $ne: [{ $ifNull: ['$exercises.sets.setType', 'normal'] }, 'warmup'],
          },
        },
      },
      { $group: { _id: '$userId' } },
      { $count: 'n' },
    ]),
  ]);

  const totalUsers = countAgg[0]?.n ?? 0;
  return { rows: rows.map((r) => ({ userId: r._id, value: Math.round(r.value || 0) })), totalUsers };
}

/** Completed workout count per user in last 7 days. */
export async function leaderboardWorkoutCountRows(userIds, skip, limit) {
  const weekAgo = weekStartDate();
  const match = {
    completedAt: { $ne: null, $gte: weekAgo },
  };
  if (userIds?.length) match.userId = { $in: userIds };

  const [rows, countAgg] = await Promise.all([
    Workout.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$userId',
          value: { $sum: 1 },
        },
      },
      { $sort: { value: -1, _id: 1 } },
      { $skip: skip },
      { $limit: limit },
    ]),
    Workout.aggregate([{ $match: match }, { $group: { _id: '$userId' } }, { $count: 'n' }]),
  ]);

  const totalUsers = countAgg[0]?.n ?? 0;
  return { rows: rows.map((r) => ({ userId: r._id, value: r.value })), totalUsers };
}

/** Distinct UTC calendar days with a completion in the last 7 days (global-friendly). */
export async function leaderboardActiveDaysRows(userIds, skip, limit) {
  const weekAgo = weekStartDate();
  const match = {
    completedAt: { $ne: null, $gte: weekAgo },
  };
  if (userIds?.length) match.userId = { $in: userIds };

  const [rows, countAgg] = await Promise.all([
    Workout.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            u: '$userId',
            d: {
              $dateToString: { format: '%Y-%m-%d', date: '$completedAt', timezone: 'UTC' },
            },
          },
        },
      },
      {
        $group: {
          _id: '$_id.u',
          value: { $sum: 1 },
        },
      },
      { $sort: { value: -1, _id: 1 } },
      { $skip: skip },
      { $limit: limit },
    ]),
    Workout.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            u: '$userId',
            d: {
              $dateToString: { format: '%Y-%m-%d', date: '$completedAt', timezone: 'UTC' },
            },
          },
        },
      },
      { $group: { _id: '$_id.u' } },
      { $count: 'n' },
    ]),
  ]);

  const totalUsers = countAgg[0]?.n ?? 0;
  return { rows: rows.map((r) => ({ userId: r._id, value: r.value })), totalUsers };
}

/** Current training-day streak (user timezone) for a bounded user list. */
export async function leaderboardStreakRowsFollowing(userIds, skip, limit) {
  if (!userIds?.length) return { rows: [], totalUsers: 0 };

  const since = new Date();
  since.setDate(since.getDate() - 400);

  const users = await User.find({ _id: { $in: userIds } })
    .select('timezone')
    .lean();
  const tzByUser = new Map(users.map((u) => [u._id.toString(), u.timezone || 'UTC']));

  const workouts = await Workout.find({
    userId: { $in: userIds },
    completedAt: { $ne: null, $gte: since },
  })
    .select('userId completedAt')
    .lean();

  const daysByUser = new Map();
  for (const uid of userIds) {
    daysByUser.set(uid.toString(), new Set());
  }
  for (const w of workouts) {
    const uid = w.userId.toString();
    const tz = tzByUser.get(uid) || 'UTC';
    const k = dateKeyInTimeZone(new Date(w.completedAt), tz);
    const set = daysByUser.get(uid);
    if (set) set.add(k);
  }

  const now = new Date();
  const scored = [];
  for (const uid of userIds) {
    const idStr = uid.toString();
    const tz = tzByUser.get(idStr) || 'UTC';
    const trainingDays = daysByUser.get(idStr) || new Set();
    const todayKey = dateKeyInTimeZone(now, tz);
    const yesterdayKey = addCalendarDays(todayKey, -1);
    const value = computeCurrentStreak(trainingDays, todayKey, yesterdayKey);
    scored.push({ userId: uid, value });
  }

  scored.sort((a, b) => b.value - a.value || String(a.userId).localeCompare(String(b.userId)));
  const totalUsers = scored.length;
  const pageRows = scored.slice(skip, skip + limit);
  return { rows: pageRows, totalUsers };
}

export async function resolveViewerFollowingIds(viewerId) {
  const follows = await ProfileFollow.find({ followerId: oid(viewerId) })
    .select('targetUserId')
    .lean();
  const ids = follows.map((f) => f.targetUserId);
  ids.push(oid(viewerId));
  return ids;
}

export async function hydrateLeaderboardRows(rows, viewerIdStr) {
  if (!rows.length) return [];
  const uids = rows.map((r) => r.userId);
  const users = await User.find({ _id: { $in: uids } })
    .select('name email')
    .lean();
  const byId = new Map(users.map((u) => [u._id.toString(), u]));

  return rows.map((r) => {
    const idStr = r.userId.toString();
    const u = byId.get(idStr);
    const name = (u?.name || '').trim() || (u?.email || '').split('@')[0] || 'Athlete';
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('')
      .slice(0, 2) || '?';
    return {
      userId: idStr,
      name,
      initials,
      value: r.value,
      isViewer: idStr === viewerIdStr,
    };
  });
}

/** Ranks are 1-based within full sorted list; re-rank after skip for display. */
export async function buildLeaderboard({ scope, metric, page, limit, viewerId }) {
  const skip = (page - 1) * limit;
  const viewerIdStr = String(viewerId);

  let userIds = null;
  if (scope === 'following') {
    userIds = await resolveViewerFollowingIds(viewerId);
  }

  let result;
  let metricNote = null;
  if (metric === 'volume') {
    result = await leaderboardVolumeRows(userIds, skip, limit);
  } else if (metric === 'workouts') {
    result = await leaderboardWorkoutCountRows(userIds, skip, limit);
  } else if (metric === 'streak') {
    if (scope === 'following') {
      result = await leaderboardStreakRowsFollowing(userIds, skip, limit);
    } else {
      result = await leaderboardActiveDaysRows(null, skip, limit);
      metricNote = 'Ranked by distinct training days in the last 7 days (UTC).';
    }
  } else {
    throw new Error('bad metric');
  }

  const entries = await hydrateLeaderboardRows(result.rows, viewerIdStr);
  const rankOffset = skip;
  const ranked = entries.map((e, i) => ({ ...e, rank: rankOffset + i + 1 }));

  return {
    entries: ranked,
    totalUsers: result.totalUsers,
    page,
    limit,
    metricNote,
    hasMore: skip + result.rows.length < result.totalUsers,
  };
}
