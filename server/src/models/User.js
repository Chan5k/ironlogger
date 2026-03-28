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
    /** Web Push subscriptions for reminder notifications when the app is closed */
    pushSubscriptions: [
      {
        endpoint: { type: String, required: true },
        keys: {
          p256dh: { type: String, default: '' },
          auth: { type: String, default: '' },
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

userSchema.index({ publicProfileSlug: 1 }, { unique: true, sparse: true });

export default mongoose.model('User', userSchema);
