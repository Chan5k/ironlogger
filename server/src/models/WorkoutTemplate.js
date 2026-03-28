import mongoose from 'mongoose';

const templateItemSchema = new mongoose.Schema(
  {
    exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },
    exerciseName: { type: String, required: true },
    defaultSets: { type: Number, default: 3, min: 1 },
    defaultReps: { type: Number, default: 0, min: 0 },
    defaultWeight: { type: Number, default: 0, min: 0 },
    order: { type: Number, default: 0 },
    itemNotes: { type: String, default: '' },
  },
  { _id: true }
);

const workoutTemplateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    items: [templateItemSchema],
  },
  { timestamps: true }
);

export default mongoose.model('WorkoutTemplate', workoutTemplateSchema);
