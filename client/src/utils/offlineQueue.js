const STORAGE_KEY = 'ironlog_offline_queue_v1';
export const OFFLINE_QUEUE_EVENT = 'ironlog-offline-queue-changed';

function readQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT));
  }
}

/** @returns {number} */
export function getOfflineQueueLength() {
  return readQueue().length;
}

/**
 * Queue a workout API mutation for later replay. Only paths under `/workouts` (relative to `/api`).
 * @returns {boolean} whether the item was enqueued
 */
export function enqueueOfflineRequest({ method, url, data }) {
  const m = String(method || '').toUpperCase();
  if (!['POST', 'PUT', 'DELETE'].includes(m)) return false;
  const path = String(url || '');
  if (!path.startsWith('/workouts')) return false;
  let q = readQueue();
  if (m === 'POST' && path === '/workouts') {
    q = q.filter((item) => !(item.method === 'POST' && item.url === '/workouts'));
  }
  q.push({
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    method: m,
    url: path,
    data: data ?? null,
    ts: Date.now(),
  });
  writeQueue(q);
  return true;
}

export function isOfflineQueueableError(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const code = err?.code;
  if (code === 'ERR_NETWORK' || code === 'ECONNABORTED') return true;
  const msg = String(err?.message || '');
  if (msg.includes('Network Error')) return true;
  if (!err?.response && err?.request) return true;
  return false;
}

/**
 * Replay queued requests in order. Stops on first failure and keeps remaining items.
 */
export async function flushOfflineQueue(api) {
  const q = readQueue();
  if (!q.length) return { ok: true, flushed: 0, remaining: 0 };
  const remaining = [];
  let flushed = 0;
  for (const item of q) {
    try {
      await api.request({
        method: item.method,
        url: item.url,
        data: item.data === null ? undefined : item.data,
      });
      flushed += 1;
    } catch {
      remaining.push(item);
      break;
    }
  }
  writeQueue(remaining);
  return { ok: remaining.length === 0, flushed, remaining: remaining.length };
}
