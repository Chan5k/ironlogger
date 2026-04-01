/**
 * Adds light/dark paired utilities for text and borders (run once).
 * Preserves text-white on colored buttons (accent, emerald, etc.).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(jsx|js|tsx|ts)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

const COLORED_BG =
  /\b(bg-(?:accent|emerald|red|rose|violet|amber|orange|blue|sky|teal|indigo|cyan|lime|fuchsia|pink|purple|green)(?:\/[\d.]+)?(?:\s+[\w\-:/.%\[\]()]+)*)\s+text-white\b/g;

function transform(s) {
  let out = s;
  out = out.replace(COLORED_BG, (_, pref) => `${pref} __IRONLOG_KEEP_WHITE__`);

  /* Placeholders so the global text-white pass does not corrupt dark:hover:text-white. */
  out = out.replace(/\bgroup-hover:text-white\b/g, '__GH_WHITE__');
  out = out.replace(/\bhover:text-white\b/g, '__H_WHITE__');
  out = out.replace(/\btext-white\b/g, 'text-slate-900 dark:text-white');
  out = out.replace(/__H_WHITE__/g, 'hover:text-slate-900 dark:hover:text-white');
  out = out.replace(/__GH_WHITE__/g, 'group-hover:text-slate-900 dark:group-hover:text-white');

  out = out.replace(/__IRONLOG_KEEP_WHITE__/g, 'text-white');

  const borderPairs = [
    [/border-slate-900\/(\d+)/g, 'border-slate-200/$1 dark:border-slate-900/$1'],
    [/border-slate-800\/(\d+)/g, 'border-slate-200/$1 dark:border-slate-800/$1'],
    [/border-slate-700\/(\d+)/g, 'border-slate-200/$1 dark:border-slate-700/$1'],
    [/border-slate-600\/(\d+)/g, 'border-slate-300/$1 dark:border-slate-600/$1'],
    [/\bring-slate-800\/(\d+)/g, 'ring-slate-200/$1 dark:ring-slate-800/$1'],
    [/\bring-slate-700\/(\d+)/g, 'ring-slate-200/$1 dark:ring-slate-700/$1'],
    [/\bdivide-slate-800\b/g, 'divide-slate-200 dark:divide-slate-800'],
    [/\bdivide-slate-700\b/g, 'divide-slate-200 dark:divide-slate-700'],
    [/\bborder-slate-900\b(?!\/)/g, 'border-slate-200 dark:border-slate-900'],
    [/\bborder-slate-800\b(?!\/)/g, 'border-slate-200 dark:border-slate-800'],
    [/\bborder-slate-700\b(?!\/)/g, 'border-slate-300 dark:border-slate-700'],
    [/\bborder-slate-600\b(?!\/)/g, 'border-slate-300 dark:border-slate-600'],
    [/\bring-slate-800\b(?!\/)/g, 'ring-slate-200 dark:ring-slate-800'],
    [/\bring-slate-700\b(?!\/)/g, 'ring-slate-200 dark:ring-slate-700'],
    [/\bring-slate-600\b(?!\/)/g, 'ring-slate-300 dark:ring-slate-600'],
  ];

  for (const [re, to] of borderPairs) {
    out = out.replace(re, to);
  }

  out = out.replace(/\bbg-black\/(\d+)/g, 'bg-slate-900/$1 dark:bg-black/$1');
  out = out.replace(/\bshadow-black\/(\d+)/g, 'shadow-slate-400/25 dark:shadow-black/$1');

  return out;
}

let n = 0;
for (const file of walk(SRC)) {
  const orig = fs.readFileSync(file, 'utf8');
  const next = transform(orig);
  if (next !== orig) {
    fs.writeFileSync(file, next);
    n += 1;
  }
}
console.log(`Pass2 updated ${n} files`);
