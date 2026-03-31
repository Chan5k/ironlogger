import { EXERCISE_CATEGORIES } from '../../models/Exercise.js';

const HEVY_API_BASE = 'https://api.hevyapp.com/';
const DEFAULT_WEB_API_KEY = 'shelobs_hevy_web';

/** @type {Record<string, string>} */
const MUSCLE_TO_CATEGORY = {
  chest: 'chest',
  shoulders: 'shoulders',
  biceps: 'arms',
  triceps: 'arms',
  forearms: 'arms',
  lats: 'back',
  upper_back: 'back',
  lower_back: 'back',
  traps: 'back',
  neck: 'shoulders',
  quadriceps: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'legs',
  abductors: 'legs',
  adductors: 'legs',
  hips: 'legs',
  abdominals: 'core',
  obliques: 'core',
  waist: 'core',
  cardio: 'cardio',
  full_body: 'other',
};

/**
 * @param {string | null | undefined} muscle
 * @returns {string}
 */
export function hevyMuscleGroupToCategory(muscle) {
  const k = String(muscle || '')
    .trim()
    .toLowerCase();
  const c = MUSCLE_TO_CATEGORY[k] || 'other';
  return EXERCISE_CATEGORIES.includes(c) ? c : 'other';
}

/**
 * @param {string} raw
 * @returns {string | null}
 */
export function extractHevyRoutineShortId(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  let u;
  try {
    u = new URL(/^[a-zA-Z][a-zA-Z+.-]*:\/\//.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./i, '').toLowerCase();
  if (host !== 'hevy.com') return null;
  const m = u.pathname.match(/\/routine\/([^/]+)\/?$/i);
  if (!m) return null;
  const id = m[1].trim();
  return id.length >= 8 && id.length <= 64 ? id : null;
}

/**
 * @param {string} shortId
 * @returns {Promise<{ routine: object }>}
 */
export async function fetchHevyRoutineByShortId(shortId) {
  const apiKey = String(process.env.HEVY_WEB_API_KEY || DEFAULT_WEB_API_KEY).trim() || DEFAULT_WEB_API_KEY;
  const url = new URL(`routine_with_short_id/${encodeURIComponent(shortId)}`, HEVY_API_BASE);
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'Hevy-Platform': 'web',
    },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('HEVY_ROUTINE_PARSE');
  }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('HEVY_ROUTINE_UNAUTHORIZED');
    }
    if (res.status === 404) {
      throw new Error('HEVY_ROUTINE_NOT_FOUND');
    }
    throw new Error('HEVY_ROUTINE_HTTP');
  }
  if (!data?.routine || !Array.isArray(data.routine.exercises)) {
    throw new Error('HEVY_ROUTINE_INVALID');
  }
  return data;
}
