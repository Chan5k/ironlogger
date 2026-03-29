import mongoose from 'mongoose';

const GOAL_TYPES = ['strength', 'frequency', 'volume'];

const goalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: GOAL_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    /** Strength: target weight (same unit as user workouts). Frequency: sessions per rolling 7d. Volume: kg×reps per rolling 7d. */
    targetValue: { type: Number, required: true, min: 0 },
    /** For type=strength: match exercise name (case-insensitive) */
    strengthExerciseName: { type: String, trim: true, default: '' },
    deadline: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

goalSchema.index({ userId: 1, completedAt: 1, createdAt: -1 });

export default mongoose.model('Goal', goalSchema);
export { GOAL_TYPES };
