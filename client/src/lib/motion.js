/**
 * App-wide motion timing — keep in sync with tailwind.config.js `transitionDuration` / animations.
 */
export const MOTION = {
  fast: 150,
  default: 200,
  slow: 280,
  out: 320,
  progress: 500,
};

export const MOTION_EASE_STANDARD = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const MOTION_EASE_EMPHASIZED = 'cubic-bezier(0.32, 0.72, 0, 1)';
