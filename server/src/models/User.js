import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, trim: true, default: '' },
    reminderEnabled: { type: Boolean, default: false },
    reminderTime: { type: String, default: '18:00' },
    reminderDays: [{ type: Number, min: 0, max: 6 }],
    timezone: { type: String, default: 'UTC' },
    weightUnit: { type: String, enum: ['kg', 'lbs'], default: 'kg' },
    isAdmin: { type: Boolean, default: false },
    publicProfileEnabled: { type: Boolean, default: false },
    publicProfileSlug: { type: String, trim: true, lowercase: true },
  },
  { timestamps: true }
);

userSchema.index({ publicProfileSlug: 1 }, { unique: true, sparse: true });

export default mongoose.model('User', userSchema);
