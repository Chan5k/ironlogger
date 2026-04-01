import { useCallback, useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import api from '../../api/client.js';

export default function CommentSection({ workoutId, initialCount, onCountChange }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!workoutId) return;
    setLoading(true);
    setErr('');
    try {
      const { data } = await api.get(`/social/workouts/${workoutId}/comments`);
      setComments(data.comments || []);
    } catch {
      setErr('Could not load comments');
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [workoutId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function submit(e) {
    e.preventDefault();
    const b = text.trim();
    if (!b || submitting) return;
    setSubmitting(true);
    setErr('');
    try {
      const { data } = await api.post(`/social/workouts/${workoutId}/comments`, { body: b });
      setComments((prev) => [...prev, data.comment]);
      setText('');
      onCountChange?.(1);
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Could not post');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-400 ring-1 ring-slate-200/60 dark:ring-slate-700/60 transition-all duration-motion ease-motion-standard hover:bg-slate-800/50 hover:text-slate-200 active:scale-[0.98]"
        aria-expanded={open}
      >
        <MessageCircle className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
        <span className="tabular-nums leading-none">{initialCount}</span>
      </button>

      <div
        className={`w-full min-w-0 basis-full transition-[margin] duration-motion-slow ease-motion-standard ${
          open ? 'mt-3' : 'mt-0'
        }`}
      >
        <div
          className={`grid transition-[grid-template-rows] duration-motion-slow ease-motion-standard ${
            open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="overflow-hidden">
            <div className="space-y-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-app-panel-muted/90 p-3">
              {loading ? <p className="text-xs text-slate-500">Loading comments…</p> : null}
              {err ? <p className="text-xs text-rose-400">{err}</p> : null}
              <ul className="max-h-48 space-y-2 overflow-y-auto">
                {comments.map((c) => (
                  <li key={c.id} className="text-sm">
                    <span className="font-semibold text-slate-200">{c.user.name}</span>
                    <span className="text-slate-500"> · </span>
                    <span className="text-slate-400">{c.body}</span>
                  </li>
                ))}
                {!loading && comments.length === 0 ? (
                  <li className="text-xs text-slate-600">No comments yet.</li>
                ) : null}
              </ul>
              <form onSubmit={submit} className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write a comment…"
                  maxLength={800}
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-surface px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-600 focus:border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                />
                <button
                  type="submit"
                  disabled={submitting || !text.trim()}
                  className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors duration-motion ease-motion-standard hover:bg-blue-500 disabled:opacity-40"
                >
                  Post
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
