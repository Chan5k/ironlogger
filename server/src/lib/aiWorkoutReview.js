import mongoose from 'mongoose';
import Workout from '../models/Workout.js';
import User from '../models/User.js';
import { totalVolumeKgNonWarmup } from './workoutVolume.js';
import { callOpenRouter } from './openrouter.js';

const WORKOUT_FALLBACK = {
  summary:
    'Your workout was saved. Keep logging sessions so we can compare volume, balance, and trends over time.',
  whatWentWell: ['You completed a full session and recorded it in IronLog.'],
  whatToImprove: [],
  howToImprove: [
    'Next time, add brief session notes (RPE, sleep, soreness) in the workout notes to make future reviews richer.',
    'Aim for one more working set on a main lift when recovery allows, or add a light back-off set for volume.',
  ],
  highlights: ['Session completed and stored.'],
  risks: [],
  coaching: ['Consistency beats perfection — schedule your next session within 48 hours if you can.'],
  contextUsed: '',
  score: 75,
  tone: 'encouraging',
};

function summariseExercises(exercises) {
  const out = [];
  for (const ex of exercises || []) {
    const sets = (ex.sets || []).filter((s) => (s.setType || 'normal') !== 'warmup');
    if (!sets.length) continue;
    const totalReps = sets.reduce((s, st) => s + (Number(st.reps) || 0), 0);
    const maxWeight = Math.max(0, ...sets.map((st) => Number(st.weight) || 0));
    const vol = sets.reduce((s, st) => s + (Number(st.weight) || 0) * (Number(st.reps) || 0), 0);
    out.push({
      name: ex.name,
      category: ex.category || 'other',
      sets: sets.length,
      totalReps,
      maxWeight: Math.round(maxWeight),
      volume: Math.round(vol),
    });
  }
  return out;
}

function durationMinutes(w) {
  if (!w.startedAt || !w.completedAt) return null;
  const ms = new Date(w.completedAt) - new Date(w.startedAt);
  return ms > 0 ? Math.round(ms / 60000) : null;
}

function miniWorkoutSummary(w) {
  const vol = totalVolumeKgNonWarmup(w);
  const names = (w.exercises || []).map((e) => e.name).slice(0, 5);
  return {
    title: w.title,
    date: w.completedAt ? new Date(w.completedAt).toISOString().slice(0, 10) : null,
    volume: vol,
    exerciseCount: (w.exercises || []).length,
    lifts: names,
  };
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

export function normalizeWorkoutReview(raw, fallback = WORKOUT_FALLBACK) {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const score = Math.min(100, Math.max(0, parseInt(raw.score, 10) || fallback.score));
  let whatWentWell = normalizeStrArray(raw.whatWentWell, 8);
  const highlights = normalizeStrArray(raw.highlights, 8);
  if (!whatWentWell.length && highlights.length) whatWentWell = [...highlights];

  let whatToImprove = normalizeStrArray(raw.whatToImprove, 6);
  const risks = normalizeStrArray(raw.risks, 6);
  if (!whatToImprove.length && risks.length) whatToImprove = [...risks];

  let howToImprove = normalizeStrArray(raw.howToImprove, 8);
  const coaching = normalizeStrArray(raw.coaching, 8);
  if (!howToImprove.length && coaching.length) howToImprove = [...coaching];

  return {
    summary: clampStr(raw.summary || fallback.summary, 2200),
    whatWentWell: whatWentWell.length ? whatWentWell : fallback.whatWentWell,
    whatToImprove: whatToImprove.length ? whatToImprove : fallback.whatToImprove,
    howToImprove: howToImprove.length ? howToImprove : fallback.howToImprove,
    highlights: highlights.length ? highlights : whatWentWell,
    risks: risks.length ? risks : whatToImprove,
    coaching: coaching.length ? coaching : howToImprove,
    contextUsed: clampStr(raw.contextUsed || fallback.contextUsed, 800),
    score,
    tone: 'encouraging',
    ...(raw._model ? { _model: raw._model } : {}),
  };
}

export async function buildWorkoutReviewPayload(workoutId, userId) {
  const workout = await Workout.findOne({ _id: workoutId, userId, completedAt: { $ne: null } }).lean();
  if (!workout) return null;

  const user = await User.findById(userId).select('weightUnit timezone name').lean();
  const unit = user?.weightUnit === 'lbs' ? 'lbs' : 'kg';

  const exerciseSummary = summariseExercises(workout.exercises);
  const totalVolume = totalVolumeKgNonWarmup(workout);
  const totalSets = exerciseSummary.reduce((s, e) => s + e.sets, 0);
  const totalReps = exerciseSummary.reduce((s, e) => s + e.totalReps, 0);
  const duration = durationMinutes(workout);
  const muscleGroups = [...new Set(exerciseSummary.map((e) => e.category))];

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const fourteenAgo = new Date();
  fourteenAgo.setDate(fourteenAgo.getDate() - 14);

  const [history, sessionsLast14] = await Promise.all([
    Workout.find({
      userId: new mongoose.Types.ObjectId(userId),
      _id: { $ne: workout._id },
      completedAt: { $ne: null, $gte: sixtyDaysAgo },
    })
      .sort({ completedAt: -1 })
      .limit(8)
      .select('title exercises completedAt')
      .lean(),
    Workout.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      completedAt: { $ne: null, $gte: fourteenAgo },
    }),
  ]);

  let volumeChangeVsLast = null;
  let previousSession = null;
  if (history.length) {
    const last = history[0];
    const lastVol = totalVolumeKgNonWarmup(last);
    previousSession = miniWorkoutSummary(last);
    if (lastVol > 0) {
      volumeChangeVsLast = Math.round(((totalVolume - lastVol) / lastVol) * 100);
    }
  }

  const recentAvgSets =
    history.length
      ? Math.round(
          history.reduce(
            (s, w) =>
              s +
              (w.exercises || []).reduce(
                (a, ex) =>
                  a + (ex.sets || []).filter((st) => (st.setType || 'normal') !== 'warmup').length,
                0
              ),
            0
          ) / history.length
        )
      : null;

  const recentWorkoutsMini = history.map(miniWorkoutSummary);
  const notesPreview = workout.notes ? clampStr(workout.notes.replace(/\s+/g, ' '), 400) : '';

  const topByVolume = [...exerciseSummary].sort((a, b) => b.volume - a.volume).slice(0, 5);

  return {
    payload: {
      athleteNote: 'Data is from the user log only; weights are stored in kg internally.',
      weightDisplayUnit: unit,
      session: {
        title: workout.title,
        completedDate: workout.completedAt ? new Date(workout.completedAt).toISOString().slice(0, 10) : null,
        durationMinutes: duration,
        notesPreview: notesPreview || null,
      },
      thisWorkout: {
        exercises: exerciseSummary,
        topLiftsByVolume: topByVolume,
        totalVolumeKgReps: totalVolume,
        totalWorkingSets: totalSets,
        totalRepsNonWarmup: totalReps,
        avgRepsPerWorkingSet: totalSets ? Math.round(totalReps / totalSets) : 0,
        muscleCategoriesHit: muscleGroups,
      },
      vsLastCompletedSession: previousSession
        ? {
            previous: previousSession,
            volumeChangePercentVsPrevious: volumeChangeVsLast,
          }
        : null,
      recentTrainingContext: {
        completedSessionsLast14Days: sessionsLast14,
        priorSessionsInWindowSampled: history.length,
        recentWorkoutsSummary: recentWorkoutsMini,
        yourTypicalSetsPerSessionRecently: recentAvgSets,
      },
    },
    fallback: WORKOUT_FALLBACK,
  };
}

