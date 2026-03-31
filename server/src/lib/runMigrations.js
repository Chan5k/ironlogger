import mongoose from 'mongoose';
import User from '../models/User.js';

const MIGRATION_ID = 'email_verification_grandfather_v1';

/**
 * One-time: existing users had no emailVerifiedAt field — treat them as verified so the app
 * does not lock legacy accounts. New users explicitly store emailVerifiedAt: null.
 */
export async function runEmailVerificationGrandfather() {
  const coll = mongoose.connection.db.collection('app_migrations');
  const existing = await coll.findOne({ _id: MIGRATION_ID });
  if (existing) return { ran: false };

  const now = new Date();
  const r = await User.updateMany({ emailVerifiedAt: { $exists: false } }, { $set: { emailVerifiedAt: now } });

  await coll.insertOne({
    _id: MIGRATION_ID,
    completedAt: now,
    modifiedCount: r.modifiedCount ?? 0,
  });

  return { ran: true, modifiedCount: r.modifiedCount ?? 0 };
}
