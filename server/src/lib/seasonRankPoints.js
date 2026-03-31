import User from '../models/User.js';
import Workout from '../models/Workout.js';
import { currentSeasonIdUTC } from './rankLadder.js';
import { totalVolumeKgNonWarmup } from './workoutVolume.js';
import { dateKeyInTimeZone } from './trainingStreak.js';

const BASE_COMPLETE = 15;
const DAILY_FIRST_BONUS = 5;
const VOLUME_STEP = 500;
const VOLUME_BONUS_CAP = 25;

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
      'timezone ladderSeasonId ladderSeasonPoints rankDailyBonusDayKey'
    );
    if (!user) {
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
