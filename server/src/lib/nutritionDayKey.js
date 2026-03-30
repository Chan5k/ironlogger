/**
 * Calendar day keys (YYYY-MM-DD) aligned to Europe/Bucharest so "today" matches
 * Romanian users regardless of server UTC date around midnight.
 */
const BUCHAREST_TZ = 'Europe/Bucharest';

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDayKey(s) {
  if (typeof s !== 'string' || !DAY_KEY_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map((x) => Number(x));
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * @param {Date} [date]
 * @returns {string}
 */
export function dayKeyInBucharest(date = new Date()) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUCHAREST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * @param {string} dayKey
 * @param {number} deltaDays negative = past
 */
export function shiftDayKey(dayKey, deltaDays) {
  if (!isValidDayKey(dayKey)) return null;
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