export async function generateWorkoutReview(workoutId, userId) {
  const built = await buildWorkoutReviewPayload(workoutId, userId);
  if (!built) return null;

  const { payload, fallback } = built;

  const systemPrompt = `You are an experienced strength-training coach writing inside the IronLog app.
Use ONLY the JSON data provided. Do not invent exercises, weights, PRs, injuries, or medical facts.
Do not give medical advice, diagnoses, or treatment. If data is missing, say so briefly instead of guessing.

Your reply must be USEFUL and SPECIFIC to this single session. Every sentence should cite at least one concrete fact from the payload (exercise names, set counts, volume numbers, duration, muscle categories, comparison vs last session, notes preview, or 14-day frequency).
Do NOT fill space with generic platitudes ("great job", "keep pushing", "consistency is key", "stay motivated") unless the same sentence also names a number or lift from the data.
Do NOT reuse a fixed template: vary how you open the summary and how you order ideas from one answer to the next.
If volume vs previous session or category balance is in the data, mention it explicitly with the figures given.

Return ONLY valid JSON (no markdown, no code fences) with this exact shape:
{
  "summary": "string — 3-5 sentences tying together volume, duration, muscle balance vs recent sessions, and effort pattern. Reference specific numbers from the payload when helpful.",
  "contextUsed": "string — 1-2 sentences describing what you compared (e.g. last session volume, 14-day frequency, lift mix).",
  "whatWentWell": ["3-6 strings — concrete positives tied to the data"],
  "whatToImprove": ["2-5 strings — realistic gaps or imbalances (volume, rest, exercise variety, progression) based only on data"],
  "howToImprove": ["4-7 strings — specific actionable next steps: sets/reps ideas, scheduling, order, recovery habits, tracking — still no medical claims"],
  "highlights": ["1-3 short punchy wins"],
  "risks": ["0-3 overreach or imbalance risks inferred only from volume/trends; empty array if none"],
  "coaching": ["2-4 extra concise reminders"],
  "score": 0,
  "tone": "encouraging"
}
score: integer 0-100 for session quality vs their own recent pattern (not vs elite standards).
tone must be exactly "encouraging".`;

  const sessionLabel = payload.session?.title || 'Workout';
  const dateLabel = payload.session?.completedDate || 'unknown date';
  const userPrompt = `Analyze this workout and recent context only.
Session: "${sessionLabel}" (${dateLabel}). Give feedback that would not apply verbatim to a different log — tie everything to the JSON below.

${JSON.stringify(payload)}`;

  const raw = await callOpenRouter(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    fallback,
    { maxTokens: 2000, temperature: 0.82 }
  );

  return normalizeWorkoutReview(raw, fallback);
}
