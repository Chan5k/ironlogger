/**
 * Static EAN/UPC → Romanian reference food rows when Open Food Facts has no product.
 *
 * Data: server/data/romanian-barcode-fallbacks.json — JSON array of:
 *   { "barcode": "5941234567890", "refId": "ro-ret-lapte-uht-35" }
 * refId must match an `id` from romanian-foods.json or romanian-retail-staples.json (merged in romanianFoodSearch.js).
 * Add rows as you confirm barcodes from local packs; first match wins per barcode.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { referenceRowToPickerProduct, getRomanianReferenceRowById } from './romanianFoodSearch.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FALLBACK_FILE = join(__dirname, '../../data/romanian-barcode-fallbacks.json');

let _map = null;

function loadMap() {
  if (_map) return _map;
  const raw = readFileSync(FALLBACK_FILE, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('romanian-barcode-fallbacks.json must be a JSON array');
  const m = new Map();
  for (const entry of data) {
    if (!entry || typeof entry !== 'object') continue;
    const bc = String(entry.barcode || '').replace(/\D/g, '');
    const refId = String(entry.refId || '').trim();
    if (bc.length < 8 || bc.length > 14 || !refId) continue;
    if (!m.has(bc)) m.set(bc, refId);
  }
  _map = m;
  return _map;
}

/**
 * @param {string} digitsOnly
 * @returns {object|null} same picker shape as Open Food Facts normalizer (+ source, barcode)
 */
export function lookupRomanianBarcodeFallback(digitsOnly) {
  const digits = String(digitsOnly || '').replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 14) return null;
  const refId = loadMap().get(digits);
  if (!refId) return null;
  const row = getRomanianReferenceRowById(refId);
  if (!row) return null;
  return referenceRowToPickerProduct(row, { barcode: digits });
}
