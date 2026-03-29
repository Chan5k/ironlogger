import ExerciseIcon from '../ExerciseIcon.jsx';

export default function VolumeMiniChart({ volumeByExercise }) {
  if (!volumeByExercise?.length) return null;
  const max = Math.max(...volumeByExercise.map((x) => x.volume), 1);
  const barMaxPx = 52;
  return (
    <div className="flex min-w-[120px] flex-col justify-end gap-1.5" aria-hidden>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-600">Volume</p>
      <div className="flex h-16 items-end gap-1">
        {volumeByExercise.slice(0, 6).map((ex) => {
          const px = Math.max(5, Math.round((ex.volume / max) * barMaxPx));
          return (
            <div
              key={ex.name}
              className="flex min-w-[6px] flex-1 flex-col-reverse items-center gap-1"
              title={`${ex.name}: ${ex.volume.toLocaleString()}`}
            >
              <div
                className="w-full rounded-t-sm bg-gradient-to-t from-blue-600/50 to-blue-400/30 transition-[height] duration-motion-slow ease-motion-standard"
                style={{ height: px }}
              />
              <ExerciseIcon
                name={ex.name}
                category={ex.category}
                className="h-3 w-3 text-slate-500"
                strokeWidth={2}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
