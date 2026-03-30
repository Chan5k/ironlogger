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
    /** Read-only admin UI: user list & detail, no destructive or privilege changes. */
    isSupport: { type: Boolean, default: false },
    /** Internal notes visible only via admin API (full admins may edit). */
    adminNotes: { type: String, default: '', trim: true, maxlength: 8000 },
    lastLoginAt: { type: Date, default: null },
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
    /** SHA-256 hex of personal activity import token (iOS Shortcuts → Apple Health). Not selected by default. */
    activitySyncTokenHash: { type: String, default: null, select: false },
    activitySyncTokenCreatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ publicProfileSlug: 1 }, { unique: true, sparse: true });
userSchema.index({ activitySyncTokenHash: 1 }, { sparse: true });

export default mongoose.model('User', userSchema);
