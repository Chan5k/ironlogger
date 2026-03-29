import mongoose from 'mongoose';

const workoutCommentSchema = new mongoose.Schema(
  {
    workoutId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workout', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 800 },
  },
  { timestamps: true }
);

workoutCommentSchema.index({ workoutId: 1, createdAt: -1 });
workoutCommentSchema.index({ userId: 1 });

export default mongoose.model('WorkoutComment', workoutCommentSchema);
