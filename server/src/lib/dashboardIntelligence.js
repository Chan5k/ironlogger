import mongoose from 'mongoose';
import Workout from '../models/Workout.js';
import User from '../models/User.js';
import Exercise, { EXERCISE_CATEGORIES } from '../models/Exercise.js';
import {
  addCalendarDays,
  computeCurrentStreak,
  countTrainingDaysInRollingWindow,
  dateKeyInTimeZone,
} from './trainingStreak.js';

function isCountingSet(s) {
  const t = s?.setType || 'normal';
  return t !== 'warmup';
}

function exerciseSessionMaxWeight(ex) {
  let m = 0;
  for (const s of ex.sets || []) {
    if (!isCountingSet(s) || !s.completed) continue;
    m = Math.max(m, Number(s.weight) || 0);
  }
  return m;
}

function calendarDayGap(fromKey, toKey) {
  const a = new Date(`${fromKey}T12:00:00.000Z`).getTime();
  const b = new Date(`${toKey}T12:00:00.000Z`).getTime();
  return Math.floor((b - a) / 86400000);
}

async function volumeNonWarmupInRange(userId, from, to, exclusiveUpper) {
  const range = exclusiveUpper ? { $gte: from, $lt: to } : { $gte: from, $lte: to };
  const rows = await Workout.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        completedAt: { $ne: null, ...range },
      },
    },
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
          $sum: {
            $multiply: [
              { $ifNull: ['$exercises.sets.weight', 0] },
              { $ifNull: ['$exercises.sets.reps', 0] },
            ],
          },
        },
      },
    },
  ]);
  return Math.round(rows[0]?.totalVolume ?? 0);
}

const CAT_LABEL = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  legs: 'Legs',
  core: 'Core',
  cardio: 'Cardio',
  other: 'Other',
};

function bestStreakFromDaySet(trainingDays) {
  let best = 0;
  for (const day of trainingDays) {
    const prev = addCalendarDays(day, -1);
    if (trainingDays.has(prev)) continue;
    let len = 0;
    let k = day;
    while (trainingDays.has(k)) {
      len += 1;
      k = addCalendarDays(k, 1);
    }
    if (len > best) best = len;
  }
  return best;
}

