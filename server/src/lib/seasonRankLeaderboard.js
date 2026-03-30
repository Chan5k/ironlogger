import User from '../models/User.js';
import {
  currentSeasonIdUTC,
  rankFromSeasonPoints,
  seasonBoundsUTC,
  seasonDisplayLabel,
} from './rankLadder.js';
import { hydrateLeaderboardRows, resolveViewerFollowingIds } from './leaderboards.js';

export async function seasonRankRows(userIds, seasonId, skip, limit) {
  const q = {
    ladderSeasonId: seasonId,
    ladderSeasonPoints: { $gt: 0 },
  };
  if (userIds?.length) {
    q._id = { $in: userIds };
  }

  const [rows, totalUsers] = await Promise.all([
    User.find(q)
      .sort({ ladderSeasonPoints: -1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .select('ladderSeasonPoints')
      .lean(),
    User.countDocuments(q),
  ]);

  return {
    rows: rows.map((r) => ({ userId: r._id, value: r.ladderSeasonPoints })),
    totalUsers,
  };
}

export async function buildSeasonRankLeaderboard({ scope, page, limit, viewerId }) {
  const seasonId = currentSeasonIdUTC();
  const skip = (page - 1) * limit;
  const viewerIdStr = String(viewerId);

  let userIds = null;
  if (scope === 'following') {
    userIds = await resolveViewerFollowingIds(viewerId);
  }

  const result = await seasonRankRows(userIds, seasonId, skip, limit);
  const entriesRaw = await hydrateLeaderboardRows(result.rows, viewerIdStr);
  const rankOffset = skip;
  const bounds = seasonBoundsUTC(seasonId);

  const entries = entriesRaw.map((e, i) => {
    const r = rankFromSeasonPoints(e.value);
    return {
      ...e,
      rank: rankOffset + i + 1,
      rankLabel: r.label,
      rankIconId: r.iconId,
    };
  });

  return {
    entries,
    totalUsers: result.totalUsers,
    page,
    limit,
    hasMore: skip + result.rows.length < result.totalUsers,
    seasonId,
    seasonLabel: seasonDisplayLabel(seasonId),
    seasonStartsAt: bounds?.start?.toISOString() ?? null,
    seasonEndsAt: bounds?.end?.toISOString() ?? null,
    metricNote: 'Ranked by seasonal ladder points (UTC month). +15 per workout, up to +25 volume bonus, +5 first workout of your day.',
  };
}
