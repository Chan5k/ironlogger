import mongoose from 'mongoose';

const hevyImportBatchSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    importBatchId: { type: String, required: true, trim: true },
    contentSha256: { type: String, required: true, trim: true },
    workoutsImported: { type: Number, default: 0, min: 0 },
    workoutsSkipped: { type: Number, default: 0, min: 0 },
    seasonPointsAwarded: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

hevyImportBatchSchema.index({ userId: 1, createdAt: -1 });
hevyImportBatchSchema.index({ userId: 1, contentSha256: 1 });

export default mongoose.model('HevyImportBatch', hevyImportBatchSchema);
