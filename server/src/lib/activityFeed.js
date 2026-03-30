import mongoose from 'mongoose';
import Workout from '../models/Workout.js';
import User from '../models/User.js';
import ProfileFollow from '../models/ProfileFollow.js';
import WorkoutLike from '../models/WorkoutLike.js';
import WorkoutComment from '../models/WorkoutComment.js';

const LIKES_COLLECTION = WorkoutLike.collection.name;

const SET_TYPES = ['warmup', 'normal', 'failure'];

function isCountingSet(s) {
  const t = s?.setType || 'normal';
  return t !== 'warmup';
}

function asOid(id) {
  return new mongoose.Types.ObjectId(id);
}

function initialsFromName(name, email) {
  const n = (name || '').trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  const e = (email || '?').split('@')[0];
  return e.slice(0, 2).toUpperCase();
}

/** Rough session label from exercise categories (volume-weighted). */
function inferWorkoutType(workout) {
  const catVol = {};
  for (const ex of workout.exercises || []) {
    const c = ex.category || 'other';
    let v = 0;
    for (const s of ex.sets || []) {
      if (!isCountingSet(s)) continue;
      v += (Number(s.weight) || 0) * (Number(s.reps) || 0);
    }
    catVol[c] = (catVol[c] || 0) + v;
  }
  const t = Object.entries(catVol).reduce((a, b) => (b[1] > a[1] ? b : a), ['other', 0]);
  const dom = t[0];
  const title = (workout.title || '').toLowerCase();
  if (/push|chest|shoulder/.test(title)) return 'Push';
  if (/pull|back/.test(title)) return 'Pull';
  if (/leg|lower/.test(title)) return 'Legs';
  if (dom === 'legs') return 'Legs';
  if (['chest', 'shoulders', 'arms'].includes(dom)) return 'Push';
  if (dom === 'back') return 'Pull';
  if (dom === 'cardio') return 'Cardio';
  return 'Workout';
}

