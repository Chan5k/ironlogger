import mongoose from 'mongoose';

const KINDS = ['kudos', 'comment'];

const profileWallEntrySchema = new mongoose.Schema(
  {
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: KINDS, required: true },
    body: { type: String, default: '', trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

profileWallEntrySchema.index({ targetUserId: 1, createdAt: -1 });
profileWallEntrySchema.index(
  { targetUserId: 1, authorId: 1 },
  { unique: true, partialFilterExpression: { kind: 'kudos' } }
);

export default mongoose.model('ProfileWallEntry', profileWallEntrySchema);
