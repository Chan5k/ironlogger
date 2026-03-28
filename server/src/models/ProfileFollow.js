import mongoose from 'mongoose';

const profileFollowSchema = new mongoose.Schema(
  {
    followerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

profileFollowSchema.index({ followerId: 1, targetUserId: 1 }, { unique: true });
profileFollowSchema.index({ targetUserId: 1 });

export default mongoose.model('ProfileFollow', profileFollowSchema);
