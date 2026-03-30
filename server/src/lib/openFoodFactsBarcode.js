/**
 * Packaged product lookup by barcode via Open Food Facts (free, no API key).
 * Tries the Romanian server first (supermarket products in RO), then the world server
 * if the product is missing — improves hit rate without abandoning local focus.
 *
 * API: https://openfoodfacts.github.io/openfoodfacts-server/api/ref-v2/#get-/api/v2/product/-barcode-
 */

const OFF_PRODUCT_RO = 'https://ro.openfoodfacts.org/api/v2/product';
const OFF_PRODUCT_WORLD = 'https://world.openfoodfacts.org/api/v2/product';
const REQUEST_TIMEOUT_MS = 12000;
const USER_AGENT = 'IronLogger/1.0 (nutrition barcode lookup)';

function toFiniteNutrient(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function parseServingGramsHint(servingSize) {
  if (!servingSize || typeof servingSize !== 'string') return null;
  const t = servingSize.trim().toLowerCase();
  const m = t.match(/([\d.,]+)\s*(g|kg|ml|l|cl|dl)\b/);
  if (!m) return null;
  const num = Number(String(m[1]).replace(',', '.'));
  if (!Number.isFinite(num) || num <= 0) return null;
  const u = m[2];
  if (u === 'kg') return num * 1000;
  if (u === 'l') return num * 1000;
  if (u === 'cl') return num * 10;
  if (u === 'dl') return num * 100;
  return num;
}

function normalizeOffProduct(product, code, lookupHost) {
  if (!product || typeof product !== 'object') return null;

  const name =
    [product.product_name, product.product_name_en, product.generic_name, product.abbreviated_product_name]
      .find((x) => typeof x === 'string' && x.trim())
      ?.trim() || 'Unknown product';

  const brand =
    [product.brands, product.brand_owner]
      .find((x) => typeof x === 'string' && x.trim())
      ?.trim()
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)[0] || '';

  const n = product.nutriments && typeof product.nutriments === 'object' ? product.nutriments : {};
  const kcal =
    toFiniteNutrient(n['energy-kcal_100g']) ??
    (toFiniteNutrient(n.energy_100g) != null ? toFiniteNutrient(n.energy_100g) / 4.184 : null);
  const protein = toFiniteNutrient(n.proteins_100g);
  const carbs = toFiniteNutrient(n.carbohydrates_100g);
  const fats = toFiniteNutrient(n.fat_100g);
  const fiber = toFiniteNutrient(n.fiber_100g);
  const sugar = toFiniteNutrient(n.sugars_100g);

  const servingLabel =
    typeof product.serving_size === 'string' && product.serving_size.trim()
      ? product.serving_size.trim()
      : null;
  const servingGrams =
    parseServingGramsHint(product.serving_size) ??
    (toFiniteNutrient(product.serving_quantity) &&
    String(product.serving_quantity_unit || '').toLowerCase() === 'g'
      ? toFiniteNutrient(product.serving_quantity)
      : null);

  const imageUrl =
    typeof product.image_front_small_url === 'string' && product.image_front_small_url.startsWith('http')
      ? product.image_front_small_url
      : typeof product.image_url === 'string' && product.image_url.startsWith('http')
        ? product.image_url
        : null;

  return {
    externalId: String(code || product.code || '').trim() || null,
    name: name.slice(0, 200),
    brand: brand.slice(0, 120),
    caloriesPer100g: kcal,
    proteinPer100g: protein,
    carbsPer100g: carbs,
    fatsPer100g: fats,
    fiberPer100g: fiber,
    sugarPer100g: sugar,
    servingLabel,
    servingGrams,
    nutriScore: typeof product.nutrition_grade_fr === 'string' ? product.nutrition_grade_fr : null,
    imageUrl,
    source: 'openfoodfacts',
    lookupHost,
  };
}

async function fetchProductJson(url, signal) {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
    signal,
  });
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
  if (!ct.includes('application/json')) return { ok: false, reason: 'non-json' };
  const text = await res.text();
  if (text.trimStart().startsWith('<')) return { ok: false, reason: 'html' };
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'invalid-json' };
  }
  return { ok: true, data };
}

/**
 * @param {string} digitsOnly barcode
 * @returns {Promise<{ found: boolean, product?: object, error?: string }>}
 */
export async function lookupBarcodeOpenFoodFacts(digitsOnly) {
  const code = digitsOnly;
  const urls = [`${OFF_PRODUCT_RO}/${encodeURIComponent(code)}`, `${OFF_PRODUCT_WORLD}/${encodeURIComponent(code)}`];

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const host = i === 0 ? 'ro' : 'world';
      try {
        const out = await fetchProductJson(url, controller.signal);
        if (!out.ok || !out.data) continue;
        const status = out.data.status;
        const product = out.data.product;
        if (status === 1 && product && typeof product === 'object') {
          const normalized = normalizeOffProduct(product, out.data.code || code, host);
          if (normalized) {
            return { found: true, product: normalized };
          }
        }
      } catch (e) {
        if (e?.name === 'AbortError') {
          return { found: false, error: 'Barcode lookup timed out' };
        }
      }
    }
    return { found: false, error: 'Product not found' };
  } finally {
    clearTimeout(t);
  }
}

/**
 * @param {string} raw from URL param
 * @returns {string|null} digits only 8–14 chars
 */
export function sanitizeBarcode(raw) {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 14) return null;
  return digits;
}
