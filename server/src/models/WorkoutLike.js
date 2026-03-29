import mongoose from 'mongoose';

const workoutLikeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    workoutId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workout', required: true },
  },
  { timestamps: true }
);

workoutLikeSchema.index({ userId: 1, workoutId: 1 }, { unique: true });
workoutLikeSchema.index({ workoutId: 1 });

export default mongoose.model('WorkoutLike', workoutLikeSchema);
