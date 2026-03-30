const PREFIX = 'ironlog_workout_draft_v1_';

/** Tab-scoped id so each explicit "new workout" gets its own draft (no bleed from abandoned sessions). */
const NEW_SESSION_KEY = 'ironlog_new_workout_draft_session';

export function workoutDraftKey(workoutId, isNew) {
  return `${PREFIX}${isNew ? 'new' : workoutId}`;
}

export function getOrCreateNewWorkoutDraftSessionId() {
  try {
    let sid = sessionStorage.getItem(NEW_SESSION_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(NEW_SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return 'local';
  }
}

/** Call when user taps "New workout" / equivalent so the next editor does not reuse a previous unsaved draft. */
export function resetNewWorkoutDraftSession() {
  try {
    localStorage.removeItem(`${PREFIX}new`);
    const sid = crypto.randomUUID();
    sessionStorage.setItem(NEW_SESSION_KEY, sid);
    return sid;
  } catch {
    return 'local';
  }
}

export function newUnsavedWorkoutDraftKey() {
  return `${PREFIX}new_${getOrCreateNewWorkoutDraftSessionId()}`;
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

/** True if this looks like real work, not the default empty template. */
function isMeaningfulNewWorkoutDraft(draft) {
  if (!draft || typeof draft !== 'object') return false;
  if (!Array.isArray(draft.exercises) || draft.exercises.length === 0) return false;
  const notes = String(draft.notes || '').trim();
  if (notes.length > 0) return true;
  const title = String(draft.title || '').trim();
  if (title && title !== 'Workout') return true;
  if (draft.exercises.length > 1) return true;
  for (const e of draft.exercises) {
    const name = String(e?.name || '').trim();
    if (name && name !== 'Exercise') return true;
    if (e?.exerciseId) return true;
    for (const s of e?.sets || []) {
      if (s?.completed) return true;
      if (Number(s?.weight) > 0) return true;
      const r = Math.floor(Number(s?.reps) || 0);
      if (r > 0 && r !== 10) return true;
    }
  }
  return false;
}

/**
 * If the current tab has an unsaved new-workout draft with real edits, return a short preview for UI.
 * (Unsaved workouts are not on the server, so they never appear in GET /workouts.)
 */
export function getResumeableNewWorkoutDraftPreview() {
  const key = newUnsavedWorkoutDraftKey();
  const draft = loadWorkoutDraft(key);
  if (!isMeaningfulNewWorkoutDraft(draft)) return null;
  return {
    title: typeof draft.title === 'string' && draft.title.trim() ? draft.title.trim() : 'Workout',
    exerciseCount: draft.exercises.length,
    updatedAt: draft.updatedAt || null,
  };
}
