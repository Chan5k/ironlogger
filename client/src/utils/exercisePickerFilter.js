/**
 * Filter exercises by search text. Words must all match the name or category (case-insensitive).
 */
export function filterExercisesByQuery(library, query) {
  const words = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return library;
  return library.filter((e) => {
    const name = (e.name || '').toLowerCase();
    const cat = (e.category || '').toLowerCase();
    return words.every((w) => name.includes(w) || cat.includes(w));
  });
}

export function groupExercisesByCategory(exercises) {
  return exercises.reduce((acc, e) => {
    const c = e.category || 'other';
    acc[c] = acc[c] || [];
    acc[c].push(e);
    return acc;
  }, {});
}
