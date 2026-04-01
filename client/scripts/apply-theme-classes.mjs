/**
 * One-off style pass: map hard-coded dark hex panels to semantic `app.*` colors (CSS variables).
 * Run from repo root: node client/scripts/apply-theme-classes.mjs
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

/** Longer / more specific patterns first */
const REPLACEMENTS = [
  [/bg-\[#121826\]\/95/g, 'bg-app-panel/95'],
  [/bg-\[#121826\]\/80/g, 'bg-app-panel/80'],
  [/bg-\[#121826\]\/60/g, 'bg-app-panel/60'],
  [/bg-\[#121826\]/g, 'bg-app-panel'],
  [/bg-\[#0f141d\]\/90/g, 'bg-app-panel-muted/90'],
  [/bg-\[#0f141d\]\/50/g, 'bg-app-panel-muted/50'],
  [/bg-\[#0f141d\]/g, 'bg-app-panel-muted'],
  [/bg-\[#0c1018\]\/90/g, 'bg-app-panel-muted/90'],
  [/bg-\[#0a0e14\]/g, 'bg-app-panel-deep'],
  [/bg-\[#0b0e14\]\/95/g, 'bg-app-canvas/95'],
  [/bg-\[#0b0e14\]\/90/g, 'bg-app-canvas/90'],
  [/bg-\[#0b0e14\]/g, 'bg-app-canvas'],
  [/bg-\[#05080d\]\/80/g, 'bg-slate-900/45 dark:bg-[#05080d]/80'],
];

let changed = 0;
for (const file of walk(SRC)) {
  let s = fs.readFileSync(file, 'utf8');
  const orig = s;
  for (const [re, to] of REPLACEMENTS) {
    s = s.replace(re, to);
  }
  if (s !== orig) {
    fs.writeFileSync(file, s);
    changed += 1;
  }
}
console.log(`Updated ${changed} files under src/`);
