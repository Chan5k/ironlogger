import 'dotenv/config';
import mongoose from 'mongoose';
import { recalculateAllUsersSeasonPoints } from '../lib/recalculateSeasonLadderPoints.js';
import { currentSeasonIdUTC } from '../lib/rankLadder.js';

const uri = process.env.MONGODB_URI?.trim();
if (!uri) {
  console.error('Set MONGODB_URI');
  process.exit(1);
}

const seasonArg = process.argv[2]?.trim();
const seasonId = seasonArg && /^\d{4}-\d{2}$/.test(seasonArg) ? seasonArg : currentSeasonIdUTC();

await mongoose.connect(uri);
try {
  const r = await recalculateAllUsersSeasonPoints(seasonId);
  console.log(
    `Recalculated season ${r.seasonId}: ${r.usersUpdated} users updated, ${r.usersSkipped} skipped (unverified).`
  );
} finally {
  await mongoose.disconnect();
}

process.exit(0);
