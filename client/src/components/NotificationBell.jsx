import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { appPath } from '../constants/routes.js';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [panelMounted, setPanelMounted] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef(null);
  const closeTimerRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications?limit=30');
      setItems(data.notifications || []);
      setUnread(data.unreadCount ?? 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (open) {
      clearTimeout(closeTimerRef.current);
      setPanelVisible(false);
      setPanelMounted(true);
      return undefined;
    }
    setPanelVisible(false);
    closeTimerRef.current = window.setTimeout(() => {
      setPanelMounted(false);
      closeTimerRef.current = null;
    }, 200);
    return () => clearTimeout(closeTimerRef.current);
  }, [open]);

  /** Single rAF: transition from closed styles → open (never run “out” keyframe on a fresh mount). */
  useLayoutEffect(() => {
    if (!open || !panelMounted) return undefined;
    const id = requestAnimationFrame(() => setPanelVisible(true));
    return () => cancelAnimationFrame(id);
  }, [open, panelMounted]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  async function markAllRead() {
    try {
      await api.patch('/notifications/read-all');
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
      setUnread(0);
    } catch {
      /* ignore */
    }
  }

  async function markOneRead(id) {
    const current = items.find((n) => n.id === id);
    if (current?.readAt) return;
    try {
      await api.patch(`/notifications/${id}/read`);
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt || new Date().toISOString() } : n))
      );
      setUnread((u) => Math.max(0, u - 1));
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => {
            const next = !o;
            if (next) load();
            return next;
          });
        }}
        className="relative rounded-lg p-2 text-slate-400 transition-colors duration-motion ease-motion-standard hover:bg-slate-800/60 hover:text-white"
        aria-expanded={open}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {panelMounted ? (
        <div
          className={`z-[60] rounded-xl border border-slate-800/90 bg-[#121826] py-2 shadow-xl ring-1 ring-black/30 transition-[opacity,transform] duration-motion-slow ease-motion-standard will-change-[opacity,transform] max-md:fixed max-md:left-3 max-md:right-3 max-md:top-[calc(env(safe-area-inset-top,0px)+4rem)] max-md:mt-0 max-md:max-h-[min(70vh,24rem)] max-md:w-auto max-md:origin-top md:absolute md:right-0 md:top-full md:mt-2 md:max-h-none md:w-[min(100vw-2rem,22rem)] md:origin-top-right ${
            panelVisible
              ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
              : 'pointer-events-none -translate-y-1 scale-[0.98] opacity-0'
          }`}
        >
          <div className="flex min-w-0 items-center justify-between gap-2 border-b border-slate-800/80 px-3 pb-2">
            <span className="min-w-0 shrink text-sm font-semibold text-white">Notifications</span>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => markAllRead()}
                className="shrink-0 text-xs font-medium text-blue-400 hover:text-blue-300"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <ul className="max-h-72 overflow-y-auto overflow-x-hidden px-1 py-1 max-md:max-h-[min(55vh,18rem)]">
            {loading && !items.length ? (
              <li className="px-3 py-4 text-center text-sm text-slate-500">Loading…</li>
            ) : null}
            {!loading && items.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-slate-500">No notifications yet</li>
            ) : null}
            {items.map((n) => (
              <li key={n.id}>
                <Link
                  to={
                    n.type === 'workout_like' && n.payload?.workoutId
                      ? appPath(`workouts/${n.payload.workoutId}`)
                      : appPath('leaderboards')
                  }
                  onClick={() => {
                    if (!n.readAt) markOneRead(n.id);
                    setOpen(false);
                  }}
                  className={`block min-w-0 rounded-lg px-3 py-2.5 text-left transition-colors duration-motion ease-motion-standard hover:bg-slate-800/50 ${
                    n.readAt ? 'opacity-70' : ''
                  }`}
                >
                  <p className="break-words text-sm font-medium text-slate-100">{n.title}</p>
                  {n.body ? (
                    <p className="mt-0.5 break-words text-xs text-slate-500">{n.body}</p>
                  ) : null}
                  <p className="mt-1 text-[10px] text-slate-600">
                    {new Date(n.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
