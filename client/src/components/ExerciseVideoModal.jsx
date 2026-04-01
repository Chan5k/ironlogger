import { embedUrlFromVideoUrl } from '../utils/videoEmbed.js';

export default function ExerciseVideoModal({ title, videoUrl, onClose }) {
  const embed = embedUrlFromVideoUrl(videoUrl);
  return (
    <div
      className="fixed inset-0 z-[60] flex min-h-[100dvh] items-center justify-center overflow-y-auto p-4"
      style={{ top: 0, left: 0, right: 0, bottom: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Exercise demonstration"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        className="absolute inset-0 bg-slate-900/75 dark:bg-black/75 motion-reduce:animate-none animate-ui-backdrop-in"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-300 dark:border-slate-700 bg-surface-card shadow-xl motion-reduce:animate-none animate-ui-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3">
          <h2 className="truncate pr-2 text-sm font-semibold text-slate-900 dark:text-white">{title || 'Demo'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors duration-motion ease-motion-standard hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="aspect-video w-full bg-black">
          {embed ? (
            <iframe
              title={title ? `${title} demonstration` : 'Exercise demonstration'}
              src={embed}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-400">
              <p>
                This URL is not a supported embed. Use a YouTube or Vimeo link, or open the link
                directly:{' '}
                <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-accent-muted underline">
                  open video
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
