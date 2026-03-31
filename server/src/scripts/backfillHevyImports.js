import 'dotenv/config';
import mongoose from 'mongoose';
import { runHevyImportBackfill } from '../lib/backfillHevyImports.js';

const uri = process.env.MONGODB_URI?.trim();
if (!uri) {
  console.error('Set MONGODB_URI');
  process.exit(1);
}

await mongoose.connect(uri);
try {
  const r = await runHevyImportBackfill({
    fixCategories: true,
    awardSeasonPoints: true,
  });
  console.log('Hevy import backfill done:', r);
} finally {
  await mongoose.disconnect();
}

process.exit(0);
