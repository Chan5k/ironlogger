/** `datetime-local` value in the user's local timezone (includes seconds for precision). */
export function toDatetimeLocalValue(isoOrDate) {
  if (!isoOrDate) return '';
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Parse `datetime-local` string → ISO UTC string, or null if empty/invalid. */
export function fromDatetimeLocalValue(s) {
  if (!s || !String(s).trim()) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Human-readable duration between start and end (or now if no end and live=true).
 */
/** Whole minutes between two datetime-local values; null if invalid or negative. */
export function diffMinutesFromLocal(startLocal, endLocal) {
  const a = fromDatetimeLocalValue(startLocal);
  const b = fromDatetimeLocalValue(endLocal);
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (ms < 0) return null;
  return Math.round(ms / 60000);
}

/** End datetime-local = start + totalMinutes. */
export function addMinutesToLocalDatetime(startLocal, totalMinutes) {
  const a = fromDatetimeLocalValue(startLocal);
  if (!a || totalMinutes < 0) return '';
  const d = new Date(new Date(a).getTime() + totalMinutes * 60000);
  return toDatetimeLocalValue(d);
}

/**
 * @param {string|null|undefined} startedAt ISO or parseable date
 * @param {string|null|undefined} completedAt ISO or null when in progress
 * @param {{ live?: boolean, now?: number }} opts - pass `now` from useLiveClock for sub-minute live updates
 */
export function formatWorkoutDuration(startedAt, completedAt, { live = false, now = null } = {}) {
  const start = startedAt ? new Date(startedAt).getTime() : NaN;
  if (Number.isNaN(start)) return '—';
  const endTs = completedAt
    ? new Date(completedAt).getTime()
    : live
      ? (typeof now === 'number' && !Number.isNaN(now) ? now : Date.now())
      : NaN;
  if (Number.isNaN(endTs)) return 'In progress…';
  if (endTs < start) return 'Invalid (end before start)';
  const ms = endTs - start;
  const totalSec = Math.floor(ms / 1000);
  const totalMin = Math.floor(totalSec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const sec = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
