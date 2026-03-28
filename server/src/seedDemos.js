import 'dotenv/config';
import mongoose from 'mongoose';
import { applyExerciseDemos } from './lib/applyExerciseDemos.js';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('Set MONGODB_URI in .env');
  process.exit(1);
}

await mongoose.connect(uri);
await applyExerciseDemos();
await mongoose.disconnect();
