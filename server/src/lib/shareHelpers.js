import crypto from 'crypto';
import mongoose from 'mongoose';
import Exercise, { EXERCISE_CATEGORIES } from '../models/Exercise.js';

export function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function newShareToken() {
  return crypto.randomBytes(18).toString('base64url');
}

export function buildWorkoutSnapshot(w) {
  return {
    title: w.title,
    notes: w.notes || '',
    exercises: (w.exercises || []).map((e, order) => ({
      name: e.name,
      category: e.category || 'other',
      sourceExerciseId: e.exerciseId ? String(e.exerciseId) : null,
      order,
      sets: (e.sets || []).map((s) => ({
        reps: s.reps ?? 0,
        weight: s.weight ?? 0,
        setType: s.setType || 'normal',
      })),
    })),
  };
}

export async function buildTemplateSnapshot(t) {
  const ids = (t.items || []).map((i) => i.exerciseId).filter(Boolean);
  const exercises = await Exercise.find({ _id: { $in: ids } })
    .select('name category')
    .lean();
  const byId = new Map(exercises.map((e) => [e._id.toString(), e]));
  return {
    name: t.name,
    description: t.description || '',
    items: (t.items || []).map((i, order) => {
      const ex = byId.get(String(i.exerciseId));
      return {
        exerciseName: i.exerciseName || ex?.name || 'Exercise',
        category: ex?.category || 'other',
        sourceExerciseId: i.exerciseId ? String(i.exerciseId) : null,
        defaultSets: i.defaultSets ?? 3,
        defaultReps: i.defaultReps ?? 0,
        defaultWeight: i.defaultWeight ?? 0,
        order,
        itemNotes: i.itemNotes || '',
      };
    }),
  };
}

function normalizeHttpsVideoUrl(raw) {
  if (raw == null || typeof raw !== 'string') return '';
  const t = raw.trim();
  if (!t.startsWith('https://')) return '';
  return t.slice(0, 500);
}

/**
 * Attach a demo URL only to the user’s own non-global exercise when it has no video yet.
 */
async function applyHevyVideoIfMissing(exerciseId, userId, rawUrl) {
  const videoUrl = normalizeHttpsVideoUrl(rawUrl);
  if (!videoUrl) return;
  const ex = await Exercise.findById(exerciseId).select('userId isGlobal videoUrl').lean();
  if (!ex || ex.isGlobal) return;
  if (ex.userId?.toString() !== String(userId)) return;
  if (ex.videoUrl && String(ex.videoUrl).trim()) return;
  await Exercise.updateOne({ _id: exerciseId }, { $set: { videoUrl } });
}

/**
 * Resolve an exercise for the importing user: reuse global/their doc, match by name, or create custom.
 * @param {{ videoUrl?: string }} [opts] Optional HTTPS demo URL (e.g. from Hevy plan import).
 */
export async function resolveExerciseForUser(userId, sourceExerciseId, name, category, opts) {
  const cat = EXERCISE_CATEGORIES.includes(category) ? category : 'other';
  const uid = new mongoose.Types.ObjectId(userId);
  const hevyVideo = opts?.videoUrl;

  if (sourceExerciseId && mongoose.Types.ObjectId.isValid(sourceExerciseId)) {
    const ex = await Exercise.findById(sourceExerciseId).lean();
    if (ex && (ex.isGlobal || ex.userId?.toString() === userId)) {
      const id = new mongoose.Types.ObjectId(ex._id);
      await applyHevyVideoIfMissing(id, userId, hevyVideo);
      return id;
    }
  }

  const global = await Exercise.findOne({
    isGlobal: true,
    name: new RegExp(`^${escapeRegex(name.trim())}$`, 'i'),
  }).lean();
  if (global) return new mongoose.Types.ObjectId(global._id);

  const mine = await Exercise.findOne({
    userId: uid,
    isGlobal: false,
    name: new RegExp(`^${escapeRegex(name.trim())}$`, 'i'),
  }).lean();
  if (mine) {
    const id = new mongoose.Types.ObjectId(mine._id);
    await applyHevyVideoIfMissing(id, userId, hevyVideo);
    return id;
  }

  const videoUrl = normalizeHttpsVideoUrl(hevyVideo);
  const created = await Exercise.create({
    name: name.trim(),
    category: cat,
    userId: uid,
    isGlobal: false,
    notes: '',
    videoUrl,
  });
  return created._id;
}
