import { DateTime } from 'luxon';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Workout from '../models/Workout.js';

const userLocks = new Map();

/**
 * Old Hevy import path treated CSV datetimes like `2024-06-15 18:30:00` as UTC (or server-local)
 * instead of the athlete's profile timezone. Stored Date UTC components are the intended *wall clock*
 * in their gym timezone — reinterpret as that zone to get the correct instant.
 *
 * @param {Date} d
 * @param {string} timeZone IANA zone
 * @returns {Date}
 */
export function reinterpretStoredHevyInstant(d, timeZone) {
  if (!d || !(d instanceof Date) || Number.isNaN(d.getTime())) return d;
  const tz = timeZone && String(timeZone).trim() ? String(timeZone).trim() : 'UTC';
  const utc = DateTime.fromJSDate(d, { zone: 'utc' });
  const wall = DateTime.fromObject(
    {
      year: utc.year,
      month: utc.month,
      day: utc.day,
      hour: utc.hour,
      minute: utc.minute,
      second: Math.floor(utc.second),
      millisecond: utc.millisecond,
    },
    { zone: tz }
  );
  return wall.toUTC().toJSDate();
}

/**
 * One user: fix all Hevy imports not yet marked normalized. Idempotent; serialized per userId.
 * @returns {Promise<{ updated: number }>}
 */
export async function normalizeHevyTimestampsForUser(userId) {
  const id = String(userId);
  const pendingLock = userLocks.get(id);
  if (pendingLock) return pendingLock;

  const job = (async () => {
    const uid = new mongoose.Types.ObjectId(userId);
    const user = await User.findById(uid).select('timezone').lean();
    const tz = user?.timezone && String(user.timezone).trim() ? user.timezone : 'UTC';

    const rows = await Workout.find({
      userId: uid,
      importSource: 'hevy',
      completedAt: { $ne: null },
      hevyTimestampsNormalized: { $ne: true },
    })
      .select('_id startedAt completedAt')
      .lean();

    if (!rows.length) return { updated: 0 };

    const CHUNK = 200;
    let updated = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const ops = [];
      for (const w of slice) {
        const newStarted = reinterpretStoredHevyInstant(new Date(w.startedAt), tz);
        const newCompleted = reinterpretStoredHevyInstant(new Date(w.completedAt), tz);
        const finalCompleted =
          newCompleted.getTime() < newStarted.getTime() ? newStarted : newCompleted;
        ops.push({
          updateOne: {
            filter: { _id: w._id },
            update: {
              $set: {
                startedAt: newStarted,
                completedAt: finalCompleted,
                hevyTimestampsNormalized: true,
              },
            },
          },
        });
      }
      if (ops.length) {
        await Workout.bulkWrite(ops, { ordered: false });
        updated += ops.length;
      }
    }
    return { updated };
  })().finally(() => {
    userLocks.delete(id);
  });

  userLocks.set(id, job);
  return job;
}

/**
 * Admin / script: every user who still has pending Hevy workouts.
 * @returns {Promise<{ usersWithPending: number, workoutsUpdated: number }>}
 */
export async function normalizeAllHevyTimestampsPending() {
  const userIds = await Workout.distinct('userId', {
    importSource: 'hevy',
    completedAt: { $ne: null },
    hevyTimestampsNormalized: { $ne: true },
  });
  let workoutsUpdated = 0;
  for (const uid of userIds) {
    const r = await normalizeHevyTimestampsForUser(uid);
    workoutsUpdated += r.updated;
  }
  return { usersWithPending: userIds.length, workoutsUpdated };
}
