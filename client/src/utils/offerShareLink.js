import { appAlert, appCopySheet } from '../lib/appDialogApi.js';

/**
 * Offer a URL for sharing or copying. Mobile Safari often rejects clipboard.writeText
 * even on HTTPS; we then fall back to the Web Share API (native sheet) or in-app copy sheet.
 *
 * @param {string} url
 * @param {{ successMessage?: string, shareTitle?: string }} [options]
 */
export async function offerShareLink(url, options = {}) {
  const { successMessage, shareTitle = 'IronLog' } = options;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      if (successMessage) await appAlert(successMessage);
      return;
    } catch {
      /* iOS Safari and some WebViews reject here — try share / in-app sheet */
    }
  }

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: shareTitle, url });
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
  }

  await appCopySheet({ url, title: 'Copy this link' });
}
