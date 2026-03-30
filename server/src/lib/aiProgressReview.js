import mongoose from 'mongoose';
import Workout from '../models/Workout.js';
import User from '../models/User.js';
import { totalVolumeKgNonWarmup } from './workoutVolume.js';
import { dateKeyInTimeZone, computeCurrentStreak, addCalendarDays } from './trainingStreak.js';
import { callOpenRouter } from './openrouter.js';

const PROGRESS_FALLBACK = {
  summary:
    'Your training log shows activity in this window. Keep recording sessions so trends, volume, and balance become clearer over time.',
  progressWins: ['You are showing up and logging workouts in IronLog.'],
  concerns: [],
  coaching: [
    'Aim for at least two sessions per week if your schedule allows, spread across the week.',
    'Note RPE or how hard each top set felt in workout notes to spot plateaus early.',
  ],
  nextFocus: 'Pick one compound lift per week to add a small amount of weight or one extra quality set.',
  deeperInsight: '',
  score: 75,
  tone: 'encouraging',
};

function volumeByCategory(workouts) {
  const cats = {};
  for (const w of workouts) {
    for (const ex of w.exercises || []) {
      const cat = ex.category || 'other';
      const vol = (ex.sets || [])
        .filter((s) => (s.setType || 'normal') !== 'warmup')
        .reduce((a, s) => a + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0);
      cats[cat] = (cats[cat] || 0) + vol;
    }
  }
  return cats;
}

