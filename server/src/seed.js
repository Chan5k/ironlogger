import 'dotenv/config';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Exercise, { EXERCISE_CATEGORIES } from './models/Exercise.js';
import { applyExerciseDemos } from './lib/applyExerciseDemos.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, '../data/seed-exercises.json');

function loadLibrary() {
  const raw = readFileSync(DATA_FILE, 'utf8');
  const list = JSON.parse(raw);
  if (!Array.isArray(list)) {
    throw new Error('seed-exercises.json must be an array');
  }
  for (const row of list) {
    if (!row.name || !EXERCISE_CATEGORIES.includes(row.category)) {
      throw new Error(`Invalid row: ${JSON.stringify(row)}`);
    }
  }
  return list;
}

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Set MONGODB_URI in .env');
    process.exit(1);
  }

  const library = loadLibrary();
  await mongoose.connect(uri);

  const existing = await Exercise.find({ isGlobal: true }).select('name').lean();
  const seen = new Set(existing.map((e) => e.name.trim().toLowerCase()));

  const toInsert = [];
  for (const e of library) {
    const key = e.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    toInsert.push({
      name: e.name.trim(),
      category: e.category,
      isGlobal: true,
      userId: null,
      notes: '',
    });
  }

  if (toInsert.length === 0) {
    console.log('Library up to date:', seen.size, 'global exercises');
  } else {
    await Exercise.insertMany(toInsert, { ordered: false });
    console.log('Inserted', toInsert.length, 'new global exercises (' + seen.size + ' total)');
  }

  await applyExerciseDemos();
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
