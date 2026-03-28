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

/**
 * Resolve an exercise for the importing user: reuse global/their doc, match by name, or create custom.
 */
export async function resolveExerciseForUser(userId, sourceExerciseId, name, category) {
  const cat = EXERCISE_CATEGORIES.includes(category) ? category : 'other';
  const uid = new mongoose.Types.ObjectId(userId);

  if (sourceExerciseId && mongoose.Types.ObjectId.isValid(sourceExerciseId)) {
    const ex = await Exercise.findById(sourceExerciseId).lean();
    if (ex && (ex.isGlobal || ex.userId?.toString() === userId)) {
      return new mongoose.Types.ObjectId(ex._id);
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
  if (mine) return new mongoose.Types.ObjectId(mine._id);

  const created = await Exercise.create({
    name: name.trim(),
    category: cat,
    userId: uid,
    isGlobal: false,
    notes: '',
  });
  return created._id;
}
