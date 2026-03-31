/** First origin from CLIENT_URL (comma-separated allowed). */
export function clientOrigin() {
  const raw = process.env.CLIENT_URL || 'http://localhost:5173';
  return String(raw).split(',')[0].trim().replace(/\/$/, '');
}
