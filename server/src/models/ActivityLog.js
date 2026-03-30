import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dayKey: { type: String, required: true },
    steps: { type: Number, default: 0, min: 0 },
    activeCalories: { type: Number, default: 0, min: 0 },
    exerciseMinutes: { type: Number, default: 0, min: 0 },
    source: {
      type: String,
      enum: ['manual', 'healthkit_placeholder', 'apple_shortcut'],
      default: 'manual',
    },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

activityLogSchema.index({ userId: 1, dayKey: 1 }, { unique: true });

export default mongoose.model('ActivityLog', activityLogSchema);
