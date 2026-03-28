/** @param {Date} d */
export function dateKeyInTimeZone(d, timeZone) {
  const tz = timeZone && String(timeZone).trim() ? timeZone : 'UTC';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }
}

/** Gregorian calendar add (YYYY-MM-DD). */
export function addCalendarDays(ymd, delta) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * @param {Set<string>} trainingDays YYYY-MM-DD keys (from dateKeyInTimeZone on completedAt)
 * @param {string} todayKey
 * @param {string} yesterdayKey
 */
export function computeCurrentStreak(trainingDays, todayKey, yesterdayKey) {
  let start = null;
  if (trainingDays.has(todayKey)) start = todayKey;
  else if (trainingDays.has(yesterdayKey)) start = yesterdayKey;
  else return 0;

  let streak = 0;
  let k = start;
  while (trainingDays.has(k)) {
    streak += 1;
    k = addCalendarDays(k, -1);
  }
  return streak;
}

/** Distinct training days in the inclusive window [today - (span-1), today]. */
export function countTrainingDaysInRollingWindow(trainingDays, todayKey, span) {
  const start = addCalendarDays(todayKey, -(span - 1));
  let n = 0;
  for (const day of trainingDays) {
    if (day >= start && day <= todayKey) n += 1;
  }
  return n;
}