export async function buildDashboardIntelligence(userId) {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const me = await User.findById(userId).select('timezone').lean();
  const tz = me?.timezone || 'UTC';

  const fiftySixDaysAgo = new Date(now.getTime() - 56 * 86400000);

  const [
    volThis7,
    volPrev7,
    completedDates,
    lastWorkouts,
    muscleAgg,
    plateauWorkouts,
  ] = await Promise.all([
    volumeNonWarmupInRange(userId, weekAgo, now, false),
    volumeNonWarmupInRange(userId, twoWeeksAgo, weekAgo, true),
    Workout.find({
      userId,
      completedAt: { $ne: null },
    })
      .select('completedAt')
      .lean(),
    Workout.find({
      userId,
      completedAt: { $ne: null },
    })
      .sort({ completedAt: -1 })
      .limit(5)
      .select('completedAt exercises')
      .lean(),
    Workout.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          completedAt: { $ne: null },
          startedAt: { $gte: new Date(now.getTime() - 30 * 86400000) },
        },
      },
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
          _id: {
            $ifNull: ['$exercises.category', 'other'],
          },
          volume: {
            $sum: {
              $multiply: [
                { $ifNull: ['$exercises.sets.weight', 0] },
                { $ifNull: ['$exercises.sets.reps', 0] },
              ],
            },
          },
        },
      },
    ]),
    Workout.find({
      userId,
      completedAt: { $ne: null, $gte: fiftySixDaysAgo },
    })
      .select('completedAt exercises')
      .lean(),
  ]);

  const trainingDays = new Set(
    (completedDates || []).map((w) => dateKeyInTimeZone(new Date(w.completedAt), tz))
  );
  const todayKey = dateKeyInTimeZone(now, tz);
  const yesterdayKey = addCalendarDays(todayKey, -1);
  const currentStreak = computeCurrentStreak(trainingDays, todayKey, yesterdayKey);
  const bestEver = bestStreakFromDaySet(trainingDays);
  const trainingDaysLast7 = countTrainingDaysInRollingWindow(trainingDays, todayKey, 7);
  const prev7Start = addCalendarDays(todayKey, -6);
  const prev7End = todayKey;
  const prior7Start = addCalendarDays(todayKey, -13);
  const prior7End = addCalendarDays(todayKey, -7);

  const daysIn = (set, fromK, toK) => {
    let n = 0;
    for (const d of set) {
      if (d >= fromK && d <= toK) n += 1;
    }
    return n;
  };
  const consistencyThis7 = daysIn(trainingDays, prev7Start, prev7End);
  const consistencyPrev7 = daysIn(trainingDays, prior7Start, prior7End);

  const categories = Object.fromEntries(
    EXERCISE_CATEGORIES.map((c) => [c, { volume: 0 }])
  );
  for (const row of muscleAgg) {
    const k = EXERCISE_CATEGORIES.includes(row._id) ? row._id : 'other';
    categories[k].volume += Math.round(row.volume || 0);
  }
  const totalVol = EXERCISE_CATEGORIES.reduce((s, c) => s + categories[c].volume, 0);

  const distributionAll = EXERCISE_CATEGORIES.map((key) => ({
    key,
    label: CAT_LABEL[key],
    volume: categories[key].volume,
    pct: totalVol > 0 ? Math.round((categories[key].volume / totalVol) * 1000) / 10 : 0,
  }));

  const insights = [];

  if (volPrev7 > 0) {
    const ch = Math.round(((volThis7 - volPrev7) / volPrev7) * 100);
    if (Math.abs(ch) >= 8) {
      insights.push(
        ch > 0
          ? `Your training volume is up about ${ch}% vs the previous 7 days.`
          : `Your training volume is down about ${Math.abs(ch)}% vs the previous 7 days — a lighter week is fine if intentional.`
      );
    }
  } else if (volThis7 > 0 && volPrev7 === 0) {
    insights.push('You logged volume this week after a quiet prior week — nice momentum.');
  }

  if (consistencyThis7 > consistencyPrev7 && consistencyPrev7 < 4) {
    insights.push(`You trained on ${consistencyThis7} of the last 7 days — consistency is improving.`);
  } else if (consistencyThis7 < consistencyPrev7 && consistencyPrev7 >= 3) {
    insights.push('Fewer training days this week than last — adjust recovery or schedule if needed.');
  }

  if (bestEver > 0 && currentStreak > 0 && currentStreak >= bestEver - 1 && currentStreak < bestEver) {
    insights.push("You're one training day away from matching your best streak.");
  } else if (bestEver > 0 && currentStreak === bestEver && currentStreak > 0) {
    insights.push("You're on your best-ever streak — keep the rhythm sustainable.");
  }

  const sortedPct = [...distributionAll].filter((x) => x.key !== 'cardio' && x.key !== 'other').sort((a, b) => b.pct - a.pct);
  const top = sortedPct[0];
  if (top && top.pct >= 38) {
    insights.push(`${top.label} training dominates your last 30 days (~${top.pct}%) — consider balancing push/pull or limbs.`);
  }
  const weak = sortedPct.filter((x) => x.pct > 0 && x.pct < 8 && ['chest', 'back', 'legs', 'shoulders'].includes(x.key));
  if (weak.length) {
    insights.push(
      `${weak[0].label} is a smaller slice of recent volume (${weak[0].pct}%) — easy to bring up with an extra session.`
    );
  }

  const trimmedInsights = insights.slice(0, 4);

  const imbalanceHints = [];
  if (top && top.pct >= 42) {
    imbalanceHints.push({
      type: 'high',
      text: `${top.label} may be getting more than its share lately (~${top.pct}%).`,
    });
  }
  const under = sortedPct.find((x) => ['chest', 'back', 'legs'].includes(x.key) && x.pct > 0 && x.pct < 12);
  if (under) {
    imbalanceHints.push({
      type: 'low',
      text: `${under.label} looks underrepresented (~${under.pct}%) in the last 30 days.`,
    });
  }

  const lastByCategory = new Map();
  for (const w of lastWorkouts) {
    const dk = dateKeyInTimeZone(new Date(w.completedAt), tz);
    for (const ex of w.exercises || []) {
      const cat = EXERCISE_CATEGORIES.includes(ex.category) ? ex.category : 'other';
      const hasLoad = (ex.sets || []).some(
        (s) => isCountingSet(s) && (Number(s.reps) > 0 || Number(s.weight) > 0)
      );
      if (!hasLoad) continue;
      if (!lastByCategory.has(cat)) lastByCategory.set(cat, dk);
    }
  }

  const priorityCats = ['chest', 'back', 'legs', 'shoulders', 'arms'];
  let suggestCat = null;
  let maxGap = -1;
  const today = todayKey;
  for (const c of priorityCats) {
    const last = lastByCategory.get(c);
    if (!last) {
      suggestCat = c;
      maxGap = 999;
      break;
    }
    const gap = Math.floor(
      (new Date(`${today}T12:00:00Z`).getTime() - new Date(`${last}T12:00:00Z`).getTime()) / 86400000
    );
    if (gap > maxGap) {
      maxGap = gap;
      suggestCat = c;
    }
  }

  let suggestion = null;
  if (suggestCat && maxGap >= 3) {
    const label = CAT_LABEL[suggestCat];
    suggestion = {
      muscleGroup: suggestCat,
      label,
      daysSince: maxGap === 999 ? null : maxGap,
      message:
        maxGap === 999
          ? `No recent ${label.toLowerCase()} work logged in your last few sessions — consider a ${label.toLowerCase()} focus.`
          : `You haven't trained ${label.toLowerCase()} in ${maxGap} days — a ${label.toLowerCase()} session could balance things out.`,
      exercises: await suggestExercisesForCategory(suggestCat, userId),
    };
  }

  const dayMs = 86400000;
  const t21 = now.getTime() - 21 * dayMs;
  const t42 = now.getTime() - 42 * dayMs;
  const byExPlateau = new Map();
  for (const w of plateauWorkouts || []) {
    const cw = new Date(w.completedAt).getTime();
    const dk = dateKeyInTimeZone(new Date(w.completedAt), tz);
    for (const ex of w.exercises || []) {
      const mw = exerciseSessionMaxWeight(ex);
      if (mw <= 0) continue;
      const label = (ex.name || '').trim() || 'Exercise';
      const key = ex.exerciseId ? String(ex.exerciseId) : label.toLowerCase();
      if (!byExPlateau.has(key)) {
        byExPlateau.set(key, { label, recentMax: 0, priorMax: 0, recentDays: new Set() });
      }
      const prow = byExPlateau.get(key);
      if (label.length > prow.label.length) prow.label = label;
      if (cw >= t21) {
        prow.recentMax = Math.max(prow.recentMax, mw);
        prow.recentDays.add(dk);
      } else if (cw >= t42 && cw < t21) {
        prow.priorMax = Math.max(prow.priorMax, mw);
      }
    }
  }

  let plateauTip = null;
  for (const [, row] of byExPlateau) {
    if (row.priorMax <= 0 || row.recentMax <= 0) continue;
    if (row.recentDays.size < 2) continue;
    if (row.recentMax <= row.priorMax * 1.02) {
      plateauTip = `Your ${row.label} hasn't moved much in ~3 weeks — try one harder set or an extra rep.`;
      break;
    }
  }

  let lastCompletedKey = null;
  let lastCompletedMs = 0;
  for (const w of completedDates || []) {
    const t = new Date(w.completedAt).getTime();
    if (t > lastCompletedMs) {
      lastCompletedMs = t;
      lastCompletedKey = dateKeyInTimeZone(new Date(w.completedAt), tz);
    }
  }
  const daysSinceLast =
    lastCompletedKey != null ? calendarDayGap(lastCompletedKey, todayKey) : null;

  const coachingItems = [];
  if (currentStreak >= 5) {
    coachingItems.push({
      priority: 1,
      text: `You trained ${currentStreak} days straight — consider a rest day.`,
    });
  }
  if (daysSinceLast != null && daysSinceLast >= 6 && currentStreak < 5) {
    coachingItems.push({
      priority: 2,
      text: `It's been ${daysSinceLast} days since your last workout — ease back in with something short.`,
    });
  }
  if (plateauTip && coachingItems.length < 3) {
    coachingItems.push({ priority: 3, text: plateauTip });
  }
  if (under && coachingItems.length < 3) {
    coachingItems.push({
      priority: 4,
      text: `${under.label} is lighter than your other areas lately — bias one session that way.`,
    });
  }
  if (suggestion && (suggestion.daysSince ?? 0) >= 5 && coachingItems.length < 3) {
    const lab = suggestion.label;
    coachingItems.push({
      priority: 5,
      text:
        suggestion.daysSince == null
          ? `${lab} hasn't shown up recently — slot a session with ${lab.toLowerCase()} focus.`
          : `You haven't trained ${lab.toLowerCase()} in ${suggestion.daysSince} days — worth prioritizing soon.`,
    });
  }

  coachingItems.sort((a, b) => a.priority - b.priority);
  const coachingTips = coachingItems.slice(0, 3).map((c) => c.text);

  return {
    insights: trimmedInsights,
    muscleBalance: {
      windowDays: 30,
      totalVolume: totalVol,
      distribution: distributionAll,
      hints: imbalanceHints.slice(0, 3),
    },
    suggestion,
    coachingTips,
    meta: {
      volumeThis7d: volThis7,
      volumePrev7d: volPrev7,
      trainingDaysLast7,
      consistencyPrev7,
      currentStreak,
      bestStreakEver: bestEver,
    },
  };
}

async function suggestExercisesForCategory(category, userId) {
  const ex = await Exercise.find({
    category,
    $or: [{ isGlobal: true }, { userId: new mongoose.Types.ObjectId(userId) }],
  })
    .sort({ name: 1 })
    .limit(4)
    .select('name')
    .lean();
  return ex.map((e) => e.name);
}
