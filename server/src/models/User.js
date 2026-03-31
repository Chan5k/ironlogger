import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    /** Set when the user confirms their email (new signups start as null until verified). */
    emailVerifiedAt: { type: Date, default: null },
    emailVerificationTokenHash: { type: String, default: '', trim: true },
    emailVerificationExpires: { type: Date, default: null },
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
    /** Monthly (UTC) competitive season id `YYYY-MM` last written for ladderSeasonPoints */
    ladderSeasonId: { type: String, default: '', trim: true },
    ladderSeasonPoints: { type: Number, default: 0, min: 0 },
    /** YYYY-MM-DD in user timezone: last day a daily first-workout bonus was granted */
    rankDailyBonusDayKey: { type: String, default: '', trim: true },
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
userSchema.index({ ladderSeasonId: 1, ladderSeasonPoints: -1, _id: 1 });

export default mongoose.model('User', userSchema);
