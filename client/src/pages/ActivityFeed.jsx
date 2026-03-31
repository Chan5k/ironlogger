import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import NewWorkoutLink from '../components/NewWorkoutLink.jsx';
import { appPath } from '../constants/routes.js';
import FeedTabs from '../components/activityFeed/FeedTabs.jsx';
import WorkoutPostCard from '../components/activityFeed/WorkoutPostCard.jsx';

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-[11px] border border-slate-800/60 bg-[#121826]/60 p-5"
        >
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-800" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-36 rounded bg-slate-800" />
              <div className="h-3 w-48 rounded bg-slate-800/80" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full rounded bg-slate-800/70" />
            <div className="h-3 max-w-[85%] rounded bg-slate-800/70" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ActivityFeedPage() {
  const [fq, setFq] = useState({ scope: 'following', sort: 'latest', page: 1 });
  const [posts, setPosts] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState('');
  const sentinelRef = useRef(null);

  const setScope = useCallback((scope) => {
    setFq((prev) => ({ ...prev, scope, page: 1 }));
    setPosts([]);
    setHasMore(true);
  }, []);

  const setSort = useCallback((sort) => {
    setFq((prev) => ({ ...prev, sort, page: 1 }));
    setPosts([]);
    setHasMore(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const { scope, sort, page } = fq;
    const isFirst = page === 1;
    (async () => {
      if (isFirst) setLoading(true);
      else setLoadingMore(true);
      setErr('');
      try {
        const { data } = await api.get('/social/activity-feed', {
          params: { scope, sort, page, limit: 10 },
        });
        if (cancelled) return;
        setPosts((prev) => (page === 1 ? data.posts || [] : [...prev, ...(data.posts || [])]));
        setHasMore(!!data.hasMore);
      } catch (e) {
        if (!cancelled) {
          if (e.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
            setErr(
              'Verify your email to use the activity feed. Check the banner at the top of the app or resend the link from Settings.'
            );
          } else {
            setErr(e.response?.data?.error || 'Could not load feed');
          }
          if (page === 1) setPosts([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fq]);

  const loadMore = useCallback(() => {
    if (!hasMore || loading || loadingMore) return;
    setFq((prev) => ({ ...prev, page: prev.page + 1 }));
  }, [hasMore, loading, loadingMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root: null, rootMargin: '100px', threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore, posts.length]);

  return (
    <div className="mx-auto w-full max-w-[880px] pb-8">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white md:text-[1.65rem]">
            Activity Feed
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            See what&apos;s happening in your fitness network
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="feed-sort">
            Sort
          </label>
          <select
            id="feed-sort"
            value={fq.sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-slate-700 bg-[#121826] px-3 py-2 text-sm text-slate-200 transition-[border-color,box-shadow] duration-motion ease-motion-standard focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
          >
            <option value="latest">Latest</option>
            <option value="top">Top</option>
          </select>
          <NewWorkoutLink className="inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-950/25 transition-colors duration-motion ease-motion-standard hover:bg-blue-500">
            Start a workout
          </NewWorkoutLink>
        </div>
      </div>

      <FeedTabs value={fq.scope} onChange={setScope} />

      <div className="mt-5 space-y-4 md:space-y-5">
        {err ? <p className="text-sm text-red-400">{err}</p> : null}

        {loading && fq.page === 1 ? <FeedSkeleton /> : null}

        {!loading &&
          posts.map((post, i) => (
            <WorkoutPostCard
              key={post.id}
              post={post}
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            />
          ))}

        {!loading && !err && posts.length === 0 ? (
          <div className="rounded-[11px] border border-dashed border-slate-700/80 bg-[#0f141d]/50 px-6 py-12 text-center text-sm text-slate-500">
            {fq.scope === 'following'
              ? 'Follow people to see their workouts here, or switch to Global.'
              : 'No public workouts to show yet. Enable a public profile and complete a session to appear here.'}
          </div>
        ) : null}

        {loadingMore ? (
          <p className="py-4 text-center text-xs text-slate-600">Loading more…</p>
        ) : null}

        <div ref={sentinelRef} className="h-4 w-full" aria-hidden />
      </div>
    </div>
  );
}
