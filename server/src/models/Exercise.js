import mongoose from 'mongoose';

export const EXERCISE_CATEGORIES = [
  'chest',
  'legs',
  'back',
  'shoulders',
  'arms',
  'cardio',
  'core',
  'other',
];

const exerciseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, enum: EXERCISE_CATEGORIES, default: 'other' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isGlobal: { type: Boolean, default: false },
    notes: { type: String, default: '' },
    /** HTTPS demo URL (e.g. YouTube watch or embed). Shown in library. */
    videoUrl: { type: String, default: '', trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

exerciseSchema.index({ userId: 1, name: 1 });
exerciseSchema.index({ isGlobal: 1, category: 1 });

export default mongoose.model('Exercise', exerciseSchema);
