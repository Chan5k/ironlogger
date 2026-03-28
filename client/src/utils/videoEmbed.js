/**
 * Build a safe embed URL for common video hosts (YouTube). Returns null if unsupported.
 */
export function embedUrlFromVideoUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const u = url.trim();
  if (!u) return null;

  const ytWatch = u.match(/(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/);
  if (ytWatch) return `https://www.youtube-nocookie.com/embed/${ytWatch[1]}`;

  const ytShort = u.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (ytShort) return `https://www.youtube-nocookie.com/embed/${ytShort[1]}`;

  const ytEmbed = u.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (ytEmbed) return `https://www.youtube-nocookie.com/embed/${ytEmbed[1]}`;

  const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;

  return null;
}
