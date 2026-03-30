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
