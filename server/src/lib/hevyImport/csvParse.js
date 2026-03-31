import { parse } from 'csv-parse/sync';
import { parseHevyDateTime } from './parseHevyDateTime.js';

/**
 * @typedef {import('./importTypes.js').HevyCsvRow} HevyCsvRow
 */

const MAX_ROWS = 50_000;

/** @param {unknown} v */
function normHeader(v) {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[()]/g, '');
}

/** @param {Record<string, string>} row */
function mapHeaders(row) {
  const keys = Object.keys(row);
  const map = new Map();
  for (const k of keys) {
    map.set(normHeader(k), k);
  }
  return map;
}

/** @param {Map<string, string>} m @param {string[]} aliases */
function col(m, aliases) {
  for (const a of aliases) {
    const k = m.get(normHeader(a));
    if (k) return k;
  }
  return null;
}

/** @param {string} s */
function parseNumber(s) {
  if (s == null || s === '') return NaN;
  const t = String(s).trim().replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Parse Hevy-style CSV buffer. Column names are matched flexibly.
 * @param {Buffer|string} input
 * @param {{ weightUnit?: 'kg'|'lbs', timeZone?: string }} [opts]
 * @returns {HevyCsvRow[]}
 */
export function parseHevyCsv(input, opts = {}) {
  const weightUnit = opts.weightUnit === 'lbs' ? 'lbs' : 'kg';
  const timeZone = opts.timeZone;
  const text = Buffer.isBuffer(input) ? input.toString('utf8') : String(input);
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true,
  });
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('CSV has no data rows');
  }
  if (records.length > MAX_ROWS) {
    throw new Error(`CSV exceeds ${MAX_ROWS} rows`);
  }

  const first = records[0];
  if (typeof first !== 'object' || first === null) {
    throw new Error('Invalid CSV structure');
  }
  const headerMap = mapHeaders(/** @type {Record<string, string>} */ (first));

  const workoutKey = col(headerMap, [
    'workout_title',
    'workout_name',
    'workout',
    'title',
    'routine_title',
  ]);
  const startKey = col(headerMap, ['start_time', 'start', 'date', 'workout_start', 'started_at']);
  const endKey = col(headerMap, ['end_time', 'end', 'workout_end', 'completed_at']);
  const exerciseKey = col(headerMap, [
    'exercise_title',
    'exercise_name',
    'exercise',
    'movement',
    'lift',
  ]);
  const weightKey = col(headerMap, [
    'weight_kg',
    'weightkg',
    'weight',
    'weight_lbs',
    'weightlbs',
    'weight_lb',
  ]);
  const repsKey = col(headerMap, ['reps', 'rep', 'repetitions']);
  const setKey = col(headerMap, ['set_index', 'set_order', 'set_number', 'set', 'set_no']);
  const typeKey = col(headerMap, ['set_type', 'type', 'category']);

  if (!workoutKey || !exerciseKey) {
    throw new Error(
      'CSV must include workout and exercise columns (e.g. workout title, exercise title)'
    );
  }
  if (!startKey && !endKey) {
    throw new Error('CSV must include a start or end time column');
  }

  /** @type {HevyCsvRow[]} */
  const out = [];
  for (const rec of records) {
    const row = /** @type {Record<string, string>} */ (rec);
    const workoutTitle = String(row[workoutKey] ?? '').trim();
    const exerciseName = String(row[exerciseKey] ?? '').trim();
    if (!workoutTitle || !exerciseName) continue;

    const startRaw = startKey ? row[startKey] : '';
    const endRaw = endKey ? row[endKey] : '';
    let startTime = startKey ? parseHevyDateTime(startRaw, timeZone) : null;
    let endTime = endKey ? parseHevyDateTime(endRaw, timeZone) : null;
    if (!startTime && endTime) startTime = endTime;
    if (startTime && !endTime) endTime = startTime;

    if (!startTime) continue;

    let weight = weightKey ? parseNumber(row[weightKey]) : 0;
    if (!Number.isFinite(weight)) weight = 0;
    const wk = weightKey ? normHeader(weightKey) : '';
    const isLbsColumn =
      weightUnit === 'lbs' || /lb|lbs|pound/.test(wk) || wk === 'weight_lbs';
    const weightKg = isLbsColumn && weight > 0 ? weight * 0.45359237 : weight;

    let reps = repsKey ? parseNumber(row[repsKey]) : 0;
    if (!Number.isFinite(reps) || reps < 0) reps = 0;

    let setOrder = setKey ? Math.floor(parseNumber(row[setKey])) : out.length;
    if (!Number.isFinite(setOrder)) setOrder = 0;

    let setType = 'normal';
    const tRaw = typeKey ? String(row[typeKey] ?? '').toLowerCase() : '';
    if (tRaw.includes('warm')) setType = 'warmup';
    else if (tRaw.includes('fail')) setType = 'failure';

    out.push({
      workoutTitle,
      startTime,
      endTime,
      exerciseName,
      weightKg,
      reps,
      setOrder,
      setType: /** @type {'warmup'|'normal'|'failure'} */ (setType),
    });
  }

  if (out.length === 0) {
    throw new Error('No valid workout rows found in CSV');
  }
  return out;
}
