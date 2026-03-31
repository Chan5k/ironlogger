import Workout from '../models/Workout.js';
import { buildHevyCategoryResolver } from './hevyImport/exerciseCategory.js';
import { tryAwardSeasonRankPointsForWorkout } from './seasonRankPoints.js';

/**
 * One-off / admin: fix muscle categories on Hevy imports and grant missed season ladder points.
 * @param {{ fixCategories?: boolean, awardSeasonPoints?: boolean }} opts
 */
export async function runHevyImportBackfill(opts = {}) {
  const fixCategories = opts.fixCategories !== false;
  const awardSeasonPoints = opts.awardSeasonPoints !== false;

  const result = {
    workoutsCategoryTouched: 0,
    exercisesRecategorized: 0,
    seasonWorkoutsProcessed: 0,
    seasonWorkoutsAwarded: 0,
    seasonPointsAdded: 0,
  };

  if (fixCategories) {
    const resolvers = new Map();
    const cursor = Workout.find({ importSource: 'hevy' }).cursor();
    for await (const w of cursor) {
      const uid = String(w.userId);
      let resolve = resolvers.get(uid);
      if (!resolve) {
        resolve = await buildHevyCategoryResolver(w.userId);
        resolvers.set(uid, resolve);
      }
      let changed = false;
      for (const ex of w.exercises || []) {
        const next = resolve(ex.name);
        if (ex.category !== next) {
          ex.category = next;
          changed = true;
          result.exercisesRecategorized += 1;
        }
      }
      if (changed) {
        await w.save();
        result.workoutsCategoryTouched += 1;
      }
    }
  }

  if (awardSeasonPoints) {
    const pending = await Workout.find({
      importSource: 'hevy',
      completedAt: { $ne: null },
      ladderPointsAwarded: { $ne: true },
    })
      .sort({ userId: 1, completedAt: 1 })
      .lean();

    for (const lean of pending) {
      result.seasonWorkoutsProcessed += 1;
      try {
        const r = await tryAwardSeasonRankPointsForWorkout(lean);
        if (r.awarded) {
          result.seasonWorkoutsAwarded += 1;
          result.seasonPointsAdded += r.pointsAdded || 0;
        }
      } catch (e) {
        console.error('backfill hevy season', lean._id, e);
      }
    }
  }

  return result;
}