function exerciseSummaries(workout, maxEx = 5) {
  const out = [];
  const sorted = [...(workout.exercises || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const ex of sorted.slice(0, maxEx)) {
    const sets = (ex.sets || []).filter(isCountingSet);
    if (!sets.length) continue;
    const vol = sets.reduce((s, x) => s + (Number(x.weight) || 0) * (Number(x.reps) || 0), 0);
    const weights = sets.map((x) => Number(x.weight) || 0);
    const reps = sets.map((x) => Number(x.reps) || 0);
    const maxW = Math.max(...weights);
    const minW = Math.min(...weights);
    const firstR = reps[0];
    const uniformW = maxW === minW;
    const uniformR = reps.every((r) => r === firstR);
    let setsLine = '';
    if (uniformW && uniformR && sets.length > 0) {
      setsLine = `${sets.length} × ${maxW} kg × ${firstR} reps`;
    } else {
      setsLine = `${sets.length} set${sets.length !== 1 ? 's' : ''} · top ${maxW} kg`;
    }
    out.push({
      name: ex.name || 'Exercise',
      category: ex.category || 'other',
      setsLine,
      volume: Math.round(vol),
    });
  }
  return out;
}

function workoutTotals(workout) {
  let totalVol = 0;
  let totalSets = 0;
  const byEx = [];
  for (const ex of workout.exercises || []) {
    let v = 0;
    let n = 0;
    for (const s of ex.sets || []) {
      if (!isCountingSet(s)) continue;
      v += (Number(s.weight) || 0) * (Number(s.reps) || 0);
      n += 1;
    }
    if (n > 0) {
      totalVol += v;
      totalSets += n;
      byEx.push({
        name: ex.name || 'Exercise',
        category: ex.category || 'other',
        volume: Math.round(v),
      });
    }
  }
  return { totalVol: Math.round(totalVol), totalSets, byEx };
}

function durationSeconds(startedAt, completedAt) {
  if (!startedAt || !completedAt) return 0;
  return Math.max(0, Math.round((new Date(completedAt) - new Date(startedAt)) / 1000));
}

function formatDuration(sec) {
  if (sec <= 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s > 0 ? `${s}s` : ''}`.trim();
  return `${s}s`;
}

function bumpPriorLiftStats(map, eidStr, wv, rv) {
  const vol = wv * rv;
  let p = map.get(eidStr);
  if (!p) {
    p = { maxW: 0, maxVol: 0, repsByWeight: {} };
    map.set(eidStr, p);
  }
  p.maxW = Math.max(p.maxW, wv);
  p.maxVol = Math.max(p.maxVol, vol);
  const key = String(wv);
  p.repsByWeight[key] = Math.max(p.repsByWeight[key] || 0, rv);
}

/**
 * Session PRs per exerciseId: beats prior completed workouts on max weight, best-set volume, or reps at same weight.
 */
export async function detectSessionPRs(workout) {
  const uid = workout.userId;
  const completedAt = workout.completedAt;
  if (!completedAt || !workout.exercises?.length) return [];

  const priorWorkouts = await Workout.find({
    userId: new mongoose.Types.ObjectId(uid),
    completedAt: { $ne: null, $lt: new Date(completedAt) },
  })
    .select('exercises')
    .lean();

  const priorByEid = new Map();
  for (const w of priorWorkouts) {
    for (const ex of w.exercises || []) {
      const eidStr = ex.exerciseId?.toString();
      if (!eidStr) continue;
      for (const s of ex.sets || []) {
        if (!isCountingSet(s) || !s.completed) continue;
        const wv = Number(s.weight) || 0;
        const rv = Math.floor(Number(s.reps) || 0);
        bumpPriorLiftStats(priorByEid, eidStr, wv, rv);
      }
    }
  }

  const prs = [];
  const seenEid = new Set();

  for (const ex of workout.exercises || []) {
    const eid = ex.exerciseId;
    if (!eid || seenEid.has(String(eid))) continue;
    seenEid.add(String(eid));

    const sessionSets = (ex.sets || []).filter((s) => isCountingSet(s) && s.completed);
    if (!sessionSets.length) continue;

    let sMaxW = 0;
    let sMaxVol = 0;
    const sRepsByW = {};
    for (const s of sessionSets) {
      const wv = Number(s.weight) || 0;
      const rv = Math.floor(Number(s.reps) || 0);
      const vol = wv * rv;
      sMaxW = Math.max(sMaxW, wv);
      sMaxVol = Math.max(sMaxVol, vol);
      const key = String(wv);
      sRepsByW[key] = Math.max(sRepsByW[key] || 0, rv);
    }
    if (sMaxW <= 0 && sMaxVol <= 0) continue;

    const prior = priorByEid.get(String(eid)) || { maxW: 0, maxVol: 0, repsByWeight: {} };
    let detail = null;

    if (sMaxW > prior.maxW) {
      detail =
        prior.maxW > 0
          ? `+${Math.round(sMaxW - prior.maxW)} kg max`
          : 'New max weight';
    } else if (sMaxVol > prior.maxVol) {
      detail =
        prior.maxVol > 0
          ? `+${Math.round(sMaxVol - prior.maxVol)} kg best set`
          : 'New best set volume';
    } else {
      for (const [k, r] of Object.entries(sRepsByW)) {
        const prevR = prior.repsByWeight[k];
        if (prevR != null && r > prevR) {
          detail = `+${r - prevR} reps at ${k} kg`;
          break;
        }
      }
    }

    if (detail) {
      prs.push({
        exerciseName: ex.name || 'Lift',
        detail,
      });
    }
  }
  return prs.slice(0, 4);
}

export async function viewerCanSeeWorkout(viewerId, workout, ownerPublic) {
  if (!workout?.completedAt) return false;
  if (String(workout.userId) === String(viewerId)) return true;
  if (ownerPublic) return true;
  const f = await ProfileFollow.findOne({
    followerId: asOid(viewerId),
    targetUserId: workout.userId,
  }).lean();
  return !!f;
}

async function allowedUserIdsForScope(scope, viewerId) {
  const me = asOid(viewerId);
  if (scope === 'following') {
    const follows = await ProfileFollow.find({ followerId: me }).select('targetUserId').lean();
    const ids = follows.map((f) => f.targetUserId);
    ids.push(me);
    return ids;
  }
  const publicUsers = await User.find({ publicProfileEnabled: true }).select('_id').lean();
  return publicUsers.map((u) => u._id);
}

export async function fetchActivityFeed({
  viewerId,
  scope,
  sort,
  page,
  limit,
}) {
  const allowedIds = await allowedUserIdsForScope(scope, viewerId);
  if (!allowedIds.length) {
    return { posts: [], hasMore: false, page };
  }

  const skip = (page - 1) * limit;
  const match = {
    userId: { $in: allowedIds },
    completedAt: { $ne: null },
  };

  let workouts;
  let hasMore;

  if (sort === 'top') {
    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: LIKES_COLLECTION,
          localField: '_id',
          foreignField: 'workoutId',
          as: 'likes',
        },
      },
      {
        $addFields: {
          likeCountAgg: { $size: '$likes' },
        },
      },
      { $sort: { likeCountAgg: -1, completedAt: -1, _id: -1 } },
      { $skip: skip },
      { $limit: limit + 1 },
    ];
    const rows = await Workout.aggregate(pipeline);
    hasMore = rows.length > limit;
    workouts = rows.slice(0, limit);
  } else {
    const rows = await Workout.find(match)
      .sort({ completedAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit + 1)
      .lean();
    hasMore = rows.length > limit;
    workouts = rows.slice(0, limit);
  }

  if (!workouts.length) {
    return { posts: [], hasMore: false, page };
  }

  const wids = workouts.map((w) => w._id);
  const ownerIds = [...new Set(workouts.map((w) => String(w.userId)))].map((id) => asOid(id));

  const [owners, likeCounts, likedMine, commentCounts, prResults] = await Promise.all([
    User.find({ _id: { $in: ownerIds } })
      .select('name email publicProfileEnabled publicProfileSlug')
      .lean(),
    WorkoutLike.aggregate([
      { $match: { workoutId: { $in: wids } } },
      { $group: { _id: '$workoutId', n: { $sum: 1 } } },
    ]),
    WorkoutLike.find({ userId: asOid(viewerId), workoutId: { $in: wids } })
      .select('workoutId')
      .lean(),
    WorkoutComment.aggregate([
      { $match: { workoutId: { $in: wids } } },
      { $group: { _id: '$workoutId', n: { $sum: 1 } } },
    ]),
    Promise.all(workouts.map((w) => detectSessionPRs(w))),
  ]);

  const ownerMap = new Map(owners.map((u) => [u._id.toString(), u]));
  const likeMap = new Map(likeCounts.map((x) => [x._id.toString(), x.n]));
  const likedSet = new Set(likedMine.map((l) => l.workoutId.toString()));
  const commentMap = new Map(commentCounts.map((x) => [x._id.toString(), x.n]));

  const posts = workouts.map((w, i) => {
    const oidStr = w.userId.toString();
    const owner = ownerMap.get(oidStr);
    const name = (owner?.name || '').trim() || (owner?.email || '').split('@')[0] || 'Athlete';
    const { totalVol, totalSets, byEx } = workoutTotals(w);
    const sec = durationSeconds(w.startedAt, w.completedAt);
    const wid = w._id.toString();

    return {
      id: wid,
      user: {
        id: oidStr,
        name,
        initials: initialsFromName(owner?.name, owner?.email),
        slug: owner?.publicProfileEnabled && owner?.publicProfileSlug ? owner.publicProfileSlug : null,
      },
      workout: {
        type: inferWorkoutType(w),
        title: w.title || 'Workout',
        duration: formatDuration(sec),
        durationSec: sec,
        completedAt: w.completedAt,
        exercises: exerciseSummaries(w, 5),
        totalVolume: totalVol,
        /** Sum of (weight × reps) over counting sets, kg — same as totalVolume; explicit for clients. */
        totalVolumeKg: totalVol,
        totalSets,
        volumeByExercise: byEx.slice(0, 8),
      },
      prs: prResults[i] || [],
      likeCount: likeMap.get(wid) ?? 0,
      likedByUser: likedSet.has(wid),
      commentCount: commentMap.get(wid) ?? 0,
    };
  });

  return { posts, hasMore, page };
}

export async function listWorkoutComments(workoutId, viewerId, { limit = 25, before } = {}) {
  const w = await Workout.findById(workoutId).select('userId completedAt').lean();
  if (!w?.completedAt) return null;
  const owner = await User.findById(w.userId).select('publicProfileEnabled').lean();
  const can = await viewerCanSeeWorkout(viewerId, w, !!owner?.publicProfileEnabled);
  if (!can) return null;

  const q = { workoutId: asOid(workoutId) };
  if (before) {
    const d = new Date(before);
    if (!Number.isNaN(d.getTime())) q.createdAt = { $lt: d };
  }
  const rows = await WorkoutComment.find(q)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'name email')
    .lean();

  const comments = rows.reverse().map((r) => {
    const u = r.userId;
    const uname = (u?.name || '').trim() || (u?.email || '').split('@')[0] || 'User';
    return {
      id: r._id.toString(),
      body: r.body,
      createdAt: r.createdAt,
      user: {
        id: u?._id?.toString(),
        name: uname,
        initials: initialsFromName(u?.name, u?.email),
      },
    };
  });
  return { comments };
}

export async function addWorkoutComment(workoutId, viewerId, body) {
  const text = String(body || '').trim();
  if (!text || text.length > 800) return { error: 'Invalid comment' };

  const w = await Workout.findById(workoutId).select('userId completedAt').lean();
  if (!w?.completedAt) return { error: 'Workout not found' };
  const owner = await User.findById(w.userId).select('publicProfileEnabled').lean();
  const can = await viewerCanSeeWorkout(viewerId, w, !!owner?.publicProfileEnabled);
  if (!can) return { error: 'Not allowed' };

  const doc = await WorkoutComment.create({
    workoutId: asOid(workoutId),
    userId: asOid(viewerId),
    body: text,
  });
  const u = await User.findById(viewerId).select('name email').lean();
  const uname = (u?.name || '').trim() || (u?.email || '').split('@')[0] || 'User';
  return {
    comment: {
      id: doc._id.toString(),
      body: doc.body,
      createdAt: doc.createdAt,
      user: {
        id: String(viewerId),
        name: uname,
        initials: initialsFromName(u?.name, u?.email),
      },
    },
  };
}
