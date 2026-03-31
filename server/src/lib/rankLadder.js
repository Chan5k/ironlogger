/** UTC calendar month season id: `YYYY-MM`. */
export function currentSeasonIdUTC(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** @param {string} seasonId `YYYY-MM` */
export function parseSeasonId(seasonId) {
  const [ys, ms] = String(seasonId).split('-');
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return { y, m };
}

/** First / last instant (UTC) of the season month. */
export function seasonBoundsUTC(seasonId) {
  const p = parseSeasonId(seasonId);
  if (!p) return null;
  const { y, m } = p;
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { start, end };
}

/** Human label e.g. "March 2026". */
export function seasonDisplayLabel(seasonId) {
  const p = parseSeasonId(seasonId);
  if (!p) return seasonId;
  const d = new Date(Date.UTC(p.y, p.m - 1, 1));
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}

/**
 * 45 ranks: fifteen tiers × three divisions (division 3 is highest within each tier).
 * `minPoints` is inclusive lower bound for that step.
 */
export const RANK_LADDER = [
  { iconId: 'wood-1', tier: 'Wood', sub: 1, minPoints: 0 },
  { iconId: 'wood-2', tier: 'Wood', sub: 2, minPoints: 12 },
  { iconId: 'wood-3', tier: 'Wood', sub: 3, minPoints: 28 },
  { iconId: 'iron-1', tier: 'Iron', sub: 1, minPoints: 48 },
  { iconId: 'iron-2', tier: 'Iron', sub: 2, minPoints: 72 },
  { iconId: 'iron-3', tier: 'Iron', sub: 3, minPoints: 100 },
  { iconId: 'silver-1', tier: 'Silver', sub: 1, minPoints: 132 },
  { iconId: 'silver-2', tier: 'Silver', sub: 2, minPoints: 168 },
  { iconId: 'silver-3', tier: 'Silver', sub: 3, minPoints: 208 },
  { iconId: 'gold-1', tier: 'Gold', sub: 1, minPoints: 252 },
  { iconId: 'gold-2', tier: 'Gold', sub: 2, minPoints: 300 },
  { iconId: 'gold-3', tier: 'Gold', sub: 3, minPoints: 352 },
  { iconId: 'platinum-1', tier: 'Platinum', sub: 1, minPoints: 408 },
  { iconId: 'platinum-2', tier: 'Platinum', sub: 2, minPoints: 470 },
  { iconId: 'platinum-3', tier: 'Platinum', sub: 3, minPoints: 536 },
  { iconId: 'emerald-1', tier: 'Emerald', sub: 1, minPoints: 608 },
  { iconId: 'emerald-2', tier: 'Emerald', sub: 2, minPoints: 686 },
  { iconId: 'emerald-3', tier: 'Emerald', sub: 3, minPoints: 770 },
  { iconId: 'diamond-1', tier: 'Diamond', sub: 1, minPoints: 860 },
  { iconId: 'diamond-2', tier: 'Diamond', sub: 2, minPoints: 956 },
  { iconId: 'diamond-3', tier: 'Diamond', sub: 3, minPoints: 1060 },
  { iconId: 'master-1', tier: 'Master', sub: 1, minPoints: 1170 },
  { iconId: 'master-2', tier: 'Master', sub: 2, minPoints: 1290 },
  { iconId: 'master-3', tier: 'Master', sub: 3, minPoints: 1420 },
  { iconId: 'ultimate-champion-1', tier: 'Ultimate Champion', sub: 1, minPoints: 1560 },
  { iconId: 'ultimate-champion-2', tier: 'Ultimate Champion', sub: 2, minPoints: 1710 },
  { iconId: 'ultimate-champion-3', tier: 'Ultimate Champion', sub: 3, minPoints: 1880 },
  { iconId: 'astral-1', tier: 'Astral', sub: 1, minPoints: 2060 },
  { iconId: 'astral-2', tier: 'Astral', sub: 2, minPoints: 2250 },
  { iconId: 'astral-3', tier: 'Astral', sub: 3, minPoints: 2450 },
  { iconId: 'mythic-1', tier: 'Mythic', sub: 1, minPoints: 2680 },
  { iconId: 'mythic-2', tier: 'Mythic', sub: 2, minPoints: 2920 },
  { iconId: 'mythic-3', tier: 'Mythic', sub: 3, minPoints: 3180 },
  { iconId: 'celestial-1', tier: 'Celestial', sub: 1, minPoints: 3460 },
  { iconId: 'celestial-2', tier: 'Celestial', sub: 2, minPoints: 3760 },
  { iconId: 'celestial-3', tier: 'Celestial', sub: 3, minPoints: 4080 },
  { iconId: 'eternal-1', tier: 'Eternal', sub: 1, minPoints: 4430 },
  { iconId: 'eternal-2', tier: 'Eternal', sub: 2, minPoints: 4800 },
  { iconId: 'eternal-3', tier: 'Eternal', sub: 3, minPoints: 5190 },
  { iconId: 'transcendent-1', tier: 'Transcendent', sub: 1, minPoints: 5610 },
  { iconId: 'transcendent-2', tier: 'Transcendent', sub: 2, minPoints: 6060 },
  { iconId: 'transcendent-3', tier: 'Transcendent', sub: 3, minPoints: 6540 },
  { iconId: 'sovereign-1', tier: 'Sovereign', sub: 1, minPoints: 7060 },
  { iconId: 'sovereign-2', tier: 'Sovereign', sub: 2, minPoints: 7620 },
  { iconId: 'sovereign-3', tier: 'Sovereign', sub: 3, minPoints: 8220 },
];

/** Static steps for clients (full ladder, lowest index = entry rank). */
export function getRankLadderSteps() {
  return RANK_LADDER.map((step, index) => {
    const label =
      step.tier === 'Ultimate Champion' ? `Ultimate Champion ${step.sub}` : `${step.tier} ${step.sub}`;
    return { index, iconId: step.iconId, label, minPoints: step.minPoints };
  });
}

const TOP_INDEX = RANK_LADDER.length - 1;

export function rankFromSeasonPoints(points) {
  const p = Math.max(0, Number(points) || 0);
  let idx = 0;
  for (let i = 0; i < RANK_LADDER.length; i += 1) {
    if (p >= RANK_LADDER[i].minPoints) idx = i;
    else break;
  }
  const step = RANK_LADDER[idx];
  const label =
    step.tier === 'Ultimate Champion' ? `Ultimate Champion ${step.sub}` : `${step.tier} ${step.sub}`;
  const nextStep = RANK_LADDER[idx + 1];
  const pointsToNext = nextStep ? nextStep.minPoints - p : 0;
  const nextLabel = nextStep
    ? nextStep.tier === 'Ultimate Champion'
      ? `Ultimate Champion ${nextStep.sub}`
      : `${nextStep.tier} ${nextStep.sub}`
    : null;
  return {
    index: idx,
    iconId: step.iconId,
    tier: step.tier,
    sub: step.sub,
    label,
    pointsToNext,
    nextLabel,
    isMaxRank: idx >= TOP_INDEX,
  };
}

export function seasonRankPayloadForUser(user) {
  const seasonId = currentSeasonIdUTC();
  const seasonPoints =
    user.ladderSeasonId === seasonId ? Math.max(0, Number(user.ladderSeasonPoints) || 0) : 0;
  const rank = rankFromSeasonPoints(seasonPoints);
  const bounds = seasonBoundsUTC(seasonId);
  return {
    seasonId,
    seasonLabel: seasonDisplayLabel(seasonId),
    seasonStartsAt: bounds?.start?.toISOString() ?? null,
    seasonEndsAt: bounds?.end?.toISOString() ?? null,
    seasonPoints,
    rankLabel: rank.label,
    /** Tier name (Wood … Ultimate Champion) — public “division”. */
    division: rank.tier,
    /** Sub-rank within the tier (1–3; 3 is highest). */
    rankLevel: rank.sub,
    rankIconId: rank.iconId,
    rankIndex: rank.index,
    pointsToNextRank: rank.isMaxRank ? 0 : rank.pointsToNext,
    nextRankLabel: rank.nextLabel,
    isMaxRank: rank.isMaxRank,
  };
}
