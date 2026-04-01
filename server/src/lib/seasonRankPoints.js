import User from '../models/User.js';
import Workout from '../models/Workout.js';
import { userIsStaff } from '../config/admin.js';
import { currentSeasonIdUTC } from './rankLadder.js';
import { totalVolumeKgNonWarmup } from './workoutVolume.js';
import { dateKeyInTimeZone } from './trainingStreak.js';
import { isEmailVerifiedUser } from './userEmailVerified.js';

const BASE_COMPLETE = 24;
const DAILY_FIRST_BONUS = 12;
const VOLUME_STEP = 400;
const VOLUME_BONUS_CAP = 40;

/** Exported for Hevy import validation (same rules as ladder eligibility). */
export function workoutMeetsLadderMinimum(exercises) {
  for (const ex of exercises || []) {
    for (const s of ex.sets || []) {
      const t = s?.setType || 'normal';
      if (t === 'warmup') continue;
      if ((Number(s.reps) || 0) > 0) return true;
    }
  }
  return false;
}

function volumeBonusFromWorkout(workout) {
  const vol = totalVolumeKgNonWarmup(workout);
  return Math.min(VOLUME_BONUS_CAP, Math.floor(vol / VOLUME_STEP));
}

/**
 * Pure tally for one completed workout (same rules as tryAwardSeasonRankPointsForWorkout).
 * @param {string} rankDailyBonusDayKey prior state (`''` if none)
 * @returns {{ points: number, nextRankDailyBonusDayKey: string }}
 */
export function seasonLadderPointsDeltaForWorkout(workoutLean, timezone, rankDailyBonusDayKey) {
  const priorKey = rankDailyBonusDayKey == null ? '' : String(rankDailyBonusDayKey);
  if (!workoutLean?.completedAt) {
    return { points: 0, nextRankDailyBonusDayKey: priorKey };
  }
  if (!workoutMeetsLadderMinimum(workoutLean.exercises)) {
    return { points: 0, nextRankDailyBonusDayKey: priorKey };
  }
  const tz = timezone && String(timezone).trim() ? timezone : 'UTC';
  const dayKey = dateKeyInTimeZone(new Date(workoutLean.completedAt), tz);
  let dailyBonus = 0;
  if (priorKey !== dayKey) {
    dailyBonus = DAILY_FIRST_BONUS;
  }
  const volumeBonus = volumeBonusFromWorkout(workoutLean);
  const points = BASE_COMPLETE + volumeBonus + dailyBonus;
  const nextRankDailyBonusDayKey = dailyBonus > 0 ? dayKey : priorKey;
  return { points, nextRankDailyBonusDayKey };
}

/**
 * Awards seasonal ladder points once per workout when it qualifies.
 * @returns {Promise<{ awarded: boolean, pointsAdded?: number }>}
 */
export async function tryAwardSeasonRankPointsForWorkout(workoutLeanOrDoc) {
  if (!workoutLeanOrDoc?.completedAt) return { awarded: false };
  if (!workoutMeetsLadderMinimum(workoutLeanOrDoc.exercises)) return { awarded: false };

  const claimed = await Workout.findOneAndUpdate(
    {
      _id: workoutLeanOrDoc._id,
      completedAt: { $ne: null },
      ladderPointsAwarded: { $ne: true },
    },
    { $set: { ladderPointsAwarded: true } },
    { new: true }
  ).lean();

  if (!claimed) return { awarded: false };

  const volumeBonus = volumeBonusFromWorkout(claimed);
  let pointsAdded = BASE_COMPLETE + volumeBonus;

  try {
    const user = await User.findById(claimed.userId).select(
      'email emailVerifiedAt isAdmin isSupport timezone ladderSeasonId ladderSeasonPoints rankDailyBonusDayKey'
    );
    if (!user) {
      await Workout.updateOne({ _id: claimed._id }, { $set: { ladderPointsAwarded: false } });
      return { awarded: false };
    }

    if (!userIsStaff(user) && !isEmailVerifiedUser(user)) {
      await Workout.updateOne({ _id: claimed._id }, { $set: { ladderPointsAwarded: false } });
      return { awarded: false };
    }

    const tz = user.timezone && String(user.timezone).trim() ? user.timezone : 'UTC';
    const dayKey = dateKeyInTimeZone(new Date(claimed.completedAt), tz);
    let dailyBonus = 0;
    if (user.rankDailyBonusDayKey !== dayKey) {
      dailyBonus = DAILY_FIRST_BONUS;
    }
    pointsAdded += dailyBonus;

    const sid = currentSeasonIdUTC();
    let carry = 0;
    if (user.ladderSeasonId === sid) {
      carry = Math.max(0, Number(user.ladderSeasonPoints) || 0);
    }

    const set = {
      ladderSeasonId: sid,
      ladderSeasonPoints: carry + pointsAdded,
    };
    if (dailyBonus > 0) {
      set.rankDailyBonusDayKey = dayKey;
    }

    const res = await User.updateOne({ _id: user._id }, { $set: set });
    if (res.matchedCount === 0) {
      await Workout.updateOne({ _id: claimed._id }, { $set: { ladderPointsAwarded: false } });
      return { awarded: false };
    }

    return { awarded: true, pointsAdded };
  } catch (e) {
    await Workout.updateOne({ _id: claimed._id }, { $set: { ladderPointsAwarded: false } });
    throw e;
  }
}
