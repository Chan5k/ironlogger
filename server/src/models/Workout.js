import mongoose from 'mongoose';

export const SET_TYPES = ['warmup', 'normal', 'failure'];

const setSchema = new mongoose.Schema(
  {
    reps: { type: Number, default: 0, min: 0 },
    weight: { type: Number, default: 0, min: 0 },
    completed: { type: Boolean, default: false },
    setType: { type: String, enum: SET_TYPES, default: 'normal' },
  },
  { _id: true }
);

const workoutExerciseSchema = new mongoose.Schema(
  {
    exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', default: null },
    name: { type: String, required: true },
    category: { type: String, default: 'other' },
    sets: [setSchema],
    order: { type: Number, default: 0 },
  },
  { _id: true }
);

const workoutSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    notes: { type: String, default: '' },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkoutTemplate', default: null },
    /** True after seasonal rank points were granted for this completion */
    ladderPointsAwarded: { type: Boolean, default: false },
    exercises: [workoutExerciseSchema],
  },
  { timestamps: true }
);

workoutSchema.index({ userId: 1, startedAt: -1 });
workoutSchema.index({ userId: 1, completedAt: -1 });

export default mongoose.model('Workout', workoutSchema);
