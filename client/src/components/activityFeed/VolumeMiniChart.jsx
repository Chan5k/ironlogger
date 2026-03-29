export default function VolumeMiniChart({ volumeByExercise }) {
  if (!volumeByExercise?.length) return null;
  const max = Math.max(...volumeByExercise.map((x) => x.volume), 1);
  const barMaxPx = 52;
  return (
    <div className="flex min-w-[120px] flex-col justify-end gap-1.5" aria-hidden>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-600">Volume</p>
      <div className="flex h-14 items-end gap-1">
        {volumeByExercise.slice(0, 6).map((ex) => {
          const px = Math.max(5, Math.round((ex.volume / max) * barMaxPx));
          return (
            <div
              key={ex.name}
              className="min-w-[6px] flex-1 rounded-t-sm bg-gradient-to-t from-blue-600/50 to-blue-400/30 transition-[height] duration-300"
              style={{ height: px }}
              title={`${ex.name}: ${ex.volume.toLocaleString()}`}
            />
          );
        })}
      </div>
    </div>
  );
}
