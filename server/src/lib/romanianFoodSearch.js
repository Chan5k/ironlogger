/**
 * Romanian food reference for IronLogger — replaces external product APIs.
 * Curated typical values (per 100 g edible portion unless noted); soups include liquid weight.
 * Sources are general food composition references + common Romanian portions; treat as estimates, not lab data.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, '../../data/romanian-foods.json');

const PAGE_SIZE = 25;

/** Fold Romanian diacritics for ASCII-insensitive search. */
function foldRo(s) {
  if (!s) return '';
  const map = {
    ă: 'a',
    â: 'a',
    î: 'i',
    ș: 's',
    ț: 't',
    Ă: 'a',
    Â: 'a',
    Î: 'i',
    Ș: 's',
    Ț: 't',
  };
  return String(s)
    .split('')
    .map((c) => map[c] || c)
    .join('')
    .toLowerCase();
}

function buildSearchBlob(row) {
  const parts = [
    row.nameEn,
    row.nameRo,
    row.category,
    ...(Array.isArray(row.aliases) ? row.aliases : []),
  ];
  return foldRo(parts.filter(Boolean).join(' '));
}

let _rows = null;

function loadRows() {
  if (_rows) return _rows;
  const raw = readFileSync(DATA_FILE, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('romanian-foods.json must be a JSON array');
  _rows = data.map((row) => ({
    ...row,
    _blob: buildSearchBlob(row),
  }));
  return _rows;
}

/**
 * Same outward shape as the old Open Food Facts normalizer so the client stays unchanged.
 */
function toApiRow(row) {
  return {
    externalId: row.id,
    name: String(row.nameEn || row.nameRo || '').slice(0, 200),
    brand: [row.nameRo, row.category].filter(Boolean).join(' · ').slice(0, 120),
    caloriesPer100g: Number(row.kcal100),
    proteinPer100g: Number(row.p100),
    carbsPer100g: Number(row.c100),
    fatsPer100g: Number(row.f100),
    fiberPer100g: row.fiber100 != null ? Number(row.fiber100) : null,
    sugarPer100g: row.sugar100 != null ? Number(row.sugar100) : null,
    servingLabel: row.servingLabel || null,
    servingGrams: row.servingG != null ? Number(row.servingG) : null,
    nutriScore: null,
  };
}

function scoreRow(foldedQuery, row) {
  if (!foldedQuery || foldedQuery.length < 1) return row.featured ? 2 : 0;
  const b = row._blob;
  if (!b) return 0;
  let score = 0;
  if (b === foldedQuery) score += 120;
  if (b.startsWith(foldedQuery)) score += 80;
  if (b.includes(foldedQuery)) score += 50;
  const qWords = foldedQuery.split(/\s+/).filter((w) => w.length > 1);
  for (const w of qWords) {
    if (b.includes(w)) score += 12;
  }
  if (row.featured) score += 3;
  const en = foldRo(row.nameEn || '');
  const ro = foldRo(row.nameRo || '');
  if (en.startsWith(foldedQuery) || ro.startsWith(foldedQuery)) score += 25;
  return score;
}

/**
 * @param {string} query
 * @param {{ page?: number }} [opts]
 * @returns {{ ok: true, results: object[] }}
 */
export function searchRomanianFoods(query, opts = {}) {
  const page = Math.max(1, Math.min(200, Number(opts.page) || 1));
  const q = String(query || '')
    .trim()
    .slice(0, 200);
  const rows = loadRows();

  if (q.length < 1) {
    const featured = rows.filter((r) => r.featured).map(toApiRow);
    const start = (page - 1) * PAGE_SIZE;
    return { ok: true, results: featured.slice(start, start + PAGE_SIZE) };
  }

  const fq = foldRo(q);
  const scored = rows
    .map((row) => ({ row, s: scoreRow(fq, row) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  const start = (page - 1) * PAGE_SIZE;
  const slice = scored.slice(start, start + PAGE_SIZE).map((x) => toApiRow(x.row));
  return { ok: true, results: slice };
}

/**
 * Quick-add list for GET /api/nutrition/suggestions — same shape as before.
 * @param {string} q
 * @param {number} limit
 * @returns {{ name: string, hint: string }[]}
 */
export function filterRomanianSuggestions(q, limit = 12) {
  const rows = loadRows();
  const needle = foldRo(String(q || '').trim().slice(0, 80));
  let pool = rows.filter((r) => r.featured);
  if (needle.length >= 1) {
    pool = rows
      .map((row) => ({ row, s: scoreRow(needle, row) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.row);
  }
  const cap = Math.max(1, Math.min(30, limit));
  return pool.slice(0, cap).map((row) => ({
    name: row.nameEn || row.nameRo,
    hint: row.servingLabel
      ? `${row.servingLabel} · ~${Math.round((Number(row.kcal100) * Number(row.servingG || 100)) / 100)} kcal (est.)`
      : `~${row.kcal100} kcal / 100 g (reference)`,
  }));
}
