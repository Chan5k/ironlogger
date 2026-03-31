import { dateKeyInTimeZone } from '../trainingStreak.js';

/**
 * @param {Date} startedAt
 */
export function hevyUtcDateKey(startedAt) {
  return new Date(startedAt).toISOString().slice(0, 10);
}

/** @param {string} title */
export function normalizeHevyWorkoutTitle(title) {
  return String(title || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Calendar day in the user's timezone + title — matches grouping and dashboard streak days.
 * @param {Date} startedAt
 * @param {string} title
 * @param {string} [timeZone] IANA zone from user profile (default UTC)
 */
export function buildHevyImportKey(startedAt, title, timeZone = 'UTC') {
  const tz = timeZone && String(timeZone).trim() ? timeZone : 'UTC';
  const day = dateKeyInTimeZone(new Date(startedAt), tz);
  return `${day}|${normalizeHevyWorkoutTitle(title)}`;
}
