import User from '../models/User.js';
import Workout from '../models/Workout.js';
import { userIsStaff } from '../config/admin.js';
import { isEmailVerifiedUser } from './userEmailVerified.js';
import { currentSeasonIdUTC, seasonBoundsUTC } from './rankLadder.js';
import { seasonLadderPointsDeltaForWorkout } from './seasonRankPoints.js';

/**
 * Recompute `ladderSeasonPoints` / `rankDailyBonusDayKey` for the given UTC month from workout history.
 * Eligibility matches live awards (verified email or staff).
 */
export async function recalculateAllUsersSeasonPoints(seasonId = currentSeasonIdUTC()) {
  const bounds = seasonBoundsUTC(seasonId);
  if (!bounds) throw new Error(`Invalid season id: ${seasonId}`);

  const users = await User.find({})
    .select('_id timezone email emailVerifiedAt isAdmin isSupport ladderSeasonId')
    .lean();

  let usersUpdated = 0;
  let usersSkipped = 0;
  const totals = [];

  for (const u of users) {
    if (!userIsStaff(u) && !isEmailVerifiedUser(u)) {
      usersSkipped += 1;
      continue;
    }

    const workouts = await Workout.find({
      userId: u._id,
      completedAt: { $gte: bounds.start, $lte: bounds.end },
    })
      .select('completedAt exercises')
      .sort({ completedAt: 1, _id: 1 })
      .lean();

    let rankDailyBonusDayKey = '';
    let total = 0;
    for (const w of workouts) {
      const { points, nextRankDailyBonusDayKey } = seasonLadderPointsDeltaForWorkout(
        w,
        u.timezone,
        rankDailyBonusDayKey
      );
      total += points;
      rankDailyBonusDayKey = nextRankDailyBonusDayKey;
    }

    await User.updateOne(
      { _id: u._id },
      {
        $set: {
          ladderSeasonId: seasonId,
          ladderSeasonPoints: total,
          rankDailyBonusDayKey: rankDailyBonusDayKey || '',
        },
      }
    );
    usersUpdated += 1;
    totals.push({ userId: String(u._id), points: total, workouts: workouts.length });
  }

  return { seasonId, usersUpdated, usersSkipped, totals };
}
