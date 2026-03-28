export const SET_TYPE_OPTIONS = [
  { value: 'warmup', label: 'Warm-up' },
  { value: 'normal', label: 'Normal' },
  { value: 'failure', label: 'Failure' },
];

export function normalizeSetType(t) {
  if (t === 'warmup' || t === 'failure') return t;
  return 'normal';
}
