const PREFIX = 'ironlog_workout_draft_v1_';

export function workoutDraftKey(workoutId, isNew) {
  return `${PREFIX}${isNew ? 'new' : workoutId}`;
}

/**
 * @param {string} key
 * @returns {object | null}
 */
export function loadWorkoutDraft(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object') return null;
    return d;
  } catch {
    return null;
  }
}

export function saveWorkoutDraft(key, payload) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        ...payload,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearWorkoutDraft(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
