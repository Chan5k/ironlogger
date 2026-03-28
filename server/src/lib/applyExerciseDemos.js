import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import Exercise from '../models/Exercise.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, '../../data/exercise-demo-videos.json');

/**
 * Sets videoUrl on global exercises by exact name match.
 * Safe to run on every seed; only updates rows present in the JSON.
 */
export async function applyExerciseDemos() {
  let list;
  try {
    list = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.warn('Skipping exercise demos:', e.code === 'ENOENT' ? 'no exercise-demo-videos.json' : e.message);
    return { applied: 0, total: 0 };
  }
  if (!Array.isArray(list)) {
    console.warn('exercise-demo-videos.json must be an array');
    return { applied: 0, total: 0 };
  }

  let applied = 0;
  for (const row of list) {
    if (!row?.name || !row?.videoUrl) continue;
    const url = String(row.videoUrl).trim();
    if (!url.startsWith('https://')) continue;
    const r = await Exercise.updateOne(
      { isGlobal: true, name: row.name },
      { $set: { videoUrl: url } }
    );
    if (r.matchedCount > 0) applied += 1;
  }

  console.log(`Exercise demo videos: updated ${applied} / ${list.length} entries (matched global names)`);
  return { applied, total: list.length };
}
