import { useCallback, useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import api from '../api/client.js';

export default function WorkoutLikeButton({
  workoutId,
  initialCount = 0,
  initialLiked = false,
  disabled = false,
  size = 'sm',
  variant = 'default',
}) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked);
  const [pending, setPending] = useState(false);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    setCount(initialCount);
    setLiked(initialLiked);
  }, [initialCount, initialLiked, workoutId]);

  const isFeed = variant === 'feed';
  const iconClass = isFeed ? 'h-5 w-5' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const pad = isFeed ? 'px-3 py-2' : size === 'sm' ? 'p-1.5' : 'p-2';
  const textCls = isFeed ? 'text-sm' : 'text-xs';

  const toggle = useCallback(async () => {
    if (disabled || pending || !workoutId) return;
    const nextLiked = !liked;
    const prevCount = count;
    setPending(true);
    setLiked(nextLiked);
    setCount((c) => Math.max(0, c + (nextLiked ? 1 : -1)));
    if (nextLiked && isFeed) {
      setPop(true);
      window.setTimeout(() => setPop(false), 380);
    }
    try {
      if (nextLiked) {
        const { data } = await api.post(`/social/workouts/${workoutId}/like`);
        setCount(data.likeCount ?? count + 1);
        setLiked(data.likedByMe !== false);
      } else {
        const { data } = await api.delete(`/social/workouts/${workoutId}/like`);
        setCount(data.likeCount ?? Math.max(0, count - 1));
        setLiked(!!data.likedByMe);
      }
    } catch {
      setLiked(!nextLiked);
      setCount(prevCount);
    } finally {
      setPending(false);
    }
  }, [disabled, pending, workoutId, liked, count, isFeed]);

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || pending}
      className={`inline-flex items-center gap-2 rounded-xl ${pad} ${textCls} font-medium transition-all duration-200 active:scale-[0.94] disabled:opacity-50 ${
        isFeed ? 'hover:bg-slate-800/60' : ''
      } ${
        liked
          ? isFeed
            ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/35 shadow-sm shadow-rose-950/20'
            : 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25'
          : 'bg-slate-800/50 text-slate-400 ring-1 ring-slate-700/60 hover:bg-slate-800 hover:text-slate-200'
      }`}
      aria-pressed={liked}
      aria-label={liked ? 'Unlike workout' : 'Like workout'}
    >
      <Heart
        className={`${iconClass} shrink-0 transition-all duration-200 ease-out ${
          liked ? 'fill-current text-rose-400' : ''
        } ${pop ? 'scale-125 animate-feed-like-pop' : liked ? 'scale-110' : 'scale-100'}`}
        strokeWidth={isFeed ? 2 : 1.75}
        aria-hidden
      />
      <span className={`tabular-nums ${isFeed ? 'leading-none' : ''}`}>{count}</span>
    </button>
  );
}
