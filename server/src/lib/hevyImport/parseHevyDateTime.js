import { DateTime } from 'luxon';

/**
 * @param {string} [tz]
 */
function normalizeZone(tz) {
  const t = tz && String(tz).trim() ? String(tz).trim() : 'UTC';
  const probe = DateTime.now().setZone(t);
  return probe.isValid ? t : 'UTC';
}

/**
 * Parse Hevy CSV datetime strings into a JS Date (UTC instant).
 * Values without an explicit offset are interpreted as wall time in the user's IANA timezone
 * (same as dashboard streak), not the server's local clock.
 *
 * @param {string} raw
 * @param {string} [timeZone] IANA zone from user profile
 * @returns {Date | null}
 */
export function parseHevyDateTime(raw, timeZone) {
  const zone = normalizeZone(timeZone);
  const s = String(raw ?? '').trim();
  if (!s) return null;

  const hasExplicitZone = /[zZ]$|[+-]\d{2}:\d{2}$|[+-]\d{4}$/.test(s);

  if (hasExplicitZone) {
    const iso = s.includes('T') ? s : s.replace(' ', 'T');
    const dt = DateTime.fromISO(iso, { setZone: true });
    if (dt.isValid) return dt.toJSDate();
  }

  const formats = [
    'yyyy-MM-dd HH:mm:ss.SSS',
    'yyyy-MM-dd HH:mm:ss',
    'yyyy-MM-dd HH:mm',
    'yyyy-MM-dd',
    "yyyy-MM-dd'T'HH:mm:ss.SSS",
    "yyyy-MM-dd'T'HH:mm:ss",
    "yyyy-MM-dd'T'HH:mm",
    'MM/dd/yyyy HH:mm:ss',
    'MM/dd/yyyy H:mm:ss',
    'MM/dd/yyyy HH:mm',
    'dd/MM/yyyy HH:mm:ss',
    'dd/MM/yyyy HH:mm',
    'dd.MM.yyyy HH:mm:ss',
    'dd.MM.yyyy HH:mm',
  ];

  for (const fmt of formats) {
    const dt = DateTime.fromFormat(s, fmt, { zone });
    if (dt.isValid) return dt.toUTC().toJSDate();
  }

  const withT = s.replace(' ', 'T');
  const dtIso = DateTime.fromISO(withT, { zone });
  if (dtIso.isValid) return dtIso.toUTC().toJSDate();

  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}
