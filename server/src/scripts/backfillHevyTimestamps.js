import 'dotenv/config';
import mongoose from 'mongoose';
import { normalizeAllHevyTimestampsPending } from '../lib/backfillHevyTimestamps.js';

const uri = process.env.MONGODB_URI?.trim();
if (!uri) {
  console.error('Set MONGODB_URI');
  process.exit(1);
}

await mongoose.connect(uri);
try {
  const r = await normalizeAllHevyTimestampsPending();
  console.log('Hevy timestamp normalization done:', r);
} finally {
  await mongoose.disconnect();
}

process.exit(0);