function clampStr(s, max) {
  const t = String(s || '').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function normalizeStrArray(v, maxItems) {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => String(x).trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

export function normalizeProgressReview(raw, fallback = PROGRESS_FALLBACK) {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const score = Math.min(100, Math.max(0, parseInt(raw.score, 10) || fallback.score));
  return {
    summary: clampStr(raw.summary || fallback.summary, 2800),
    progressWins: normalizeStrArray(raw.progressWins, 8).length
      ? normalizeStrArray(raw.progressWins, 8)
      : fallback.progressWins,
    concerns: normalizeStrArray(raw.concerns, 5),
    coaching: normalizeStrArray(raw.coaching, 10).length
      ? normalizeStrArray(raw.coaching, 10)
      : fallback.coaching,
    nextFocus: clampStr(raw.nextFocus || fallback.nextFocus, 600),
    deeperInsight: clampStr(raw.deeperInsight || raw.patterns || '', 1200),
    score,
    tone: 'encouraging',
    ...(raw._model ? { _model: raw._model } : {}),
  };
}

export async function buildProgressPayload(userId, days) {
  const user = await User.findById(userId).select('weightUnit timezone').lean();
  const tz = user?.timezone || 'UTC';
  const unit = user?.weightUnit === 'lbs' ? 'lbs' : 'kg';

  const since = new Date();
  since.setDate(since.getDate() - days);

  const workouts = await Workout.find({
    userId: new mongoose.Types.ObjectId(userId),
    completedAt: { $ne: null, $gte: since },
  })
    .sort({ completedAt: -1 })
    .select('title exercises completedAt startedAt')
    .lean();

  if (!workouts.length) return null;

  const volumes = workouts.map((w) => totalVolumeKgNonWarmup(w));
  const totalVolume = volumes.reduce((a, v) => a + v, 0);
  const avgVolume = Math.round(totalVolume / workouts.length);
  const maxVol = Math.max(...volumes);
  const minVol = Math.min(...volumes);

  const half = Math.ceil(workouts.length / 2);
  const firstHalf = volumes.slice(half);
  const secondHalf = volumes.slice(0, half);
  const avgFirst = firstHalf.length ? Math.round(firstHalf.reduce((a, v) => a + v, 0) / firstHalf.length) : 0;
  const avgSecond = secondHalf.length ? Math.round(secondHalf.reduce((a, v) => a + v, 0) / secondHalf.length) : 0;
  const volumeTrend = avgFirst > 0 ? Math.round(((avgSecond - avgFirst) / avgFirst) * 100) : null;

  const cats = volumeByCategory(workouts);
  const sortedCats = Object.entries(cats)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => [k, Math.round(v)]);

  const trainingDays = new Set(
    workouts.map((w) => dateKeyInTimeZone(new Date(w.completedAt), tz))
  );
  const now = new Date();
  const todayKey = dateKeyInTimeZone(now, tz);
  const yesterdayKey = addCalendarDays(todayKey, -1);
  const streak = computeCurrentStreak(trainingDays, todayKey, yesterdayKey);

  const weekBuckets = [];
  const weeksCount = Math.ceil(days / 7);
  for (let i = 0; i < weeksCount; i++) {
    const from = new Date(since.getTime() + i * 7 * 86400000);
    const to = new Date(from.getTime() + 7 * 86400000);
    const count = workouts.filter((w) => {
      const d = new Date(w.completedAt);
      return d >= from && d < to;
    }).length;
    weekBuckets.push({ weekIndex: i + 1, sessions: count });
  }

  const plateauCheck =
    volumes.length >= 4 && volumeTrend !== null && Math.abs(volumeTrend) < 5;

  const sessionsPerWeek = days > 0 ? Math.round((workouts.length / days) * 70) / 10 : 0;

  const sessionTitles = workouts.slice(0, 12).map((w) => ({
    title: w.title,
    date: new Date(w.completedAt).toISOString().slice(0, 10),
    volume: totalVolumeKgNonWarmup(w),
  }));

  const busiestDay = trainingDays.size
    ? { uniqueTrainingDays: trainingDays.size, windowDays: days }
    : null;

  return {
    payload: {
      windowDays: days,
      weightDisplayUnit: unit,
      timezoneUsedForStreak: tz,
      workoutCount: workouts.length,
      sessionsPerWeekApprox: sessionsPerWeek,
      totalVolumeKgReps: Math.round(totalVolume),
      avgVolumePerSession: avgVolume,
      minSessionVolume: minVol,
      maxSessionVolume: maxVol,
      volumeTrendFirstHalfVsSecondHalfPct: volumeTrend,
      muscleVolumeByCategory: Object.fromEntries(sortedCats),
      topCategories: sortedCats.slice(0, 4).map(([k, v]) => ({ category: k, volume: v })),
      currentStreakTrainingDays: streak,
      uniqueTrainingDaysInWindow: trainingDays.size,
      weeklySessionCounts: weekBuckets,
      possibleVolumePlateau: plateauCheck,
      recentSessionLog: sessionTitles,
      busiestDaySummary: busiestDay,
    },
    fallback: PROGRESS_FALLBACK,
  };
}

export async function generateProgressReview(userId, days) {
  const built = await buildProgressPayload(userId, days);
  if (!built) return PROGRESS_FALLBACK;

  const { payload, fallback } = built;

  const systemPrompt = `You are an experienced strength coach reviewing training logs in IronLog.
Use ONLY the JSON statistics provided. Do not invent workouts, injuries, or lab results.
No medical advice, diagnoses, or treatment suggestions.

Return ONLY valid JSON (no markdown, no code fences):
{
  "summary": "string — 4-7 sentences: overall consistency, volume trend across the window, muscle balance (use category volumes), streak / training-day spread, and what the numbers suggest about progression or maintenance.",
  "deeperInsight": "string — 2-4 sentences on patterns (e.g. clustering sessions, flat volume, category skew) grounded in the payload.",
  "progressWins": ["4-7 specific wins tied to numbers — frequency, streak, volume trend, balance, etc."],
  "concerns": ["0-4 realistic watch-outs from data only — e.g. low frequency, one-sided volume, possible plateau flag"],
  "coaching": ["5-8 actionable bullets — scheduling, lift order, progression ideas, deload hints as training strategy only, recovery habits like sleep consistency without medical claims"],
  "nextFocus": "string — one clear priority for the next 7 days referencing their actual pattern",
  "score": 0,
  "tone": "encouraging"
}
score: 0-100 integer for how well this window supports their goals relative to consistency and balance in the data (not comparing to elites).
tone must be exactly "encouraging".`;

  const userPrompt = `Training window: ${days} days.\nData:\n${JSON.stringify(payload)}`;

  const raw = await callOpenRouter(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    fallback,
    { maxTokens: 2000 }
  );

  return normalizeProgressReview(raw, fallback);
}
