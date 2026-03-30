import UserNutritionFood from '../models/UserNutritionFood.js';
import { sanitizeBarcode } from './openFoodFactsBarcode.js';

const MAX_USER_SEARCH = 40;
const EXTERNAL_PREFIX = 'uf_';

export function userFoodExternalId(doc) {
  if (!doc?._id) return null;
  return `${EXTERNAL_PREFIX}${String(doc._id)}`;
}

/**
 * Same picker row shape as Romanian reference / Open Food Facts rows.
 */
export function userFoodToSearchRow(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    externalId: userFoodExternalId(o),
    name: String(o.name || '').slice(0, 200),
    brand: String(o.brand || '').slice(0, 120),
    caloriesPer100g: o.caloriesPer100g != null ? Number(o.caloriesPer100g) : null,
    proteinPer100g: o.proteinPer100g != null ? Number(o.proteinPer100g) : null,
    carbsPer100g: o.carbsPer100g != null ? Number(o.carbsPer100g) : null,
    fatsPer100g: o.fatsPer100g != null ? Number(o.fatsPer100g) : null,
    fiberPer100g: o.fiberPer100g != null ? Number(o.fiberPer100g) : null,
    sugarPer100g: o.sugarPer100g != null ? Number(o.sugarPer100g) : null,
    servingLabel: o.servingLabel ? String(o.servingLabel).slice(0, 120) : null,
    servingGrams: o.servingGrams != null && o.servingGrams > 0 ? Number(o.servingGrams) : null,
    source: 'user_library',
    barcode: o.barcode ? String(o.barcode) : null,
  };
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {import('mongoose').Types.ObjectId|string} userId
 * @param {string} q
 * @param {{ limit?: number }} [opts]
 */
export async function searchUserNutritionFoods(userId, q, opts = {}) {
  const limit = Math.max(1, Math.min(MAX_USER_SEARCH, Number(opts.limit) || 12));
  const needle = String(q || '')
    .trim()
    .slice(0, 200);
  if (needle.length < 1) {
    const rows = await UserNutritionFood.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();
    return rows;
  }
  const rx = new RegExp(escapeRegex(needle), 'i');
  const rows = await UserNutritionFood.find({
    userId,
    $or: [{ name: rx }, { brand: rx }, { barcode: needle }],
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();
  return rows;
}

/**
 * @param {import('mongoose').Types.ObjectId|string} userId
 * @param {string} digits
 */
export async function findUserFoodByBarcodeDigits(userId, digits) {
  if (!digits || digits.length < 8) return null;
  return UserNutritionFood.findOne({ userId, barcode: digits }).lean();
}
