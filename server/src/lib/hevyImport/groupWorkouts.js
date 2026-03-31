/**
 * @typedef {import('./importTypes.js').HevyCsvRow} HevyCsvRow
 * @typedef {import('./importTypes.js').HevyGroupedWorkout} HevyGroupedWorkout
 * @typedef {import('./importTypes.js').HevyGroupedExercise} HevyGroupedExercise
 */

import { dateKeyInTimeZone } from '../trainingStreak.js';

/**
 * @param {Date} a
 * @param {Date} b
 */
function minDate(a, b) {
  return a.getTime() <= b.getTime() ? a : b;
}

/**
 * @param {Date} a
 * @param {Date} b
 */
function maxDate(a, b) {
  return a.getTime() >= b.getTime() ? a : b;
}

/**
 * Group CSV rows into workouts (date + title) and exercises with sets.
 * @param {HevyCsvRow[]} rows
 * @param {{ timeZone?: string }} [opts]
 * @returns {HevyGroupedWorkout[]}
 */
export function groupHevyRowsIntoWorkouts(rows, opts = {}) {
  const tz = opts.timeZone && String(opts.timeZone).trim() ? opts.timeZone : 'UTC';
  /** @type {Map<string, { title: string, start: Date, end: Date | null, byExercise: Map<string, HevyCsvRow[]> }>} */
  const groups = new Map();

  for (const r of rows) {
    const dayKey = dateKeyInTimeZone(r.startTime, tz);
    const key = `${dayKey}\0${r.workoutTitle}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        title: r.workoutTitle,
        start: r.startTime,
        end: r.endTime,
        byExercise: new Map(),
      };
      groups.set(key, g);
    } else {
      g.start = minDate(g.start, r.startTime);
      if (r.endTime) {
        g.end = g.end ? maxDate(g.end, r.endTime) : r.endTime;
      }
    }
    const exName = r.exerciseName;
    let list = g.byExercise.get(exName);
    if (!list) {
      list = [];
      g.byExercise.set(exName, list);
    }
    list.push(r);
  }

  /** @type {HevyGroupedWorkout[]} */
  const workouts = [];
  for (const g of groups.values()) {
    /** @type {HevyGroupedExercise[]} */
    const exercises = [];
    let exOrder = 0;
    for (const [name, setRows] of g.byExercise.entries()) {
      const sorted = [...setRows].sort((a, b) => {
        if (a.setOrder !== b.setOrder) return a.setOrder - b.setOrder;
        return a.startTime.getTime() - b.startTime.getTime();
      });
      /** @type {HevyGroupedExercise} */
      const ex = {
        name,
        order: exOrder++,
        sets: sorted.map((s, i) => ({
          reps: s.reps,
          weight: Math.round(s.weightKg * 1000) / 1000,
          completed: s.reps > 0 || s.weightKg > 0,
          setType: /** @type {'warmup'|'normal'|'failure'} */ (s.setType),
          order: s.setOrder || i,
        })),
      };
      exercises.push(ex);
    }

    let durationMinutes = null;
    if (g.end && g.start) {
      const ms = g.end.getTime() - g.start.getTime();
      if (ms > 0) durationMinutes = Math.round(ms / 60000);
    }

    workouts.push({
      title: g.title,
      startedAt: g.start,
      completedAt: g.end || g.start,
      exercises,
      durationMinutes,
    });
  }

  workouts.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  return workouts;
}
