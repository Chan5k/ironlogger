import { Link } from 'react-router-dom';
import ExerciseIcon from '../ExerciseIcon.jsx';
import WorkoutLikeButton from '../WorkoutLikeButton.jsx';
import VolumeMiniChart from './VolumeMiniChart.jsx';
import CommentSection from './CommentSection.jsx';
import { useState } from 'react';

export default function WorkoutPostCard({ post, style }) {
  const [commentCount, setCommentCount] = useState(post.commentCount ?? 0);
  const { user, workout, prs } = post;

  return (
    <article
      className="animate-feed-post rounded-[11px] border border-slate-200/90 dark:border-slate-800/90 bg-app-panel/95 p-4 shadow-sm shadow-slate-400/25 dark:shadow-black/15 transition-[transform,box-shadow] duration-motion-slow ease-motion-standard hover:-translate-y-0.5 hover:border-slate-200/80 dark:border-slate-700/80 hover:shadow-md hover:shadow-slate-400/25 dark:shadow-black/25 md:p-5"
      style={style}
    >
      <header className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700/90 text-xs font-semibold text-slate-100 ring-1 ring-slate-600/50"
          aria-hidden
        >
          {user.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div>
            {user.slug ? (
              <Link
                to={`/u/${encodeURIComponent(user.slug)}`}
                className="font-semibold text-slate-900 dark:text-white hover:text-blue-200"
              >
                {user.name}
              </Link>
            ) : (
              <span className="font-semibold text-slate-900 dark:text-white">{user.name}</span>
            )}
            <p className="mt-0.5 text-xs text-slate-500">
              {workout.type} · {workout.title} · {workout.duration}
            </p>
          </div>
        </div>
      </header>

      {prs?.length ? (
        <div className="mt-3 flex flex-col gap-2">
          {prs.map((pr) => (
            <div
              key={`${pr.exerciseName}-${pr.detail}`}
              className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300/95 ring-1 ring-emerald-500/20"
            >
              🔥 New PR on {pr.exerciseName} ({pr.detail})
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between">
        <ul className="min-w-0 flex-1 space-y-2">
          {workout.exercises.map((ex) => (
            <li key={`${post.id}-${ex.name}`} className="flex items-center gap-2 text-sm">
              <ExerciseIcon
                name={ex.name}
                category={ex.category}
                className="h-4 w-4 shrink-0 text-slate-500"
              />
              <span className="font-medium text-slate-200">{ex.name}</span>
              <span className="text-slate-600"> · </span>
              <span className="font-mono text-xs text-slate-400">{ex.setsLine}</span>
            </li>
          ))}
        </ul>
        <VolumeMiniChart volumeByExercise={workout.volumeByExercise} />
      </div>

      <footer className="mt-4 border-t border-slate-200/80 dark:border-slate-800/80 pt-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
          <span>
            <span className="text-slate-600">Volume </span>
            <span className="font-mono tabular-nums text-slate-300">
              {(workout.totalVolumeKg ?? workout.totalVolume).toLocaleString()} kg
            </span>
          </span>
          <span>
            <span className="text-slate-600">Sets </span>
            <span className="tabular-nums text-slate-300">{workout.totalSets}</span>
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-0">
          <WorkoutLikeButton
            variant="feed"
            workoutId={post.id}
            initialCount={post.likeCount}
            initialLiked={post.likedByUser}
          />
          <CommentSection
            workoutId={post.id}
            initialCount={commentCount}
            onCountChange={() => setCommentCount((c) => c + 1)}
          />
        </div>
      </footer>
    </article>
  );
}
