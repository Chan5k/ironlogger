/**
 * Imperative app dialogs (replaces window.alert / confirm / prompt for in-app / PWA feel).
 * Wired by AppDialogProvider; falls back to native if provider not mounted.
 */

let impl = {};

export function setAppDialogImpl(next) {
  impl = next && typeof next === 'object' ? next : {};
}

/** @param {string} message */
export function appAlert(message) {
  if (impl.alert) return impl.alert(String(message));
  window.alert(message);
  return Promise.resolve();
}

/** @param {string} message @returns {Promise<boolean>} */
export function appConfirm(message) {
  if (impl.confirm) return impl.confirm(String(message));
  return Promise.resolve(window.confirm(message));
}

/** @param {{ url: string, title?: string }} opts */
export function appCopySheet(opts) {
  if (impl.copySheet) return impl.copySheet(opts);
  window.prompt(opts?.title || 'Copy this link:', opts?.url || '');
  return Promise.resolve();
}
